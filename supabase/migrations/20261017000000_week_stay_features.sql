-- =====================================================================================
-- Week-stay features: guaranteed pickups, night rides, shared seats, ride passes,
-- repeat rides + saved places, sea conditions, boats linked to activities.
-- Same principles as the first migration: RLS everywhere, state changes only through
-- server functions or the RPCs below, never by direct client writes.
-- =====================================================================================

-- ---------- Boats and rides: new columns ----------
alter table public.boats add column has_lights boolean not null default false;

create table public.guest_passes (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id),
  pass_type text not null check (pass_type in ('week', 'twoWeek', 'tenPack', 'family')),
  riders int not null check (riders between 1 and 12),
  price_usd numeric(10, 2) not null check (price_usd >= 0),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  rides_total int check (rides_total is null or rides_total > 0),
  rides_used int not null default 0,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'active', 'cancelled')),
  created_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check (rides_total is null or rides_used <= rides_total)
);
create index on public.guest_passes (guest_id, status);

create table public.shared_boats (
  id uuid primary key default gen_random_uuid(),
  from_dock text not null references public.docks (id),
  to_dock text not null references public.docks (id),
  departs_at timestamptz not null,
  seats_total int not null default 8 check (seats_total between 1 and 30),
  seats_taken int not null default 0,
  status text not null default 'open' check (status in ('open', 'full', 'departed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (seats_taken between 0 and seats_total)
);
create index on public.shared_boats (from_dock, to_dock, departs_at) where status = 'open';

create table public.repeat_rides (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id) on delete cascade,
  from_dock text not null references public.docks (id),
  to_dock text not null references public.docks (id),
  riders int not null check (riders between 1 and 12),
  pickup_time text not null check (pickup_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  weekdays int[] not null default '{}',
  start_date date not null,
  end_date date not null,
  -- Server-computed when the repeat ride is created (same pricing rules as a single ride).
  fare_usd numeric(10, 2) not null check (fare_usd >= 0),
  miles numeric(6, 2) not null,
  pass_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (from_dock <> to_dock),
  check (end_date >= start_date and end_date <= start_date + 45)
);

alter table public.rides
  add column pickup_at timestamptz,
  add column captain_confirmed_at timestamptz,
  add column reassign_count int not null default 0,
  add column needs_lit_boat boolean not null default false,
  add column share_token text unique,
  add column pass_id uuid references public.guest_passes (id),
  add column shared_boat_id uuid references public.shared_boats (id),
  add column booking_id uuid references public.bookings (id),
  add column repeat_id uuid references public.repeat_rides (id);
update public.rides set pickup_at = coalesce(scheduled_for, created_at) where pickup_at is null;
create unique index rides_one_per_repeat_slot on public.rides (repeat_id, pickup_at) where repeat_id is not null;

create table public.ride_credits (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id),
  ride_id uuid references public.rides (id),
  amount_usd numeric(10, 2) not null check (amount_usd > 0),
  reason text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create unique index ride_credits_one_per_ride_reason on public.ride_credits (ride_id, reason) where ride_id is not null;

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  dock_id text not null references public.docks (id),
  icon text not null default 'home' check (icon in ('home', 'dive', 'food', 'star')),
  created_at timestamptz not null default now(),
  unique (guest_id, label)
);

create table public.sea_reports (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('west', 'north', 'south')),
  state text not null check (state in ('calm', 'choppy', 'rough')),
  reported_by uuid references public.profiles (id),
  reported_at timestamptz not null default now()
);
create index on public.sea_reports (area, reported_at desc);

-- Payments can now pay for a pass too.
alter table public.payments add column pass_id uuid references public.guest_passes (id);
alter table public.payments drop constraint if exists payments_check;
alter table public.payments add constraint payments_one_target check (
  (case when ride_id is not null then 1 else 0 end) + (case when booking_id is not null then 1 else 0 end) + (case when pass_id is not null then 1 else 0 end) = 1
);

