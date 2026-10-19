-- Community (travel discussion + marine sightings) and private app feedback.
-- Apple App Review 1.2 (user-generated content) requires: agreeing to rules before posting, filtering
-- objectionable content, reporting posts, blocking users, and acting on reports. All of that lives here.

alter table public.profiles
  add column community_name text check (community_name is null or length(btrim(community_name)) between 2 and 30),
  add column community_terms_at timestamptz;

-- ---------- Posts (and replies) ----------
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  channel text not null check (channel in ('discuss', 'sighting')),
  parent_id uuid references public.community_posts (id) on delete cascade,
  body text not null default '' check (length(body) <= 1000),
  media_path text check (media_path is null or media_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  media_kind text check (media_kind in ('image', 'video')),
  link_url text check (link_url is null or (link_url ~ '^https://[^[:space:]]{4,}$' and length(link_url) <= 500)),
  -- Sightings: where and what (free text, the app suggests dive sites and species).
  spot text check (spot is null or length(spot) <= 60),
  species text check (species is null or length(species) <= 60),
  hidden boolean not null default false,
  hidden_reason text,
  created_at timestamptz not null default now(),
  constraint has_content check (length(btrim(body)) > 0 or media_path is not null or link_url is not null),
  constraint media_pair check ((media_path is null) = (media_kind is null)),
  constraint replies_are_text check (parent_id is null or (media_path is null and channel = 'discuss'))
);
create index on public.community_posts (channel, created_at desc) where parent_id is null;
create index on public.community_posts (parent_id, created_at);

create table public.community_reports (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'nudity', 'violence', 'scam', 'other')),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

create table public.community_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Words that are never allowed (admins add more). Matched as whole words, case-insensitive.
create table public.community_blocklist (word text primary key check (word = lower(word) and length(word) between 2 and 40));
insert into public.community_blocklist (word) values
  ('fuck'), ('fucking'), ('shit'), ('cunt'), ('nigger'), ('nigga'), ('faggot'), ('retard'), ('whore'), ('slut'),
  ('puta'), ('puto'), ('pendejo'), ('maricon'), ('marica'), ('verga'), ('mierda'), ('culero'), ('hijueputa'), ('cocaine'), ('coca'), ('escort');

-- How many reports hide a post until a person at the office looks at it.
create table public.community_settings (id boolean primary key default true check (id), hide_after_reports int not null default 3, max_posts_per_day int not null default 20);
insert into public.community_settings default values;

-- ---------- Rules on insert: terms accepted, name set, clean words, rate limit ----------
create function public.community_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_terms timestamptz;
  v_text text := lower(coalesce(new.body, '') || ' ' || coalesce(new.spot, '') || ' ' || coalesce(new.species, '') || ' ' || coalesce(new.link_url, ''));
  v_limit int;
begin
  select community_name, community_terms_at into v_name, v_terms from public.profiles where id = new.author_id;
  if v_terms is null then raise exception 'accept_rules_first' using errcode = '42501'; end if;
  if v_name is null then raise exception 'pick_a_name_first' using errcode = 'P0001'; end if;
  -- Nobody but the office may post as the business.
  if v_name ~* '(water ?uber|admin|moderator|official|staff|support team)' and not public.is_admin() then
    raise exception 'reserved_name' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.community_blocklist b where v_text ~ ('(^|[^a-z0-9])' || b.word || '([^a-z0-9]|$)')) then
    raise exception 'blocked_words' using errcode = 'P0001';
  end if;
  select max_posts_per_day into v_limit from public.community_settings;
  if (select count(*) from public.community_posts where author_id = new.author_id and created_at > now() - interval '1 day') >= v_limit then
    raise exception 'too_many_posts' using errcode = 'P0001';
  end if;
  if new.parent_id is not null and not exists (select 1 from public.community_posts p where p.id = new.parent_id and p.parent_id is null and not p.hidden) then
    raise exception 'cannot_reply_here' using errcode = 'P0001';
  end if;
  -- Media must be in the author's own folder.
  if new.media_path is not null and split_part(new.media_path, '/', 1) <> new.author_id::text then
    raise exception 'bad_media_path' using errcode = '42501';
  end if;
  new.author_name := v_name;
  new.hidden := false;
  new.hidden_reason := null;
  new.created_at := now();
  return new;
end $$;
create trigger community_before_insert before insert on public.community_posts for each row execute function public.community_before_insert();

