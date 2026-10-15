-- =====================================================================================
-- Water taxi + island guide: initial schema
-- Principles:
--   * Clients never set prices or statuses directly. Edge functions (service role) create
--     rides/bookings with server-computed prices; state changes go through the RPCs below.
--   * Row Level Security is ON for every table. Default is deny.
--   * Operator/captain contact details are only revealed to a guest after payment.
-- =====================================================================================


-- ---------- Enums ----------
create type public.user_role as enum ('guest', 'captain', 'operator', 'admin');
create type public.boat_kind as enum ('taxi', 'tour', 'fish');
create type public.portal_kind as enum ('book', 'info');
create type public.booking_mode as enum ('instant', 'request', 'info');
create type public.price_unit as enum ('person', 'boat', 'day', 'ski');
create type public.ride_mode as enum ('shared', 'private');
create type public.ride_timing as enum ('now', 'scheduled');
-- awaiting_payment -> paid -> accepted -> onboard -> completed ; cancelled from any pre-onboard state
create type public.ride_status as enum ('awaiting_payment', 'paid', 'accepted', 'onboard', 'completed', 'cancelled');
-- requested (concierge confirms) -> quoted -> paid ; instant listings go straight to awaiting_payment
create type public.booking_status as enum ('requested', 'quoted', 'awaiting_payment', 'paid', 'cancelled', 'completed');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

-- ---------- People ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'guest',
  full_name text,
  phone text,
  whatsapp text,
  preferred_lang text not null default 'en',
  created_at timestamptz not null default now()
);

-- Create a profile row for every new auth user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Businesses and boats ----------
create table public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text,            -- revealed to a guest only after payment
  phone text,
  email text,
  is_partner boolean not null default false,  -- signed agreement; only partners get instant booking
  owner_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.boats (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references public.operators (id),
  captain_id uuid references public.profiles (id),
  name text not null,
  kind public.boat_kind not null default 'taxi',
  seats int not null check (seats between 1 and 60),
  license_no text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.boats (captain_id);

create table public.boat_positions (
  boat_id uuid primary key references public.boats (id) on delete cascade,
  lon double precision not null check (lon between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  heading real,
  speed_kmh real,
  online boolean not null default false,
  available boolean not null default true,
  updated_at timestamptz not null default now()
);

-- What the guest map shows: online boats with a fresh fix (< 2 minutes old).
create view public.live_boats with (security_invoker = true) as
  select b.id, b.name, b.kind, b.seats, p.available, p.lon, p.lat, p.updated_at
  from public.boats b
  join public.boat_positions p on p.boat_id = b.id
  where b.active and p.online and p.updated_at > now() - interval '2 minutes';

-- ---------- Places and catalogue ----------
create table public.docks (
  id text primary key,
  name text not null,
  lon double precision not null,
  lat double precision not null,
  in_flat_zone boolean not null default false,
  active boolean not null default true
);

create table public.portals (
  key text primary key,
  icon text not null,
  names jsonb not null,          -- {"en": "...", "es": "...", ...}
  kind public.portal_kind not null default 'book',
  sort int not null default 0,
  active boolean not null default true
);

create table public.listings (
  id text primary key,
  portal_key text not null references public.portals (key),
  operator_id uuid references public.operators (id),
  name text not null,
  area text not null,
  description text not null default '',
  price_usd numeric(10, 2) check (price_usd is null or price_usd >= 0),
  price_is_from boolean not null default false,
  price_text text,
  unit public.price_unit not null default 'person',
  rating numeric(2, 1),
  reviews int,
  phone text,                    -- public phone, for info listings (pharmacies, hospitals)
  lon double precision,
  lat double precision,
  tag text,
  ours boolean not null default false,
  booking public.booking_mode not null default 'request',
  active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create index on public.listings (portal_key) where active;

-- ---------- Rides (water taxi) ----------
create table public.rides (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id),
  from_dock text not null references public.docks (id),
  to_dock text not null references public.docks (id),
  riders int not null check (riders between 1 and 12),
  mode public.ride_mode not null,
  timing public.ride_timing not null,
  scheduled_for timestamptz,
  has_kids boolean not null default false,
  needs_towels boolean not null default false,
  miles numeric(6, 2) not null,
  fare_usd numeric(10, 2) not null check (fare_usd >= 0),
  status public.ride_status not null default 'awaiting_payment',
  boat_id uuid references public.boats (id),
  captain_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  check (from_dock <> to_dock),
  check ((timing = 'scheduled') = (scheduled_for is not null))
);
create index on public.rides (guest_id, created_at desc);
create index on public.rides (status) where status in ('paid', 'accepted', 'onboard');

-- ---------- Bookings (tours, rentals, everything else) ----------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id),
  listing_id text not null references public.listings (id),
  trip_date date not null,
  trip_time text not null,
  quantity int not null check (quantity between 1 and 60),
  total_usd numeric(10, 2) check (total_usd is null or total_usd >= 0),
  status public.booking_status not null,
  guest_note text,
  ops_note text,                 -- internal note from the concierge team
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index on public.bookings (guest_id, created_at desc);
create index on public.bookings (status) where status in ('requested', 'quoted');

-- ---------- Payments ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id),
  ride_id uuid references public.rides (id),
  booking_id uuid references public.bookings (id),
  amount_usd numeric(10, 2) not null check (amount_usd > 0),
  provider text not null,
  provider_ref text,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((ride_id is null) <> (booking_id is null))
);
create unique index on public.payments (provider, provider_ref) where provider_ref is not null;

