-- Crew: the owner's captains (water taxi, fishing, snorkel).
-- Guests see names and a "Certified" badge; licence numbers stay private (admins only).
-- A captain can only accept paying water-taxi rides once the office has verified a current licence.

create table public.crew (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  display_name text not null check (length(display_name) between 2 and 40),
  roles text[] not null check (cardinality(roles) > 0 and roles <@ array['taxi', 'fishing', 'snorkel']::text[]),
  license_no text check (license_no is null or length(license_no) between 3 and 40),
  license_expires date,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  -- Linked when the captain signs in to the captain app (set by an admin).
  profile_id uuid unique references public.profiles (id) on delete set null,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint verified_needs_license check (verified_at is null or (license_no is not null and license_expires is not null))
);

alter table public.crew enable row level security;
create policy "admin crew" on public.crew for all using (public.is_admin()) with check (public.is_admin());
create policy "captain reads own crew row" on public.crew for select using (auth.uid() is not null and profile_id = auth.uid());

-- Certified = verified by the office AND the licence has not expired (island date).
create function public.crew_certified(c public.crew) returns boolean
language sql stable set search_path = public as $$
  select c.active and c.verified_at is not null and c.license_no is not null
     and c.license_expires >= (now() at time zone 'America/Tegucigalpa')::date;
$$;

-- Public roster for the app: names, roles, certified. Never licence numbers or who verified.
create function public.crew_public() returns table (id text, display_name text, roles text[], certified boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.display_name, c.roles, public.crew_certified(c)
    from public.crew c where c.active order by c.sort, c.display_name;
$$;
grant execute on function public.crew_public() to anon, authenticated;

-- Office marks a licence as checked.
create function public.verify_crew_license(p_crew text, p_license text, p_expires date) returns public.crew
language plpgsql security definer set search_path = public as $$
declare v public.crew;
begin
  if not public.is_admin() then raise exception 'admins_only' using errcode = '42501'; end if;
  if p_expires < (now() at time zone 'America/Tegucigalpa')::date then raise exception 'license_expired' using errcode = 'P0001'; end if;
  update public.crew set license_no = p_license, license_expires = p_expires, verified_at = now(), verified_by = auth.uid()
   where id = p_crew returning * into v;
  if v.id is null then raise exception 'crew_not_found' using errcode = 'P0002'; end if;
  return v;
end $$;
grant execute on function public.verify_crew_license(text, text, date) to authenticated;

-- Accept: same rules as before, plus the captain must be certified crew with the taxi role.
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
  if not exists (select 1 from public.crew c where c.profile_id = auth.uid() and 'taxi' = any (c.roles) and public.crew_certified(c)) then
    raise exception 'license_not_verified' using errcode = '42501';
  end if;

  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.id is null then raise exception 'ride_not_found' using errcode = 'P0002'; end if;
  if v_ride.status <> 'paid' or v_ride.captain_id is not null then
    raise exception 'ride_not_available' using errcode = 'P0001';
  end if;
  if v_ride.riders > v_boat.seats then raise exception 'boat_too_small' using errcode = 'P0001'; end if;
  if v_ride.needs_lit_boat and not v_boat.has_lights then raise exception 'needs_lit_boat' using errcode = 'P0001'; end if;

  update public.rides
     set status = 'accepted', captain_id = auth.uid(), boat_id = v_boat.id, accepted_at = now(),
         captain_confirmed_at = case when coalesce(pickup_at, now()) <= now() + interval '15 minutes' then now() else captain_confirmed_at end
   where id = p_ride_id
   returning * into v_ride;
  update public.boat_positions set available = false where boat_id = v_boat.id;
  return v_ride;
end $$;

-- Guests see the crew name they know ("Captain Fletcher"), not the account's legal name.
create or replace function public.ride_contact(p_ride_id uuid) returns table (captain_name text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select coalesce(c.display_name, p.full_name), p.whatsapp
    from public.rides r
    join public.profiles p on p.id = r.captain_id
    left join public.crew c on c.profile_id = r.captain_id
   where r.id = p_ride_id and r.guest_id = auth.uid() and r.status in ('accepted', 'onboard', 'completed');
$$;
