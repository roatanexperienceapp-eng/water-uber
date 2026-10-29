-- Land taxi: our own cars and vans, Uber-style.
-- Guest requests from their location (or a place) to a place; the server prices it (supabase/functions/_shared/land.ts);
-- the guest pays; a verified driver accepts; the guest sees the car coming; arrived → on board → completed.

-- ---------- Vehicles and drivers ----------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 40),
  kind text not null check (kind in ('car', 'van')),
  seats int not null check (seats between 1 and 15),
  plate text check (plate is null or length(plate) between 2 and 15),
  color text check (color is null or length(color) <= 20),
  -- The driver's account (set by an admin) and the name guests see.
  driver_id uuid unique references public.profiles (id) on delete set null,
  driver_name text check (driver_name is null or length(driver_name) between 2 and 40),
  -- Checked by the office; licence and permit numbers stay private (admins only).
  license_no text check (license_no is null or length(license_no) between 3 and 40),
  license_expires date,
  permit_no text check (permit_no is null or length(permit_no) between 2 and 40),
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint vehicle_verified_needs_license check (verified_at is null or (license_no is not null and license_expires is not null))
);
alter table public.vehicles enable row level security;
create policy "admin vehicles" on public.vehicles for all using (public.is_admin()) with check (public.is_admin());
create policy "driver reads own vehicle" on public.vehicles for select using (auth.uid() is not null and driver_id = auth.uid());

create function public.vehicle_certified(v public.vehicles) returns boolean
language sql stable set search_path = public as $$
  select v.active and v.driver_id is not null and v.verified_at is not null and v.license_no is not null
     and v.license_expires >= (now() at time zone 'America/Tegucigalpa')::date;
$$;

create function public.verify_vehicle(p_vehicle uuid, p_license text, p_expires date, p_permit text) returns public.vehicles
language plpgsql security definer set search_path = public as $$
declare v public.vehicles;
begin
  if not public.is_admin() then raise exception 'admins_only' using errcode = '42501'; end if;
  if p_expires < (now() at time zone 'America/Tegucigalpa')::date then raise exception 'license_expired' using errcode = 'P0001'; end if;
  update public.vehicles set license_no = p_license, license_expires = p_expires, permit_no = p_permit, verified_at = now(), verified_by = auth.uid()
   where id = p_vehicle returning * into v;
  if v.id is null then raise exception 'vehicle_not_found' using errcode = 'P0002'; end if;
  return v;
end $$;
revoke execute on function public.verify_vehicle(uuid, text, date, text) from public, anon;
grant execute on function public.verify_vehicle(uuid, text, date, text) to authenticated;

create table public.vehicle_positions (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  heading real,
  speed_kmh real,
  online boolean not null default false,
  available boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.vehicle_positions enable row level security;
create policy "driver reads own position" on public.vehicle_positions for select
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.driver_id = auth.uid()));
create policy "driver writes own position" on public.vehicle_positions for insert
  with check (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.driver_id = auth.uid() and v.active));
create policy "driver updates own position" on public.vehicle_positions for update
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.driver_id = auth.uid() and v.active))
  with check (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.driver_id = auth.uid() and v.active));

-- Cars on the map for guests: position and size only, never who is driving.
create function public.live_vehicles() returns table (id uuid, kind text, seats int, lat double precision, lon double precision, available boolean)
language sql stable security definer set search_path = public as $$
  select v.id, v.kind, v.seats, p.lat, p.lon, p.available
    from public.vehicles v join public.vehicle_positions p on p.vehicle_id = v.id
   where v.active and p.online and p.updated_at > now() - interval '2 minutes';
$$;
grant execute on function public.live_vehicles() to anon, authenticated;

-- ---------- Land rides ----------
create table public.land_rides (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id),
  pickup_lat double precision not null check (pickup_lat between 16.24 and 16.52),
  pickup_lon double precision not null check (pickup_lon between -86.65 and -86.18),
  pickup_label text not null check (length(pickup_label) between 1 and 80),
  dropoff_lat double precision not null check (dropoff_lat between 16.24 and 16.52),
  dropoff_lon double precision not null check (dropoff_lon between -86.65 and -86.18),
  dropoff_label text not null check (length(dropoff_label) between 1 and 80),
  riders int not null check (riders between 1 and 12),
  vehicle_kind text not null check (vehicle_kind in ('car', 'van')),
  timing public.ride_timing not null,
  scheduled_for timestamptz,
  km numeric(6, 1) not null check (km > 0),
  fare_usd numeric(10, 2) not null check (fare_usd >= 0),
  note text check (note is null or length(note) <= 300),
  status public.ride_status not null default 'awaiting_payment',
  vehicle_id uuid references public.vehicles (id),
  driver_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  accepted_at timestamptz,
  arrived_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  check ((timing = 'scheduled') = (scheduled_for is not null))
);
create index on public.land_rides (guest_id, created_at desc);
create index on public.land_rides (status) where status in ('paid', 'accepted', 'onboard');
alter table public.land_rides enable row level security;