-- ---------- Assistant usage (rate limiting) ----------
create table public.assistant_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  requests int not null default 0,
  primary key (user_id, day)
);

-- =====================================================================================
-- Row Level Security
-- =====================================================================================
alter table public.profiles enable row level security;
alter table public.operators enable row level security;
alter table public.boats enable row level security;
alter table public.boat_positions enable row level security;
alter table public.docks enable row level security;
alter table public.portals enable row level security;
alter table public.listings enable row level security;
alter table public.rides enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.assistant_usage enable row level security;

-- Profiles: you see and edit yourself (not your role); admins see everyone.
create policy "own profile read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin profile update" on public.profiles for update using (public.is_admin());

-- Only admins (or the service role) may change anyone's role.
create function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'only_admin_can_change_role' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_role_change();

-- Operators: admins only (contact details are private until a guest pays).
create policy "admin operators" on public.operators for all using (public.is_admin()) with check (public.is_admin());

-- Boats: anyone can read active boats; admins manage.
create policy "read active boats" on public.boats for select using (active or public.is_admin());
create policy "admin boats" on public.boats for all using (public.is_admin()) with check (public.is_admin());

-- Boat positions: public read (powers the live map). Captains write only their own boat's row.
create policy "read positions" on public.boat_positions for select using (true);
create policy "captain writes own position" on public.boat_positions for insert
  with check (exists (select 1 from public.boats b where b.id = boat_id and b.captain_id = auth.uid() and b.active));
create policy "captain updates own position" on public.boat_positions for update
  using (exists (select 1 from public.boats b where b.id = boat_id and b.captain_id = auth.uid()))
  with check (exists (select 1 from public.boats b where b.id = boat_id and b.captain_id = auth.uid() and b.active));

-- Catalogue: public read of active rows; admins manage.
create policy "read docks" on public.docks for select using (active or public.is_admin());
create policy "admin docks" on public.docks for all using (public.is_admin()) with check (public.is_admin());
create policy "read portals" on public.portals for select using (active or public.is_admin());
create policy "admin portals" on public.portals for all using (public.is_admin()) with check (public.is_admin());
create policy "read listings" on public.listings for select using (active or public.is_admin());
create policy "admin listings" on public.listings for all using (public.is_admin()) with check (public.is_admin());

-- Rides: guests read their own; captains read paid rides waiting for a boat and rides assigned to them.
-- No insert/update policies: creation is via the create-ride function, changes via RPCs below.
create policy "guest reads own rides" on public.rides for select using (guest_id = auth.uid());
create policy "captain reads open and own rides" on public.rides for select using (
  captain_id = auth.uid()
  or (status = 'paid' and captain_id is null and exists (
        select 1 from public.boats b where b.captain_id = auth.uid() and b.active and b.kind = 'taxi'))
);
create policy "admin rides" on public.rides for all using (public.is_admin()) with check (public.is_admin());

-- Bookings and payments: guests read their own; admins everything.
create policy "guest reads own bookings" on public.bookings for select using (guest_id = auth.uid());
create policy "admin bookings" on public.bookings for all using (public.is_admin()) with check (public.is_admin());
create policy "guest reads own payments" on public.payments for select using (guest_id = auth.uid());
create policy "admin payments" on public.payments for select using (public.is_admin());

-- assistant_usage: no client access (service role only).

-- =====================================================================================
-- RPCs (the only way clients change ride state)
-- =====================================================================================

-- Captain accepts a paid ride. Row lock prevents two captains taking the same ride.
create function public.accept_ride(p_ride_id uuid) returns public.rides
language plpgsql security definer set search_path = public as $$
declare
  v_boat public.boats;
  v_ride public.rides;
