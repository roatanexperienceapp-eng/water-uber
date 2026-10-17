-- Account page: emergency contact, notification choices, help requests, partner applications.

alter table public.profiles
  add column emergency_name text check (emergency_name is null or length(emergency_name) <= 80),
  add column emergency_phone text check (emergency_phone is null or emergency_phone ~ '^\+?[0-9 ()\-]{7,20}$'),
  -- Trip & safety alerts are on by default. Offers are OFF until the guest opts in
  -- (Apple App Review 4.5.4: promotional notifications need explicit consent).
  add column notify_trips boolean not null default true,
  add column notify_offers boolean not null default false,
  add column deleted_at timestamptz;

-- ---------- Help: guests write to the team; replies arrive in their Inbox (Support) ----------
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id),
  topic text not null check (topic in ('ride', 'tour', 'payment', 'lost', 'safety', 'other')),
  message text not null check (length(message) between 5 and 2000),
  ride_id uuid references public.rides (id),
  booking_id uuid references public.bookings (id),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now()
);
create index on public.support_requests (status, created_at);
alter table public.support_requests enable row level security;
create policy "own requests" on public.support_requests for select using (guest_id = auth.uid() or public.is_admin());
create policy "write request" on public.support_requests for insert with check (
  guest_id = auth.uid() and status = 'open'
  and (ride_id is null or exists (select 1 from public.rides r where r.id = ride_id and r.guest_id = auth.uid()))
  and (booking_id is null or exists (select 1 from public.bookings b where b.id = booking_id and b.guest_id = auth.uid()))
);
create policy "admin handles requests" on public.support_requests for update using (public.is_admin()) with check (public.is_admin());

-- Safety reports jump the queue: the guest gets an instant Priority acknowledgement.
create function public.support_ack() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.topic = 'safety' then
    perform public.inbox_system(new.guest_id, 'priority', 'We got your safety report',
      'Our team is on it now. If anyone is in danger, call 911 first.', null, null, interval '2 days');
  else
    perform public.inbox_system(new.guest_id, 'support', 'We got your message',
      'Thanks for writing. Our team replies here in your Inbox, usually within a few hours.', null, null, interval '7 days');
  end if;
  return new;
end $$;
create trigger support_request_ack after insert on public.support_requests for each row execute function public.support_ack();

-- ---------- "Drive with us" / "List your business" ----------
create table public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles (id),
  kind text not null check (kind in ('captain', 'business')),
  name text not null check (length(name) between 2 and 80),
  whatsapp text not null check (whatsapp ~ '^\+?[0-9 ()\-]{7,20}$'),
  business_name text check (business_name is null or length(business_name) <= 120),
  details text check (details is null or length(details) <= 1000),
  status text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.partner_applications enable row level security;
create policy "own applications" on public.partner_applications for select using (applicant_id = auth.uid() or public.is_admin());
create policy "apply" on public.partner_applications for insert with check (applicant_id = auth.uid() and status = 'new');
create policy "admin reviews" on public.partner_applications for update using (public.is_admin()) with check (public.is_admin());

-- ---------- Account deletion (server only; the delete-account function calls it) ----------
-- Personal data is erased. Payment and trip records stay (anonymous) because the law requires keeping them.
create function public.erase_guest(p_guest uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.rides where guest_id = p_guest and status in ('paid', 'accepted', 'onboard'))
     or exists (select 1 from public.bookings where guest_id = p_guest and status in ('paid', 'quoted', 'awaiting_payment', 'requested') and trip_date >= current_date) then
    return 'has_upcoming';
  end if;
  update public.profiles
     set full_name = null, phone = null, whatsapp = null, emergency_name = null, emergency_phone = null,
         notify_offers = false, deleted_at = now()
   where id = p_guest;
  delete from public.saved_places where guest_id = p_guest;
  delete from public.inbox_reads where guest_id = p_guest;
  delete from public.inbox_messages where guest_id = p_guest;
  update public.repeat_rides set active = false where guest_id = p_guest;
  update public.donations set message = null where donor_id = p_guest;
  update public.support_requests set message = '[deleted]' where guest_id = p_guest;
  return 'ok';
end $$;
revoke all on function public.erase_guest(uuid) from public, anon, authenticated;