-- Enough reports → hidden until reviewed.
create function public.community_after_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_limit int;
begin
  select hide_after_reports into v_limit from public.community_settings;
  if (select count(*) from public.community_reports where post_id = new.post_id) >= v_limit then
    update public.community_posts set hidden = true, hidden_reason = 'reports' where id = new.post_id;
  end if;
  return new;
end $$;
create trigger community_after_report after insert on public.community_reports for each row execute function public.community_after_report();

-- ---------- Row Level Security ----------
alter table public.community_posts enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_blocklist enable row level security;
alter table public.community_settings enable row level security;

-- Signed-in guests (anonymous included) read visible posts, minus authors they blocked; always their own; admins all.
create policy "read posts" on public.community_posts for select using (
  auth.uid() is not null and (
    author_id = auth.uid()
    or public.is_admin()
    or (not hidden and not exists (select 1 from public.community_blocks b where b.blocker_id = auth.uid() and b.blocked_id = community_posts.author_id))
  )
);
create policy "write own posts" on public.community_posts for insert with check (auth.uid() is not null and author_id = auth.uid());
create policy "delete own posts" on public.community_posts for delete using (author_id = auth.uid() or public.is_admin());
create policy "admin moderates" on public.community_posts for update using (public.is_admin()) with check (public.is_admin());

create policy "report" on public.community_reports for insert with check (auth.uid() is not null and reporter_id = auth.uid());
create policy "admin reads reports" on public.community_reports for select using (public.is_admin() or reporter_id = auth.uid());

create policy "own blocks" on public.community_blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "admin blocklist" on public.community_blocklist for all using (public.is_admin()) with check (public.is_admin());
create policy "admin settings" on public.community_settings for all using (public.is_admin()) with check (public.is_admin());

-- Guests may set their own community name and accept the rules (profiles already allow own updates).

-- ---------- Private app feedback (only the team reads it) ----------
create table public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id) on delete cascade,
  rating int check (rating between 1 and 5),
  kind text not null check (kind in ('love', 'idea', 'confusing', 'bug')),
  body text not null default '' check (length(body) <= 2000),
  screen text check (length(screen) <= 60),
  app_version text check (length(app_version) <= 20),
  created_at timestamptz not null default now(),
  constraint feedback_has_content check (rating is not null or length(btrim(body)) > 0)
);
alter table public.app_feedback enable row level security;
create policy "send feedback" on public.app_feedback for insert with check (auth.uid() is not null and guest_id = auth.uid());
create policy "read own feedback" on public.app_feedback for select using (guest_id = auth.uid() or public.is_admin());

-- ---------- Photos and videos (Supabase Storage; skipped where Storage isn't installed, e.g. tests) ----------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('community', 'community', true, 31457280, array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime'])
    on conflict (id) do nothing;
    execute $p$create policy "community upload own folder" on storage.objects for insert to authenticated
      with check (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "community delete own" on storage.objects for delete to authenticated
      using (bucket_id = 'community' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))$p$;
  end if;
end $$;

-- ---------- Account deletion also removes community posts (App Store 5.1.1(v)) ----------
create or replace function public.erase_guest(p_guest uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.rides where guest_id = p_guest and status in ('paid', 'accepted', 'onboard'))
     or exists (select 1 from public.bookings where guest_id = p_guest and status in ('paid', 'quoted', 'awaiting_payment', 'requested') and trip_date >= current_date) then
    return 'has_upcoming';
  end if;
  update public.profiles
     set full_name = null, phone = null, whatsapp = null, emergency_name = null, emergency_phone = null,
         notify_offers = false, deleted_at = now(), community_name = null, community_terms_at = null
   where id = p_guest;
  delete from public.saved_places where guest_id = p_guest;
  delete from public.inbox_reads where guest_id = p_guest;
  delete from public.inbox_messages where guest_id = p_guest;
  update public.repeat_rides set active = false where guest_id = p_guest;
  update public.donations set message = null where donor_id = p_guest;
  update public.support_requests set message = '[deleted]' where guest_id = p_guest;
  delete from public.community_posts where author_id = p_guest;
  delete from public.community_blocks where blocker_id = p_guest or blocked_id = p_guest;
  delete from public.app_feedback where guest_id = p_guest;
  return 'ok';
end $$;
revoke all on function public.erase_guest(uuid) from public, anon, authenticated;