begin
  select * into v_boat from public.boats
   where captain_id = auth.uid() and active and kind = 'taxi'
   order by created_at limit 1;
  if v_boat.id is null then raise exception 'not_a_captain' using errcode = '42501'; end if;

  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.id is null then raise exception 'ride_not_found' using errcode = 'P0002'; end if;
  if v_ride.status <> 'paid' or v_ride.captain_id is not null then
    raise exception 'ride_not_available' using errcode = 'P0001';
  end if;
  if v_ride.riders > v_boat.seats then raise exception 'boat_too_small' using errcode = 'P0001'; end if;

  update public.rides
     set status = 'accepted', captain_id = auth.uid(), boat_id = v_boat.id, accepted_at = now()
   where id = p_ride_id
   returning * into v_ride;
  update public.boat_positions set available = false where boat_id = v_boat.id;
  return v_ride;
end $$;

-- Captain marks guests aboard, then completed.
create function public.advance_ride(p_ride_id uuid, p_status public.ride_status) returns public.rides
language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.id is null or v_ride.captain_id is distinct from auth.uid() then
    raise exception 'not_your_ride' using errcode = '42501';
  end if;
  if not ((v_ride.status = 'accepted' and p_status = 'onboard')
       or (v_ride.status = 'onboard' and p_status = 'completed')) then
    raise exception 'bad_transition' using errcode = 'P0001';
  end if;
  update public.rides
     set status = p_status, completed_at = case when p_status = 'completed' then now() else completed_at end
   where id = p_ride_id returning * into v_ride;
  if p_status = 'completed' then
    update public.boat_positions set available = true where boat_id = v_ride.boat_id;
  end if;
  return v_ride;
end $$;

-- Guest cancels before the captain has them aboard. Refunds are handled by the ops team / payment function.
create function public.cancel_ride(p_ride_id uuid) returns public.rides
language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.id is null or v_ride.guest_id is distinct from auth.uid() then
    raise exception 'not_your_ride' using errcode = '42501';
  end if;
  if v_ride.status not in ('awaiting_payment', 'paid', 'accepted') then
    raise exception 'too_late_to_cancel' using errcode = 'P0001';
  end if;
  update public.rides set status = 'cancelled', cancelled_at = now() where id = p_ride_id returning * into v_ride;
  if v_ride.boat_id is not null then
    update public.boat_positions set available = true where boat_id = v_ride.boat_id;
  end if;
  return v_ride;
end $$;

-- Contact unlock: the captain's WhatsApp, only for the paying guest, only once paid and assigned.
create function public.ride_contact(p_ride_id uuid) returns table (captain_name text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select p.full_name, p.whatsapp
    from public.rides r join public.profiles p on p.id = r.captain_id
   where r.id = p_ride_id and r.guest_id = auth.uid() and r.status in ('accepted', 'onboard', 'completed');
$$;

-- Contact unlock for tours/rentals: the operator's WhatsApp after payment.
create function public.booking_contact(p_booking_id uuid) returns table (operator_name text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select o.name, o.whatsapp
    from public.bookings bk
    join public.listings l on l.id = bk.listing_id
    join public.operators o on o.id = l.operator_id
   where bk.id = p_booking_id and bk.guest_id = auth.uid() and bk.status in ('paid', 'completed');
$$;

-- Server-side only: called by the payment webhook after the processor confirms a charge.
create function public.mark_payment_succeeded(p_payment_id uuid, p_provider_ref text) returns void
language plpgsql security definer set search_path = public as $$
declare v_pay public.payments;
begin
  update public.payments set status = 'succeeded', provider_ref = p_provider_ref, updated_at = now()
   where id = p_payment_id and status = 'pending' returning * into v_pay;
  if v_pay.id is null then return; end if;  -- idempotent: webhook retries are harmless
  if v_pay.ride_id is not null then
    update public.rides set status = 'paid', paid_at = now() where id = v_pay.ride_id and status = 'awaiting_payment';
  else
    update public.bookings set status = 'paid', paid_at = now()
     where id = v_pay.booking_id and status in ('awaiting_payment', 'quoted');
  end if;
end $$;

revoke all on function public.mark_payment_succeeded(uuid, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.accept_ride(uuid) to authenticated;
grant execute on function public.advance_ride(uuid, public.ride_status) to authenticated;
grant execute on function public.cancel_ride(uuid) to authenticated;
grant execute on function public.ride_contact(uuid) to authenticated;
grant execute on function public.booking_contact(uuid) to authenticated;

-- Realtime: guests' maps and captains' request lists update live.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.boat_positions, public.rides;
  end if;
end $$;

-- Server-side only: counts assistant calls and returns false once the daily limit is reached.
create function public.bump_assistant_usage(p_user uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into public.assistant_usage (user_id, day, requests) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set requests = public.assistant_usage.requests + 1
  returning requests into v;
  return v <= p_limit;
end $$;
revoke all on function public.bump_assistant_usage(uuid, int) from public, anon, authenticated;
