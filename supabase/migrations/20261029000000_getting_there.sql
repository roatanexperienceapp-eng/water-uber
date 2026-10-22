-- Getting guests to their tour or ride.
--  1) Cruise-port van: cruise guests add our van (port gate → tour → port gate) to an instant booking.
--     Price and times are set by the create-booking function, never by the app.
--  2) Guest location sharing: opt-in, only on a day the guest has a paid trip, only on the island.
--     The office and our crew see who is on the way and how far they are. Stopping clears the position.

alter table public.bookings
  add column van_seats int check (van_seats is null or van_seats between 1 and 60),
  add column van_usd numeric(10, 2) check (van_usd is null or van_usd >= 0),
  add column van_pickup_at timestamptz,
  add column van_return_at timestamptz,
  add constraint van_all_or_nothing check (
    (van_seats is null) = (van_usd is null) and (van_seats is null) = (van_pickup_at is null) and (van_seats is null) = (van_return_at is null)
  ),
  add constraint van_needs_ship check (van_seats is null or ship_call_id is not null);

-- ---------- Guest positions ----------
create table public.guest_positions (
  guest_id uuid primary key references public.profiles (id) on delete cascade,
  lat double precision check (lat is null or lat between 15.8 and 16.7),
  lon double precision check (lon is null or lon between -87.1 and -85.7),
  accuracy_m int check (accuracy_m is null or accuracy_m between 0 and 5000),
  sharing boolean not null default false,
  updated_at timestamptz not null default now(),
  check (sharing = (lat is not null and lon is not null))
);
alter table public.guest_positions enable row level security;
create policy "guest reads own position" on public.guest_positions for select using (guest_id = auth.uid());
-- No insert/update/delete policies: writes go through the functions below.

-- True when the guest has a paid booking or ride today (Roatán date), or before 3 am tomorrow.
create function public.has_trip_today(p_guest uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with d as (select (now() at time zone 'America/Tegucigalpa')::date as today)
  select exists (
      select 1 from public.bookings b, d
       where b.guest_id = p_guest and b.status = 'paid' and b.trip_date = d.today)
    or exists (
      select 1 from public.rides r, d
       where r.guest_id = p_guest and r.status in ('paid', 'accepted', 'onboard')
         and (coalesce(r.scheduled_for, r.created_at) at time zone 'America/Tegucigalpa')::date = d.today);
$$;
revoke execute on function public.has_trip_today(uuid) from public, anon, authenticated;

create function public.share_position(p_lat double precision, p_lon double precision, p_accuracy_m int default null)
returns public.guest_positions
language plpgsql security definer set search_path = public as $$
declare v public.guest_positions;
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode = '42501'; end if;
  if p_lat is null or p_lon is null or p_lat not between 15.8 and 16.7 or p_lon not between -87.1 and -85.7 then
    raise exception 'off_island' using errcode = 'P0001';
  end if;
  if not public.has_trip_today(auth.uid()) then raise exception 'no_trip_today' using errcode = 'P0001'; end if;
  insert into public.guest_positions (guest_id, lat, lon, accuracy_m, sharing, updated_at)
  values (auth.uid(), p_lat, p_lon, least(greatest(p_accuracy_m, 0), 5000), true, now())
  on conflict (guest_id) do update
    set lat = excluded.lat, lon = excluded.lon, accuracy_m = excluded.accuracy_m, sharing = true, updated_at = now()
  returning * into v;
  return v;
end $$;
revoke execute on function public.share_position(double precision, double precision, int) from public, anon;
grant execute on function public.share_position(double precision, double precision, int) to authenticated;

-- Stop sharing: the position is wiped, not just hidden.
create function public.stop_sharing_position() returns void
language sql security definer set search_path = public as $$
  update public.guest_positions set lat = null, lon = null, accuracy_m = null, sharing = false, updated_at = now()
   where guest_id = auth.uid();
$$;
revoke execute on function public.stop_sharing_position() from public, anon;
grant execute on function public.stop_sharing_position() to authenticated;

-- ---------- Crew: today's guests and where they are ----------
-- Admins see every paid trip today. Linked, active crew see water taxi rides, our own tours and van guests.
-- Positions older than 2 hours are not shown. Guest WhatsApp is shown because the trip is paid.
create function public.guests_on_the_way()
returns table (
  kind text, trip_id uuid, title text, area text, starts_at timestamptz, people int,
  from_dock text, to_dock text, ship_name text, ship_port text, van_pickup_at timestamptz, van_return_at timestamptz,
  guest_name text, guest_whatsapp text, lat double precision, lon double precision, position_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_admin boolean := public.is_admin();
  v_crew boolean := exists (select 1 from public.crew c where c.profile_id = auth.uid() and c.active);
  v_today date := (now() at time zone 'America/Tegucigalpa')::date;
begin
  if auth.uid() is null or not (v_admin or v_crew) then raise exception 'crew_only' using errcode = '42501'; end if;
  return query
    select 'booking'::text, b.id, l.name, l.area,
           (b.trip_date + b.trip_time::time) at time zone 'America/Tegucigalpa',
           b.quantity, null::text, null::text, s.ship_name, s.port, b.van_pickup_at, b.van_return_at,
           split_part(coalesce(p.full_name, ''), ' ', 1), coalesce(p.whatsapp, p.phone),
           case when gp.updated_at > now() - interval '2 hours' then gp.lat end,
           case when gp.updated_at > now() - interval '2 hours' then gp.lon end,
           case when gp.updated_at > now() - interval '2 hours' then gp.updated_at end
      from public.bookings b
      join public.listings l on l.id = b.listing_id
      join public.profiles p on p.id = b.guest_id
      left join public.ship_calls s on s.id = b.ship_call_id
      left join public.guest_positions gp on gp.guest_id = b.guest_id and gp.sharing
     where b.status = 'paid' and b.trip_date = v_today
       and (v_admin or l.ours or b.van_seats is not null)
    union all
    select 'ride'::text, r.id, null::text, null::text, coalesce(r.scheduled_for, r.created_at),
           r.riders, r.from_dock, r.to_dock, null::text, null::text, null::timestamptz, null::timestamptz,
           split_part(coalesce(p.full_name, ''), ' ', 1), coalesce(p.whatsapp, p.phone),
           case when gp.updated_at > now() - interval '2 hours' then gp.lat end,
           case when gp.updated_at > now() - interval '2 hours' then gp.lon end,
           case when gp.updated_at > now() - interval '2 hours' then gp.updated_at end
      from public.rides r
      join public.profiles p on p.id = r.guest_id
      left join public.guest_positions gp on gp.guest_id = r.guest_id and gp.sharing
     where r.status in ('paid', 'accepted', 'onboard')
       and (coalesce(r.scheduled_for, r.created_at) at time zone 'America/Tegucigalpa')::date = v_today
     order by 5;
end $$;
revoke execute on function public.guests_on_the_way() from public, anon;
grant execute on function public.guests_on_the_way() to authenticated;

-- Account deletion wipes the position too (erase_guest marks profiles.deleted_at).
create function public.wipe_position_on_erase() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.guest_positions set lat = null, lon = null, accuracy_m = null, sharing = false, updated_at = now()
   where guest_id = new.id;
  return new;
end $$;
revoke execute on function public.wipe_position_on_erase() from public, anon, authenticated;
create trigger wipe_position_on_erase
  after update of deleted_at on public.profiles
  for each row when (new.deleted_at is not null and old.deleted_at is null)
  execute function public.wipe_position_on_erase();