create function public.is_land_driver() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vehicles where driver_id = auth.uid() and active);
$$;

create policy "guest reads own land rides" on public.land_rides for select using (guest_id = auth.uid());
create policy "admin reads land rides" on public.land_rides for select using (public.is_admin());
create policy "drivers see open and own land rides" on public.land_rides for select
  using (driver_id = auth.uid() or (status = 'paid' and driver_id is null and public.is_land_driver()));
-- No insert/update policies: rides are created by the create-land-ride function and changed through the functions below.

create function public.accept_land_ride(p_ride_id uuid) returns public.land_rides
language plpgsql security definer set search_path = public as $$
declare v_car public.vehicles; v_ride public.land_rides;
begin
  select * into v_car from public.vehicles where driver_id = auth.uid() and active;
  if v_car.id is null then raise exception 'not_a_driver' using errcode = '42501'; end if;
  if not public.vehicle_certified(v_car) then raise exception 'license_not_verified' using errcode = '42501'; end if;
  if exists (select 1 from public.land_rides where driver_id = auth.uid() and status in ('accepted', 'onboard')) then
    raise exception 'finish_current_ride' using errcode = 'P0001';
  end if;
  select * into v_ride from public.land_rides where id = p_ride_id for update;
  if v_ride.id is null then raise exception 'ride_not_found' using errcode = 'P0002'; end if;
  if v_ride.status <> 'paid' or v_ride.driver_id is not null then raise exception 'ride_not_available' using errcode = 'P0001'; end if;
  if v_ride.riders > v_car.seats or (v_ride.vehicle_kind = 'van' and v_car.kind <> 'van') then
    raise exception 'vehicle_too_small' using errcode = 'P0001';
  end if;
  update public.land_rides set status = 'accepted', driver_id = auth.uid(), vehicle_id = v_car.id, accepted_at = now()
   where id = p_ride_id returning * into v_ride;
  update public.vehicle_positions set available = false where vehicle_id = v_car.id;
  return v_ride;
end $$;

-- Driver at the pickup.
create function public.land_ride_arrived(p_ride_id uuid) returns public.land_rides
language plpgsql security definer set search_path = public as $$
declare v_ride public.land_rides;
begin
  update public.land_rides set arrived_at = coalesce(arrived_at, now())
   where id = p_ride_id and driver_id = auth.uid() and status = 'accepted' returning * into v_ride;
  if v_ride.id is null then raise exception 'bad_transition' using errcode = 'P0001'; end if;
  return v_ride;
end $$;

create function public.advance_land_ride(p_ride_id uuid, p_status public.ride_status) returns public.land_rides
language plpgsql security definer set search_path = public as $$
declare v_ride public.land_rides;
begin
  select * into v_ride from public.land_rides where id = p_ride_id for update;
  if v_ride.id is null or v_ride.driver_id is distinct from auth.uid() then raise exception 'not_your_ride' using errcode = '42501'; end if;
  if not ((v_ride.status = 'accepted' and p_status = 'onboard') or (v_ride.status = 'onboard' and p_status = 'completed')) then
    raise exception 'bad_transition' using errcode = 'P0001';
  end if;
  update public.land_rides
     set status = p_status,
         picked_up_at = case when p_status = 'onboard' then now() else picked_up_at end,
         completed_at = case when p_status = 'completed' then now() else completed_at end
   where id = p_ride_id returning * into v_ride;
  if p_status = 'completed' then
    update public.vehicle_positions set available = true where vehicle_id = v_ride.vehicle_id;
  end if;
  return v_ride;
end $$;

-- Guest cancels. Paid but no driver yet: refunded automatically. Driver already on the way: no automatic refund.
create function public.cancel_land_ride(p_ride_id uuid) returns public.land_rides
language plpgsql security definer set search_path = public as $$
declare v_ride public.land_rides; v_was public.ride_status;
begin
  select * into v_ride from public.land_rides where id = p_ride_id for update;
  if v_ride.id is null or v_ride.guest_id is distinct from auth.uid() then raise exception 'not_your_ride' using errcode = '42501'; end if;
  if v_ride.status not in ('awaiting_payment', 'paid', 'accepted') then raise exception 'too_late_to_cancel' using errcode = 'P0001'; end if;
  v_was := v_ride.status;
  update public.land_rides set status = 'cancelled', cancelled_at = now() where id = p_ride_id returning * into v_ride;
  if v_ride.vehicle_id is not null then
    update public.vehicle_positions set available = true where vehicle_id = v_ride.vehicle_id;
  end if;
  if v_was = 'paid' then
    perform public.request_refund(p.id, 'guest_cancelled_before_accept')
       from public.payments p where p.land_ride_id = p_ride_id and p.status = 'succeeded';
  end if;
  return v_ride;