-- =====================================================================================
-- Row Level Security
-- =====================================================================================
alter table public.guest_passes enable row level security;
alter table public.shared_boats enable row level security;
alter table public.repeat_rides enable row level security;
alter table public.ride_credits enable row level security;
alter table public.saved_places enable row level security;
alter table public.sea_reports enable row level security;

create policy "own passes" on public.guest_passes for select using (guest_id = auth.uid() or public.is_admin());
create policy "own credits" on public.ride_credits for select using (guest_id = auth.uid() or public.is_admin());
-- Open shared boats are public (they hold no guest data) so the app can offer "join a boat leaving in 6 min".
create policy "read open shared boats" on public.shared_boats for select using (status in ('open', 'full') or public.is_admin());
create policy "read sea reports" on public.sea_reports for select using (true);

-- Saved places and repeat rides belong to the guest, who can create, edit and delete their own.
create policy "own places" on public.saved_places for all using (guest_id = auth.uid()) with check (guest_id = auth.uid());
create policy "own repeat rides read" on public.repeat_rides for select using (guest_id = auth.uid() or public.is_admin());
create policy "own repeat rides delete" on public.repeat_rides for delete using (guest_id = auth.uid());
create policy "own repeat rides pause" on public.repeat_rides for update using (guest_id = auth.uid()) with check (guest_id = auth.uid());
-- Repeat rides are created by the create-repeat-ride function (it validates docks and dates).

-- Guests can only flip `active` on their repeat rides, nothing else.
create function public.guard_repeat_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and
     (new.from_dock, new.to_dock, new.riders, new.pickup_time, new.weekdays, new.start_date, new.end_date, new.guest_id)
     is distinct from (old.from_dock, old.to_dock, old.riders, old.pickup_time, old.weekdays, old.start_date, old.end_date, old.guest_id) then
    raise exception 'only_pause_allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger repeat_rides_guard before update on public.repeat_rides for each row execute function public.guard_repeat_update();

-- =====================================================================================
-- Captain actions
-- =====================================================================================

-- Accept now also enforces night rules: rides after dark need a boat with running lights.
create or replace function public.accept_ride(p_ride_id uuid) returns public.rides
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
  if v_ride.needs_lit_boat and not v_boat.has_lights then raise exception 'needs_lit_boat' using errcode = 'P0001'; end if;

  update public.rides
     set status = 'accepted', captain_id = auth.uid(), boat_id = v_boat.id, accepted_at = now(),
         -- Rides leaving within 15 minutes count as confirmed on accept.
         captain_confirmed_at = case when coalesce(pickup_at, now()) <= now() + interval '15 minutes' then now() else captain_confirmed_at end
   where id = p_ride_id
   returning * into v_ride;
  update public.boat_positions set available = false where boat_id = v_boat.id;
  return v_ride;
end $$;

-- Guaranteed pickup: the assigned captain confirms he is on his way.
create function public.confirm_ride(p_ride_id uuid) returns public.rides
language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  update public.rides set captain_confirmed_at = now()
   where id = p_ride_id and captain_id = auth.uid() and status = 'accepted'
   returning * into v_ride;
  if v_ride.id is null then raise exception 'not_your_ride' using errcode = '42501'; end if;
  return v_ride;
end $$;

-- Sea conditions: only active captains can report.
create function public.report_sea(p_area text, p_state text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.boats where captain_id = auth.uid() and active) then
    raise exception 'not_a_captain' using errcode = '42501';
  end if;
  insert into public.sea_reports (area, state, reported_by) values (p_area, p_state, auth.uid());
end $$;

-- =====================================================================================
-- Guest actions
-- =====================================================================================

