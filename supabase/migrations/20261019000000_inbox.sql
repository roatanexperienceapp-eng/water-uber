-- Inbox: offers, support, updates and priority messages for guests.
--
-- Rules:
--   * Priority is ONLY for safety and trip-critical messages (rough sea, missed ship risk, cancelled group
--     booking). Offers can never be posted there; the database refuses it.
--   * Broadcast messages (guest_id null) reach everyone in the audience; personal ones reach one guest.
--   * Only admins (or the system, through triggers) can send. Guests can only read and mark as read.

create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('offer', 'support', 'update', 'priority')),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 1000),
  -- Optional translations: {"es": {"title": "...", "body": "..."}, ...}
  translations jsonb not null default '{}'::jsonb,
  -- Optional button: label + an in-app path (e.g. "/portal/snork", "/pass", "/checkout?kind=listing&id=...").
  cta_label text check (cta_label is null or length(cta_label) <= 40),
  cta_path text check (cta_path is null or (cta_path ~ '^/[A-Za-z0-9_\-/?=&%.\[\]]*$' and cta_path !~ '^//')),
  -- Who sees it: everyone, cruise visitors, week-stay guests, or one guest.
  audience text not null default 'all' check (audience in ('all', 'cruise', 'stay')),
  guest_id uuid references public.profiles (id) on delete cascade,
  ship_call_id uuid references public.ship_calls (id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  -- 'system' messages come from triggers; 'team' from your staff.
  source text not null default 'team' check (source in ('team', 'system')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at),
  -- Promotions are never priority.
  check (not (category = 'priority' and source = 'team' and cta_path ~ '^/(checkout|portal)'))
);
create index on public.inbox_messages (guest_id, created_at desc);
create index on public.inbox_messages (created_at desc) where guest_id is null;

create table public.inbox_reads (
  message_id uuid not null references public.inbox_messages (id) on delete cascade,
  guest_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, guest_id)
);

alter table public.inbox_messages enable row level security;
alter table public.inbox_reads enable row level security;

create policy "read my inbox" on public.inbox_messages for select using (
  public.is_admin()
  or (auth.uid() is not null and (guest_id is null or guest_id = auth.uid()) and starts_at <= now() and (expires_at is null or expires_at > now()))
);
create policy "admin sends" on public.inbox_messages for insert with check (public.is_admin() and source = 'team');
create policy "admin edits" on public.inbox_messages for update using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes" on public.inbox_messages for delete using (public.is_admin());

create policy "own reads" on public.inbox_reads for select using (guest_id = auth.uid());
create policy "mark own read" on public.inbox_reads for insert with check (
  guest_id = auth.uid() and exists (select 1 from public.inbox_messages m where m.id = message_id)
);

-- Offers posted as priority are refused (belt and braces next to the check above).
create function public.guard_inbox_category() returns trigger
language plpgsql as $$
begin
  if new.category = 'priority' and new.source = 'team'
     and (new.title || ' ' || new.body) ~* '(% off|discount|descuento|promo|coupon|cupón|deal|sale\M|oferta)' then
    raise exception 'offers_are_not_priority' using errcode = 'P0001',
      hint = 'Post promotions in the Offers category. Priority is for safety and trip alerts.';
  end if;
  return new;
end $$;
create trigger inbox_guard before insert or update on public.inbox_messages
  for each row execute function public.guard_inbox_category();

create function public.mark_inbox_read(p_ids uuid[]) returns int
language sql security definer set search_path = public as $$
  with ins as (
    insert into public.inbox_reads (message_id, guest_id)
    select m.id, auth.uid() from public.inbox_messages m
     where m.id = any (p_ids) and (m.guest_id is null or m.guest_id = auth.uid())
    on conflict do nothing returning 1
  ) select count(*)::int from ins;
$$;

-- =====================================================================================
-- System messages (automatic)
-- =====================================================================================
create function public.inbox_system(p_guest uuid, p_category text, p_title text, p_body text, p_cta_label text, p_cta_path text, p_expires interval)
returns void language sql security definer set search_path = public as $$
  insert into public.inbox_messages (guest_id, category, title, body, cta_label, cta_path, source, expires_at)
  values (p_guest, p_category, p_title, p_body, p_cta_label, p_cta_path, 'system', case when p_expires is null then null else now() + p_expires end);
$$;

-- Captains report rough water → priority alert for everyone (once per area per 2 hours).
create function public.inbox_on_sea_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_area text := initcap(new.area);
begin
  if new.state = 'rough' and not exists (
    select 1 from public.inbox_messages where source = 'system' and category = 'priority' and guest_id is null
       and title like 'Rough water%' and body like '%' || v_area || ' side%' and created_at > now() - interval '2 hours'
  ) then
    perform public.inbox_system(null, 'priority', 'Rough water reported',
      'Captains report rough water on the ' || v_area || ' side. Boats on that route are paused; take a land taxi or plan on the calm side.',
      'See sea conditions', '/', interval '3 hours');
  end if;
  return new;
end $$;
create trigger sea_report_inbox after insert on public.sea_reports for each row execute function public.inbox_on_sea_report();

-- A pickup credit was issued → personal update.
create function public.inbox_on_credit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.inbox_system(new.guest_id, 'update', 'Ride credit added',
    'We missed your pickup window, so we added a $' || trim(to_char(new.amount_usd, 'FM999990.00')) || ' credit to your account. Sorry about that.',
    'See my trips', '/trips', interval '30 days');
  return new;
end $$;
create trigger credit_inbox after insert on public.ride_credits for each row execute function public.inbox_on_credit();

-- Booking paid → "your ticket is ready"; group split expired → priority to the organizer; refund → update.
create function public.inbox_on_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.listings where id = new.listing_id;
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform public.inbox_system(new.guest_id, 'update', 'Your ticket is ready',
      v_name || ' on ' || new.trip_date || ' at ' || new.trip_time || '. Your ticket works offline: open it from Trips.',
      'Open ticket', '/ticket/' || new.id, interval '7 days');
  elsif new.status = 'cancelled' and old.status = 'awaiting_payment'
        and exists (select 1 from public.booking_splits s where s.booking_id = new.id and s.status = 'expired') then
    perform public.inbox_system(new.guest_id, 'priority', 'Group booking cancelled',
      'Not everyone paid for ' || v_name || ' in time, so the booking was cancelled. Everyone who paid is being refunded automatically.',
      'See my trips', '/trips', interval '7 days');
  end if;
  return new;
end $$;
create trigger booking_inbox after update of status on public.bookings for each row execute function public.inbox_on_booking();

create function public.inbox_on_refund() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.refunded_at is not null and old.refunded_at is null then
    perform public.inbox_system(new.guest_id, 'update', 'Refund sent',
      'We refunded $' || trim(to_char(coalesce(new.paid_amount_cents, new.amount_cents) / 100.0, 'FM999990.00')) || ' to your card. Banks usually show it within 5–10 days.',
      null, null, interval '30 days');
  end if;
  return new;
end $$;
create trigger refund_inbox after update of refunded_at on public.payments for each row execute function public.inbox_on_refund();

revoke all on function public.inbox_system(uuid, text, text, text, text, text, interval) from public, anon, authenticated;
grant execute on function public.mark_inbox_read(uuid[]) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.inbox_messages;
  end if;
end $$;