end $$;

-- The guest's view of their driver: name, WhatsApp, car, and where it is now. Only once accepted.
create function public.land_ride_driver(p_ride_id uuid)
returns table (driver_name text, whatsapp text, vehicle_name text, vehicle_kind text, plate text, color text,
               lat double precision, lon double precision, position_at timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(v.driver_name, split_part(coalesce(p.full_name, ''), ' ', 1)), p.whatsapp, v.name, v.kind, v.plate, v.color,
         case when r.status in ('accepted', 'onboard') then vp.lat end,
         case when r.status in ('accepted', 'onboard') then vp.lon end,
         case when r.status in ('accepted', 'onboard') then vp.updated_at end
    from public.land_rides r
    join public.vehicles v on v.id = r.vehicle_id
    join public.profiles p on p.id = r.driver_id
    left join public.vehicle_positions vp on vp.vehicle_id = v.id
   where r.id = p_ride_id and r.guest_id = auth.uid() and r.status in ('accepted', 'onboard', 'completed');
$$;

-- Driver's view of the guest on an accepted ride: first name and WhatsApp.
create function public.land_ride_guest(p_ride_id uuid) returns table (guest_name text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select split_part(coalesce(p.full_name, ''), ' ', 1), coalesce(p.whatsapp, p.phone)
    from public.land_rides r join public.profiles p on p.id = r.guest_id
   where r.id = p_ride_id and r.driver_id = auth.uid() and r.status in ('accepted', 'onboard');
$$;

revoke execute on function public.is_land_driver() from public, anon;
revoke execute on function public.accept_land_ride(uuid) from public, anon;
revoke execute on function public.land_ride_arrived(uuid) from public, anon;
revoke execute on function public.advance_land_ride(uuid, public.ride_status) from public, anon;
revoke execute on function public.cancel_land_ride(uuid) from public, anon;
revoke execute on function public.land_ride_driver(uuid) from public, anon;
revoke execute on function public.land_ride_guest(uuid) from public, anon;
grant execute on function public.is_land_driver(), public.accept_land_ride(uuid), public.land_ride_arrived(uuid),
  public.advance_land_ride(uuid, public.ride_status), public.cancel_land_ride(uuid), public.land_ride_driver(uuid),
  public.land_ride_guest(uuid) to authenticated;

-- ---------- Payments ----------
alter table public.payments add column land_ride_id uuid references public.land_rides (id);
alter table public.payments drop constraint payments_one_target;
alter table public.payments add constraint payments_one_target check (
  (case when ride_id is not null then 1 else 0 end) + (case when booking_id is not null then 1 else 0 end)
  + (case when pass_id is not null then 1 else 0 end) + (case when donation_id is not null then 1 else 0 end)
  + (case when bundle_id is not null then 1 else 0 end) + (case when land_ride_id is not null then 1 else 0 end) = 1
);
create index on public.payments (land_ride_id) where land_ride_id is not null;

-- Payments for land rides mark the ride paid; land rides count like water rides in the giving totals.
create or replace function public.mark_payment_succeeded(p_payment_id uuid, p_provider_ref text, p_amount_cents int default null) returns text
language plpgsql security definer set search_path = public as $$
declare v_pay public.payments; v_s public.booking_splits; v_paid int; v_n int; v_r int;
begin
  -- A late success after we marked the checkout failed/expired still counts: the money arrived.
  update public.payments
     set status = 'succeeded', provider_ref = p_provider_ref, paid_amount_cents = coalesce(p_amount_cents, amount_cents), updated_at = now()
   where id = p_payment_id and status in ('pending', 'failed')
   returning * into v_pay;
  if v_pay.id is null then return 'already_processed'; end if;

  if p_amount_cents is not null and p_amount_cents <> v_pay.amount_cents then
    update public.payments set review_reason = 'amount_mismatch' where id = v_pay.id;
    return 'needs_review';
  end if;

  if v_pay.ride_id is not null then
    update public.rides set status = 'paid', paid_at = now() where id = v_pay.ride_id and status = 'awaiting_payment';
    get diagnostics v_n = row_count;
  elsif v_pay.land_ride_id is not null then
    update public.land_rides set status = 'paid', paid_at = now() where id = v_pay.land_ride_id and status = 'awaiting_payment';
    get diagnostics v_n = row_count;
  elsif v_pay.pass_id is not null then
    update public.guest_passes set status = 'active' where id = v_pay.pass_id and status = 'awaiting_payment';
    get diagnostics v_n = row_count;
  elsif v_pay.bundle_id is not null then
    -- Package: the pass and every tour in it are confirmed together.
    update public.bundles set status = 'paid', paid_at = now() where id = v_pay.bundle_id and status = 'awaiting_payment';
    get diagnostics v_n = row_count;
    if v_n > 0 then
      update public.guest_passes set status = 'active' where id = (select pass_id from public.bundles where id = v_pay.bundle_id) and status = 'awaiting_payment';
      update public.bookings set status = 'paid', paid_at = now() where bundle_id = v_pay.bundle_id and status = 'awaiting_payment';
    end if;
  elsif v_pay.donation_id is not null then
    update public.donations set status = 'paid', paid_at = now() where id = v_pay.donation_id and status = 'awaiting_payment';
    get diagnostics v_n = row_count;
  elsif v_pay.split_id is not null then
    select * into v_s from public.booking_splits where id = v_pay.split_id for update;
    select coalesce(sum(share_count), 0) into v_paid from public.payments where split_id = v_s.id and status = 'succeeded';
    if v_s.status <> 'open' or v_paid > v_s.shares then
      v_n := 0;  -- split expired, or this payment overpaid a full group: give it back
    else
      v_n := 1;
      if v_paid = v_s.shares then
        update public.booking_splits set status = 'complete' where id = v_s.id;
        update public.bookings set status = 'paid', paid_at = now() where id = v_s.booking_id and status = 'awaiting_payment';
      end if;
    end if;
  else
    update public.bookings set status = 'paid', paid_at = now()
     where id = v_pay.booking_id and status in ('awaiting_payment', 'quoted');
    get diagnostics v_n = row_count;
    if v_n > 0 and cardinality(v_pay.covers_ride_ids) > 0 then
      update public.rides set status = 'paid', paid_at = now() where id = any (v_pay.covers_ride_ids) and status = 'awaiting_payment';
      get diagnostics v_r = row_count;
      -- A linked ride was cancelled between checkout and payment: ops refunds that part by hand.
      if v_r < cardinality(v_pay.covers_ride_ids) then
        update public.payments set review_reason = 'linked_ride_not_payable' where id = v_pay.id;
      end if;
    end if;
  end if;

  -- Paid for something that was cancelled or already paid: refund automatically.
  if v_n = 0 then
    perform public.request_refund(v_pay.id, 'target_not_payable');
    return 'refund_requested';
  end if;
  return 'ok';
end $$;

create or replace function public.giving_owed() returns table (donations_cents bigint, earnings_cents bigint, pledge_cents bigint, transferred_cents bigint, owed_cents bigint)
language plpgsql stable security definer set search_path = public as $$
declare s public.giving_settings;
begin
  if not public.is_admin() then raise exception 'admins_only' using errcode = '42501'; end if;
  select * into s from public.giving_settings where id = 1;
  return query
  with paid as (
    select p.*, o.commission_pct, bu.pass_share_cents, bu.tours_share_cents
      from public.payments p
      left join public.bookings bk on bk.id = p.booking_id
      left join public.listings l on l.id = bk.listing_id
      left join public.operators o on o.id = l.operator_id
      left join public.bundles bu on bu.id = p.bundle_id
     where p.status = 'succeeded' and p.refunded_at is null and p.review_reason is null
  ), totals as (
    select coalesce(sum(paid_amount_cents) filter (where donation_id is not null), 0)::bigint as don,
           coalesce(sum(case
             when donation_id is not null then 0
             -- Package: the pass part counts like rides; the tours are the owner's own (100%).
             when bundle_id is not null then round(pass_share_cents * s.ride_platform_pct / 100) + tours_share_cents
             when ride_id is not null or pass_id is not null or land_ride_id is not null then round(paid_amount_cents * s.ride_platform_pct / 100)
             else round(paid_amount_cents * coalesce(commission_pct, 15) / 100) end), 0)::bigint as earn
      from paid
  )
  select t.don, t.earn, round(t.earn * s.pledge_pct / 100)::bigint,
         coalesce((select sum(round(amount_usd * 100)) from public.charity_transfers), 0)::bigint,
         (t.don + round(t.earn * s.pledge_pct / 100) - coalesce((select sum(round(amount_usd * 100)) from public.charity_transfers), 0))::bigint
    from totals t;
end $$;

revoke all on function public.mark_payment_succeeded(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.giving_owed() from public, anon;
grant execute on function public.giving_owed() to authenticated;
