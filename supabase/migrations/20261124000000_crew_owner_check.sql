-- Owner-checked certification: the owner has personally checked a captain's licence but the
-- number and expiry are not on file yet. Valid until owner_check_until, then the captain must be
-- re-checked or the licence entered (verify_crew_license) to stay certified.
alter table public.crew
  add column verify_method text not null default 'licence' check (verify_method in ('licence', 'owner_check')),
  add column owner_check_until date;

alter table public.crew drop constraint verified_needs_license;
alter table public.crew add constraint verified_needs_proof check (
  verified_at is null
  or (license_no is not null and license_expires is not null)
  or (verify_method = 'owner_check' and owner_check_until is not null)
);

create or replace function public.crew_certified(c public.crew) returns boolean
language sql stable set search_path = public as $$
  select c.active and c.verified_at is not null and (
       (c.license_no is not null and c.license_expires >= (now() at time zone 'America/Tegucigalpa')::date)
    or (c.verify_method = 'owner_check' and c.owner_check_until >= (now() at time zone 'America/Tegucigalpa')::date)
  );
$$;

-- verify_crew_license (entering the real licence) switches a captain back to the licence method.
create or replace function public.verify_crew_license(p_crew text, p_license text, p_expires date) returns public.crew
language plpgsql security definer set search_path = public as $$
declare v public.crew;
begin
  if not public.is_admin() then raise exception 'admins_only' using errcode = '42501'; end if;
  if p_expires < (now() at time zone 'America/Tegucigalpa')::date then raise exception 'license_expired' using errcode = 'P0001'; end if;
  update public.crew set license_no = p_license, license_expires = p_expires, verified_at = now(), verified_by = auth.uid(),
         verify_method = 'licence', owner_check_until = null
   where id = p_crew returning * into v;
  if v.id is null then raise exception 'crew_not_found' using errcode = 'P0002'; end if;
  return v;
end $$;