-- Share my ride: returns a secret token the guest can send to family.
create function public.enable_ride_share(p_ride_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  update public.rides
     set share_token = coalesce(share_token, encode(sha256((gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex'))
   where id = p_ride_id and guest_id = auth.uid()
   returning share_token into v_token;
  if v_token is null then raise exception 'not_your_ride' using errcode = '42501'; end if;
  return v_token;
end $$;

-- Anyone with the token (family at home, not signed in) sees the ride's status and the boat's live position.
-- Deliberately no guest name, no phone numbers, no price.
create function public.shared_ride_status(p_token text)
returns table (status public.ride_status, from_dock text, to_dock text, pickup_at timestamptz, boat_name text, lon double precision, lat double precision, position_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.status, r.from_dock, r.to_dock, r.pickup_at, b.name, p.lon, p.lat, p.updated_at
    from public.rides r
    left join public.boats b on b.id = r.boat_id
    left join public.boat_positions p on p.boat_id = r.boat_id
   where p_token is not null and length(p_token) >= 32 and r.share_token = p_token
     and r.status in ('paid', 'accepted', 'onboard')
     and r.pickup_at > now() - interval '12 hours';
$$;

-- =====================================================================================
-- Server-only helpers (called by edge functions and the scheduler)
-- =====================================================================================

-- Uses one ride from a pass if it is active, unexpired and not used up. Row lock prevents double use.
create function public.consume_pass_ride(p_pass_id uuid, p_guest uuid, p_at timestamptz) returns boolean
language plpgsql security definer set search_path = public as $$
declare v public.guest_passes;
begin
  select * into v from public.guest_passes where id = p_pass_id and guest_id = p_guest for update;
  if v.id is null or v.status <> 'active' or p_at < v.starts_at or p_at > v.expires_at then return false; end if;
  if v.rides_total is not null and v.rides_used >= v.rides_total then return false; end if;
  update public.guest_passes set rides_used = rides_used + 1 where id = p_pass_id;
  return true;
end $$;

-- Joins an open shared boat for the route, or opens a new one. Returns the shared boat id.
create function public.take_shared_seats(p_from text, p_to text, p_riders int, p_wait_minutes int, p_depart_at int) returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.shared_boats;
begin
  select * into v from public.shared_boats
   where from_dock = p_from and to_dock = p_to and status = 'open'
     and departs_at between now() and now() + make_interval(mins => p_wait_minutes)
     and seats_total - seats_taken >= p_riders
   order by departs_at limit 1 for update skip locked;
  if v.id is null then
    insert into public.shared_boats (from_dock, to_dock, departs_at, seats_taken)
    values (p_from, p_to, now() + make_interval(mins => p_wait_minutes), p_riders) returning * into v;
  else
    update public.shared_boats set seats_taken = seats_taken + p_riders where id = v.id returning * into v;
  end if;
  -- Enough riders: the boat leaves now.
  if v.seats_taken >= p_depart_at then
    update public.shared_boats set departs_at = least(departs_at, now()), status = 'full' where id = v.id;
  end if;
  return v.id;
end $$;

-- Runs every minute (pg_cron, see docs/BACKEND.md):
--  * unconfirmed rides 15 min before pickup go back to the queue for another captain,
--  * guaranteed rides nobody picked up 10 min after pickup time get a credit,
--  * repeat rides for the next 24 hours become real rides,
--  * shared boats past departure are closed.
create function public.run_pickup_watchdog(p_credit_usd numeric default 10, p_confirm_minutes int default 15, p_grace_minutes int default 10)
returns table (reassigned int, credited int, created int)
language plpgsql security definer set search_path = public as $$
declare
  v_reassigned int := 0;
  v_credited int := 0;
  v_created int := 0;
  r record;
begin
  -- 1) Reassign: accepted, not confirmed, pickup within the confirm window. Free the captain's boat.
  for r in
    select id, boat_id from public.rides
     where status = 'accepted' and captain_confirmed_at is null
       and pickup_at <= now() + make_interval(mins => p_confirm_minutes) and pickup_at > now() - interval '2 hours'
     for update
  loop
    update public.rides
       set status = 'paid', captain_id = null, boat_id = null, accepted_at = null, reassign_count = reassign_count + 1
     where id = r.id;
    update public.boat_positions set available = true where boat_id = r.boat_id;
    v_reassigned := v_reassigned + 1;
  end loop;

  -- 2) Credit missed guaranteed pickups (scheduled rides still not aboard after the grace period).
  with x as (
    insert into public.ride_credits (guest_id, ride_id, amount_usd, reason)
    select guest_id, id, p_credit_usd, 'missed_pickup'
      from public.rides
     where timing = 'scheduled' and status in ('paid', 'accepted')
       and pickup_at < now() - make_interval(mins => p_grace_minutes) and pickup_at > now() - interval '6 hours'
    on conflict do nothing
    returning 1
  ) select count(*) into v_credited from x;

  -- 3) Materialize repeat rides for the next 24 hours (Roatán is UTC-6, no daylight saving).
  for r in
    select rr.*, (d::date + rr.pickup_time::time) at time zone 'America/Tegucigalpa' as at
      from public.repeat_rides rr,
           generate_series(greatest(rr.start_date, (now() at time zone 'America/Tegucigalpa')::date),
                           least(rr.end_date, (now() at time zone 'America/Tegucigalpa')::date + 1), interval '1 day') d
     where rr.active
       and (cardinality(rr.weekdays) = 0 or extract(dow from d)::int = any (rr.weekdays))
  loop
    if r.at > now() + interval '20 minutes' and r.at <= now() + interval '24 hours'
       and not exists (select 1 from public.rides x where x.repeat_id = r.id and x.pickup_at = r.at) then
      -- A pass pays for the ride if it still can; otherwise the guest is asked to pay in the app.
      if r.pass_id is not null and public.consume_pass_ride(r.pass_id, r.guest_id, r.at) then
        insert into public.rides (guest_id, from_dock, to_dock, riders, mode, timing, scheduled_for, pickup_at, miles, fare_usd, status, paid_at, repeat_id, pass_id)
        values (r.guest_id, r.from_dock, r.to_dock, r.riders, 'private', 'scheduled', r.at, r.at, r.miles, 0, 'paid', now(), r.id, r.pass_id);
      else
        insert into public.rides (guest_id, from_dock, to_dock, riders, mode, timing, scheduled_for, pickup_at, miles, fare_usd, status, repeat_id)
        values (r.guest_id, r.from_dock, r.to_dock, r.riders, 'private', 'scheduled', r.at, r.at, r.miles, r.fare_usd, 'awaiting_payment', r.id);
      end if;
      v_created := v_created + 1;
    end if;
  end loop;

  -- 4) Close shared boats that have left.
  update public.shared_boats set status = 'departed' where status in ('open', 'full') and departs_at < now() - interval '5 minutes';

  return query select v_reassigned, v_credited, v_created;
end $$;

-- Payment webhook now also activates passes.
create or replace function public.mark_payment_succeeded(p_payment_id uuid, p_provider_ref text) returns void
language plpgsql security definer set search_path = public as $$
declare v_pay public.payments;
begin
  update public.payments set status = 'succeeded', provider_ref = p_provider_ref, updated_at = now()
   where id = p_payment_id and status = 'pending' returning * into v_pay;
  if v_pay.id is null then return; end if;
  if v_pay.ride_id is not null then
    update public.rides set status = 'paid', paid_at = now() where id = v_pay.ride_id and status = 'awaiting_payment';
  elsif v_pay.booking_id is not null then
    update public.bookings set status = 'paid', paid_at = now()
     where id = v_pay.booking_id and status in ('awaiting_payment', 'quoted');
  else
    update public.guest_passes set status = 'active' where id = v_pay.pass_id and status = 'awaiting_payment';
  end if;
end $$;

revoke all on function public.consume_pass_ride(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.take_shared_seats(text, text, int, int, int) from public, anon, authenticated;
revoke all on function public.run_pickup_watchdog(numeric, int, int) from public, anon, authenticated;
revoke all on function public.mark_payment_succeeded(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_ride(uuid) to authenticated;
grant execute on function public.report_sea(text, text) to authenticated;
grant execute on function public.enable_ride_share(uuid) to authenticated;
grant execute on function public.shared_ride_status(text) to anon, authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shared_boats, public.sea_reports;
  end if;
end $$;
