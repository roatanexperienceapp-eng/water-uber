-- The office: owner, managers and team members sign in at roatanwatertaxi.com/office.
--
--   owner    everything: all bookings, all contacts, money, the owner's percentage, payouts, staff, activity log
--   manager  every booking (water taxi, land taxi, tours) with guest and provider contacts and fares;
--            no percentage, no splits, no payouts
--   team     tours and excursions only (the bookings table), with the guest contacts for those bookings
--
-- The office reads only through the security-definer functions below; each one checks the caller's role
-- first. Nothing here widens table access for guests, captains or drivers.

-- ---------- Staff ----------
create table public.staff (
  user_id uuid primary key references public.profiles (id),
  role text not null check (role in ('owner', 'manager', 'team')),
  display_name text not null check (length(display_name) between 2 and 60),
  active boolean not null default true,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create unique index staff_one_owner on public.staff (role) where role = 'owner' and active;
alter table public.staff enable row level security;
-- No direct table policies: the office uses the functions below.

-- People who signed up on the office page and wait for the owner to give them a role.
create table public.staff_requests (
  user_id uuid primary key references public.profiles (id),
  display_name text not null check (length(display_name) between 2 and 60),
  created_at timestamptz not null default now(),
  handled_at timestamptz             -- set when the owner approves or turns the request down
);
alter table public.staff_requests enable row level security;

create function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.staff where user_id = auth.uid() and active;
$$;
grant execute on function public.staff_role() to authenticated;

-- The owner is also an admin, so every existing admin screen and rule keeps working for them.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      or exists (select 1 from public.staff where user_id = auth.uid() and role = 'owner' and active);
$$;

create function public.office_require(allowed text[]) returns text
language plpgsql stable security definer set search_path = public as $$
declare r text := public.staff_role();
begin
  if r is null or not (r = any (allowed)) then
    raise exception 'office_forbidden' using errcode = '42501';
  end if;
  return r;
end $$;

-- ---------- Activity log ----------
create table public.office_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid references public.profiles (id),
  action text not null,
  detail jsonb not null default '{}'::jsonb
);
alter table public.office_log enable row level security;

create function public.office_note(p_action text, p_detail jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.office_log (user_id, action, detail) values (auth.uid(), p_action, coalesce(p_detail, '{}'::jsonb));
$$;
revoke execute on function public.office_note(text, jsonb) from public, anon, authenticated;

-- ---------- Business settings (owner only) ----------
create table public.business_settings (
  id boolean primary key default true check (id),
  -- The share the business keeps from every paid ride and booking; the rest goes to the captain, driver or operator.
  commission_pct numeric(5, 2) not null default 20 check (commission_pct between 0 and 100),
  captain_payout_days int not null default 3 check (captain_payout_days between 1 and 31),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);
insert into public.business_settings (id) values (true) on conflict do nothing;
alter table public.business_settings enable row level security;

-- ---------- Who ran a tour (so "who did what" covers excursions too) ----------
alter table public.bookings
  add column provider_operator_id uuid references public.operators (id),
  add column provider_captain_id uuid references public.profiles (id),
  add column handled_by uuid references public.profiles (id),
  add constraint booking_one_provider check (provider_operator_id is null or provider_captain_id is null);

-- ---------- Payouts ----------
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  payee_kind text not null check (payee_kind in ('captain', 'driver', 'operator')),
  payee_id uuid not null,           -- profiles.id for captains and drivers, operators.id for operators
  payee_name text not null,
  gross_usd numeric(10, 2) not null,
  commission_pct numeric(5, 2) not null,
  commission_usd numeric(10, 2) not null,
  amount_usd numeric(10, 2) not null,
  method text check (method is null or length(method) <= 40),
  reference text check (reference is null or length(reference) <= 80),
  paid_at timestamptz not null default now(),
  paid_by uuid references public.profiles (id)
);
create table public.payout_items (
  item_kind text not null check (item_kind in ('ride', 'land_ride', 'booking')),
  item_id uuid not null,
  payout_id uuid not null references public.payouts (id),
  gross_usd numeric(10, 2) not null,
  primary key (item_kind, item_id)  -- every ride or booking is paid out once
);
alter table public.payouts enable row level security;
alter table public.payout_items enable row level security;

-- Everything a provider has earned and not been paid for yet: completed and paid, not in payout_items.
create function public.office_owed_items()
returns table (payee_kind text, payee_id uuid, payee_name text, item_kind text, item_id uuid, gross_usd numeric, done_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'captain', r.captain_id,
         coalesce((select c.display_name from crew c where c.profile_id = r.captain_id), p.full_name, 'Captain'),
         'ride', r.id, r.fare_usd, coalesce(r.completed_at, r.paid_at)
    from rides r left join profiles p on p.id = r.captain_id
   where r.status = 'completed' and r.captain_id is not null and r.paid_at is not null
     and not exists (select 1 from payout_items i where i.item_kind = 'ride' and i.item_id = r.id)
  union all
  select 'driver', l.driver_id,
         coalesce((select v.driver_name from vehicles v where v.id = l.vehicle_id), p.full_name, 'Driver'),
         'land_ride', l.id, l.fare_usd, coalesce(l.completed_at, l.paid_at)
    from land_rides l left join profiles p on p.id = l.driver_id
   where l.status = 'completed' and l.driver_id is not null and l.paid_at is not null
     and not exists (select 1 from payout_items i where i.item_kind = 'land_ride' and i.item_id = l.id)
  union all
  select case when b.provider_captain_id is not null then 'captain' else 'operator' end,
         coalesce(b.provider_captain_id, b.provider_operator_id, li.operator_id),
         coalesce((select c.display_name from crew c where c.profile_id = b.provider_captain_id),
                  (select o.name from operators o where o.id = coalesce(b.provider_operator_id, li.operator_id)), 'Provider'),
         'booking', b.id, b.total_usd, coalesce(b.paid_at, b.created_at)
    from bookings b join listings li on li.id = b.listing_id
   where b.status = 'completed' and b.paid_at is not null and b.total_usd > 0
     and coalesce(b.provider_captain_id, b.provider_operator_id, li.operator_id) is not null
     and not exists (select 1 from payout_items i where i.item_kind = 'booking' and i.item_id = b.id);
$$;
revoke execute on function public.office_owed_items() from public, anon, authenticated;

-- ---------- Office functions ----------

-- Who am I in the office? Null role means "signed in, waiting for the owner".
create function public.office_me() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', public.staff_role(),
    'name', coalesce((select display_name from staff where user_id = auth.uid()), (select full_name from profiles where id = auth.uid())),
    'requested', exists (select 1 from staff_requests where user_id = auth.uid() and handled_at is null));
$$;
grant execute on function public.office_me() to authenticated;

create function public.office_request_access(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode = '42501'; end if;
  if public.staff_role() is not null then return; end if;
  insert into staff_requests (user_id, display_name) values (auth.uid(), trim(p_name))
    on conflict (user_id) do update set display_name = excluded.display_name, created_at = now(), handled_at = null;
end $$;
grant execute on function public.office_request_access(text) to authenticated;

-- The board: everything booked between two island dates. Team members get tours only and no money.
create function public.office_board(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r text := public.office_require(array['owner', 'manager', 'team']);
        money boolean := r in ('owner', 'manager');
        tz text := 'America/Tegucigalpa';
        out jsonb;
begin
  if p_to < p_from or p_to - p_from > 62 then raise exception 'bad_range' using errcode = '22023'; end if;
  select jsonb_build_object(
    'role', r,
    'rides', case when r = 'team' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'kind', 'ride', 'status', x.status, 'mode', x.mode,
        'at', coalesce(x.scheduled_for, x.paid_at, x.created_at),
        'from', fd.name, 'to', td.name, 'riders', x.riders,
        'fare', case when money then x.fare_usd end,
        'captain', coalesce((select c.display_name from crew c where c.profile_id = x.captain_id), cp.full_name),
        'captain_phone', coalesce(cp.whatsapp, cp.phone),
        'guest', g.full_name, 'guest_phone', coalesce(g.whatsapp, g.phone), 'guest_email', u.email,
        'accepted_at', x.accepted_at, 'completed_at', x.completed_at, 'cancelled_at', x.cancelled_at)
        order by coalesce(x.scheduled_for, x.paid_at, x.created_at))
      from rides x
      join docks fd on fd.id = x.from_dock join docks td on td.id = x.to_dock
      left join profiles g on g.id = x.guest_id left join auth.users u on u.id = x.guest_id
      left join profiles cp on cp.id = x.captain_id
      where x.status <> 'awaiting_payment'
        and (coalesce(x.scheduled_for, x.paid_at, x.created_at) at time zone tz)::date between p_from and p_to), '[]'::jsonb) end,
    'land_rides', case when r = 'team' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'kind', 'land_ride', 'status', x.status, 'vehicle_kind', x.vehicle_kind,
        'at', coalesce(x.scheduled_for, x.paid_at, x.created_at),
        'from', x.pickup_label, 'to', x.dropoff_label, 'riders', x.riders,
        'fare', case when money then x.fare_usd end,
        'driver', coalesce(v.driver_name, dp.full_name), 'vehicle', v.name, 'plate', v.plate,
        'driver_phone', coalesce(dp.whatsapp, dp.phone),
        'guest', g.full_name, 'guest_phone', coalesce(g.whatsapp, g.phone), 'guest_email', u.email,
        'accepted_at', x.accepted_at, 'completed_at', x.completed_at, 'cancelled_at', x.cancelled_at)
        order by coalesce(x.scheduled_for, x.paid_at, x.created_at))
      from land_rides x
      left join vehicles v on v.id = x.vehicle_id left join profiles dp on dp.id = x.driver_id
      left join profiles g on g.id = x.guest_id left join auth.users u on u.id = x.guest_id
      where x.status <> 'awaiting_payment'
        and (coalesce(x.scheduled_for, x.paid_at, x.created_at) at time zone tz)::date between p_from and p_to), '[]'::jsonb) end,
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', 'booking', 'status', b.status, 'date', b.trip_date, 'time', b.trip_time,
        'listing', li.name, 'portal', li.portal_key, 'area', li.area, 'quantity', b.quantity,
        'total', case when money then b.total_usd end,
        'guest', g.full_name, 'guest_phone', coalesce(g.whatsapp, g.phone), 'guest_email', u.email,
        'guest_note', b.guest_note, 'ops_note', b.ops_note,
        'checked_in_at', b.checked_in_at,
        'provider_operator_id', coalesce(b.provider_operator_id, li.operator_id),
        'provider_captain_id', b.provider_captain_id,
        'provider', coalesce((select c.display_name from crew c where c.profile_id = b.provider_captain_id),
                             (select o.name from operators o where o.id = coalesce(b.provider_operator_id, li.operator_id))),
        'provider_phone', coalesce((select coalesce(pp.whatsapp, pp.phone) from profiles pp where pp.id = b.provider_captain_id),
                                   (select coalesce(o.whatsapp, o.phone) from operators o where o.id = coalesce(b.provider_operator_id, li.operator_id))),
        'handled_by', (select s.display_name from staff s where s.user_id = b.handled_by))
        order by b.trip_date, b.trip_time)
      from bookings b join listings li on li.id = b.listing_id
      left join profiles g on g.id = b.guest_id left join auth.users u on u.id = b.guest_id
      where b.trip_date between p_from and p_to), '[]'::jsonb)
  ) into out;
  return out;
end $$;
grant execute on function public.office_board(date, date) to authenticated;

-- Who can run a tour: captains and operators, for the "assign provider" picker.
create function public.office_providers() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.staff_role() is null then null else jsonb_build_object(
    'captains', coalesce((select jsonb_agg(jsonb_build_object('id', c.profile_id, 'name', c.display_name) order by c.sort, c.display_name)
                            from crew c where c.active and c.profile_id is not null), '[]'::jsonb),
    'operators', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name) from operators o), '[]'::jsonb)) end;
$$;
grant execute on function public.office_providers() to authenticated;

-- Manage one tour booking: check in, mark done, note, who runs it. Money and cancellations stay with the owner.
create function public.office_update_booking(p_id uuid, p_action text, p_note text default null, p_provider_kind text default null, p_provider_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare r text := public.office_require(array['owner', 'manager', 'team']);
        b public.bookings;
begin
  select * into b from bookings where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_action = 'check_in' then
    if b.status <> 'paid' then raise exception 'not_paid' using errcode = '22023'; end if;
    update bookings set checked_in_at = coalesce(checked_in_at, now()), handled_by = auth.uid() where id = p_id;
  elsif p_action = 'complete' then
    if b.status <> 'paid' then raise exception 'not_paid' using errcode = '22023'; end if;
    update bookings set status = 'completed', handled_by = auth.uid() where id = p_id;
  elsif p_action = 'note' then
    update bookings set ops_note = nullif(left(trim(coalesce(p_note, '')), 500), ''), handled_by = auth.uid() where id = p_id;
  elsif p_action = 'provider' then
    if p_provider_kind = 'captain' and exists (select 1 from crew where profile_id = p_provider_id) then
      update bookings set provider_captain_id = p_provider_id, provider_operator_id = null, handled_by = auth.uid() where id = p_id;
    elsif p_provider_kind = 'operator' and exists (select 1 from operators where id = p_provider_id) then
      update bookings set provider_operator_id = p_provider_id, provider_captain_id = null, handled_by = auth.uid() where id = p_id;
    elsif p_provider_kind is null then
      update bookings set provider_operator_id = null, provider_captain_id = null, handled_by = auth.uid() where id = p_id;
    else
      raise exception 'bad_provider' using errcode = '22023';
    end if;
  else
    raise exception 'bad_action' using errcode = '22023';
  end if;
  perform public.office_note('booking.' || p_action, jsonb_build_object('booking', p_id, 'role', r, 'provider_kind', p_provider_kind, 'provider', p_provider_id));
end $$;
grant execute on function public.office_update_booking(uuid, text, text, text, uuid) to authenticated;

-- Who did what: captains, drivers and operators with their work in a date range. Earnings for the owner only.
create function public.office_people(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r text := public.office_require(array['owner', 'manager']);
        tz text := 'America/Tegucigalpa';
        pct numeric := (select commission_pct from business_settings);
        out jsonb;
begin
  select jsonb_build_object(
    'captains', coalesce((select jsonb_agg(row_to_json(t)::jsonb order by t.name) from (
      select c.display_name as name, coalesce(p.whatsapp, p.phone) as phone, u.email,
             public.crew_certified(c) as certified, c.active,
             (select count(*) from rides x where x.captain_id = c.profile_id and x.status = 'completed'
                and (x.completed_at at time zone tz)::date between p_from and p_to) as rides_done,
             (select count(*) from bookings b where b.provider_captain_id = c.profile_id and b.status = 'completed'
                and b.trip_date between p_from and p_to) as tours_done,
             (select count(*) from rides x where x.captain_id = c.profile_id and x.status = 'cancelled' and x.accepted_at is not null
                and (x.cancelled_at at time zone tz)::date between p_from and p_to) as cancelled_after_accept,
             case when r = 'owner' then round((
               coalesce((select sum(x.fare_usd) from rides x where x.captain_id = c.profile_id and x.status = 'completed'
                 and (x.completed_at at time zone tz)::date between p_from and p_to), 0)
             + coalesce((select sum(b.total_usd) from bookings b where b.provider_captain_id = c.profile_id and b.status = 'completed'
                 and b.trip_date between p_from and p_to), 0)) * (100 - pct) / 100, 2) end as earned
        from crew c left join profiles p on p.id = c.profile_id left join auth.users u on u.id = c.profile_id) t), '[]'::jsonb),
    'drivers', coalesce((select jsonb_agg(row_to_json(t)::jsonb order by t.name) from (
      select coalesce(v.driver_name, p.full_name, v.name) as name, v.name as vehicle, v.plate,
             coalesce(p.whatsapp, p.phone) as phone, u.email, public.vehicle_certified(v) as certified, v.active,
             (select count(*) from land_rides x where x.driver_id = v.driver_id and x.status = 'completed'
                and (x.completed_at at time zone tz)::date between p_from and p_to) as rides_done,
             (select count(*) from land_rides x where x.driver_id = v.driver_id and x.status = 'cancelled' and x.accepted_at is not null
                and (x.cancelled_at at time zone tz)::date between p_from and p_to) as cancelled_after_accept,
             case when r = 'owner' then round(coalesce((select sum(x.fare_usd) from land_rides x where x.driver_id = v.driver_id
                and x.status = 'completed' and (x.completed_at at time zone tz)::date between p_from and p_to), 0) * (100 - pct) / 100, 2) end as earned
        from vehicles v left join profiles p on p.id = v.driver_id left join auth.users u on u.id = v.driver_id) t), '[]'::jsonb),
    'operators', coalesce((select jsonb_agg(row_to_json(t)::jsonb order by t.name) from (
      select o.name, coalesce(o.whatsapp, o.phone) as phone, o.email, o.is_partner,
             (select count(*) from bookings b join listings li on li.id = b.listing_id
               where coalesce(b.provider_operator_id, li.operator_id) = o.id and b.provider_captain_id is null
                 and b.status = 'completed' and b.trip_date between p_from and p_to) as tours_done
        from operators o) t), '[]'::jsonb)
  ) into out;
  return out;
end $$;
grant execute on function public.office_people(date, date) to authenticated;

-- Money (owner only): what came in, what the business keeps, what goes to providers, refunds, donations.
create function public.office_money(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tz text := 'America/Tegucigalpa';
        pct numeric;
        out jsonb;
begin
  perform public.office_require(array['owner']);
  select commission_pct into pct from business_settings;
  with p as (
    select * from payments where (created_at at time zone tz)::date between p_from and p_to
  ), s as (
    select
      coalesce(sum(amount_usd) filter (where status in ('succeeded', 'refunded')), 0) as taken,
      coalesce(sum(amount_usd) filter (where status = 'refunded'), 0) as refunded,
      coalesce(sum(amount_usd) filter (where status = 'succeeded' and donation_id is not null), 0) as donations,
      coalesce(sum(amount_usd) filter (where status = 'succeeded' and donation_id is null), 0) as net_sales,
      count(*) filter (where status = 'pending') as pending_count,
      coalesce(sum(amount_usd) filter (where status = 'pending'), 0) as pending_usd
    from p
  )
  select jsonb_build_object(
    'commission_pct', pct,
    'taken', s.taken, 'refunded', s.refunded, 'donations', s.donations, 'net_sales', s.net_sales,
    'you_keep', round(s.net_sales * pct / 100, 2),
    'providers_share', round(s.net_sales * (100 - pct) / 100, 2),
    'pending_count', s.pending_count, 'pending_usd', s.pending_usd,
    'by_method', coalesce((select jsonb_object_agg(provider, total) from (
        select provider, sum(amount_usd) total from p where status = 'succeeded' group by provider) m), '{}'::jsonb),
    'paid_out', coalesce((select sum(amount_usd) from payouts where (paid_at at time zone tz)::date between p_from and p_to), 0)
  ) into out from s;
  return out;
end $$;
grant execute on function public.office_money(date, date) to authenticated;

-- Payouts owed (owner only), one line per captain, driver or operator. Captains are due every N days.
create function public.office_payouts_owed() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare st public.business_settings;
begin
  perform public.office_require(array['owner']);
  select * into st from business_settings;
  return coalesce((select jsonb_agg(row_to_json(t)::jsonb order by t.due_on nulls last, t.payee_name) from (
    select o.payee_kind, o.payee_id, min(o.payee_name) as payee_name, count(*) as items,
           sum(o.gross_usd) as gross_usd,
           round(sum(o.gross_usd) * st.commission_pct / 100, 2) as commission_usd,
           sum(o.gross_usd) - round(sum(o.gross_usd) * st.commission_pct / 100, 2) as amount_usd,
           min(o.done_at) as oldest,
           case when o.payee_kind = 'captain' then
             greatest(coalesce((select max(p.paid_at) from payouts p where p.payee_kind = 'captain' and p.payee_id = o.payee_id), min(o.done_at)),
                      min(o.done_at))::date + st.captain_payout_days end as due_on,
           case when o.payee_kind = 'captain' then (select coalesce(pp.whatsapp, pp.phone) from profiles pp where pp.id = o.payee_id)
                when o.payee_kind = 'driver' then (select coalesce(pp.whatsapp, pp.phone) from profiles pp where pp.id = o.payee_id)
                else (select coalesce(op.whatsapp, op.phone) from operators op where op.id = o.payee_id) end as phone
      from public.office_owed_items() o
     group by o.payee_kind, o.payee_id) t), '[]'::jsonb);
end $$;
grant execute on function public.office_payouts_owed() to authenticated;

-- Mark everything owed to one payee as paid (owner only). Snapshots the percentage used.
create function public.office_mark_paid(p_kind text, p_payee uuid, p_method text, p_reference text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pct numeric; gross numeric; n int; pid uuid; nm text;
begin
  perform public.office_require(array['owner']);
  select commission_pct into pct from business_settings;
  select count(*), sum(o.gross_usd), min(o.payee_name) into n, gross, nm
    from public.office_owed_items() o where o.payee_kind = p_kind and o.payee_id = p_payee;
  if n = 0 then raise exception 'nothing_owed' using errcode = '22023'; end if;
  insert into payouts (payee_kind, payee_id, payee_name, gross_usd, commission_pct, commission_usd, amount_usd, method, reference, paid_by)
    values (p_kind, p_payee, nm, gross, pct, round(gross * pct / 100, 2), gross - round(gross * pct / 100, 2),
            nullif(left(trim(coalesce(p_method, '')), 40), ''), nullif(left(trim(coalesce(p_reference, '')), 80), ''), auth.uid())
    returning id into pid;
  insert into payout_items (item_kind, item_id, payout_id, gross_usd)
    select o.item_kind, o.item_id, pid, o.gross_usd from public.office_owed_items() o where o.payee_kind = p_kind and o.payee_id = p_payee;
  perform public.office_note('payout.paid', jsonb_build_object('payout', pid, 'payee', nm, 'kind', p_kind, 'items', n,
           'amount', gross - round(gross * pct / 100, 2), 'method', p_method));
  return jsonb_build_object('payout_id', pid, 'items', n, 'amount_usd', gross - round(gross * pct / 100, 2));
end $$;
grant execute on function public.office_mark_paid(text, uuid, text, text) to authenticated;

create function public.office_payout_history(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.office_require(array['owner']);
  return coalesce((select jsonb_agg(row_to_json(t)::jsonb) from (
    select p.paid_at, p.payee_kind, p.payee_name, p.amount_usd, p.gross_usd, p.commission_pct, p.method, p.reference,
           (select count(*) from payout_items i where i.payout_id = p.id) as items,
           (select s.display_name from staff s where s.user_id = p.paid_by) as paid_by
      from payouts p order by p.paid_at desc limit least(greatest(p_limit, 1), 500)) t), '[]'::jsonb);
end $$;
grant execute on function public.office_payout_history(int) to authenticated;

-- Settings (owner only).
create function public.office_settings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.office_require(array['owner']);
  return (select jsonb_build_object('commission_pct', commission_pct, 'captain_payout_days', captain_payout_days, 'updated_at', updated_at) from business_settings);
end $$;
grant execute on function public.office_settings() to authenticated;

create function public.office_set_settings(p_commission_pct numeric, p_captain_payout_days int) returns void
language plpgsql security definer set search_path = public as $$
declare old public.business_settings;
begin
  perform public.office_require(array['owner']);
  select * into old from business_settings;
  update business_settings set commission_pct = p_commission_pct, captain_payout_days = p_captain_payout_days,
         updated_at = now(), updated_by = auth.uid()
   where id;
  perform public.office_note('settings', jsonb_build_object('commission_pct', jsonb_build_array(old.commission_pct, p_commission_pct),
           'captain_payout_days', jsonb_build_array(old.captain_payout_days, p_captain_payout_days)));
end $$;
grant execute on function public.office_set_settings(numeric, int) to authenticated;

-- Staff (owner only): who is on the team, who is waiting, give or take away access.
create function public.office_staff() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.office_require(array['owner']);
  return jsonb_build_object(
    'staff', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', s.display_name, 'role', s.role,
               'active', s.active, 'email', u.email, 'since', s.created_at) order by s.role, s.display_name)
             from staff s left join auth.users u on u.id = s.user_id), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', r.display_name, 'email', u.email, 'at', r.created_at)
               order by r.created_at) from staff_requests r left join auth.users u on u.id = r.user_id where r.handled_at is null), '[]'::jsonb));
end $$;
grant execute on function public.office_staff() to authenticated;

create function public.office_set_staff(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  perform public.office_require(array['owner']);
  if p_user = auth.uid() then raise exception 'cannot_change_own_role' using errcode = '22023'; end if;
  if p_role is not null and p_role not in ('manager', 'team') then raise exception 'bad_role' using errcode = '22023'; end if;
  if p_role is null then
    update staff set active = false where user_id = p_user;
    update staff_requests set handled_at = now() where user_id = p_user;
  else
    select coalesce((select display_name from staff_requests where user_id = p_user and handled_at is null),
                    (select display_name from staff where user_id = p_user),
                    (select full_name from profiles where id = p_user), 'Team member') into nm;
    insert into staff (user_id, role, display_name, added_by) values (p_user, p_role, nm, auth.uid())
      on conflict (user_id) do update set role = excluded.role, active = true;
    update staff_requests set handled_at = now() where user_id = p_user;
  end if;
  perform public.office_note('staff', jsonb_build_object('user', p_user, 'role', p_role));
end $$;
grant execute on function public.office_set_staff(uuid, text) to authenticated;

create function public.office_activity(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.office_require(array['owner']);
  return coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'who', coalesce(s.display_name, 'System'), 'action', l.action, 'detail', l.detail)
           order by l.at desc) from (select * from office_log order by at desc limit least(greatest(p_limit, 1), 500)) l
           left join staff s on s.user_id = l.user_id), '[]'::jsonb);
end $$;
grant execute on function public.office_activity(int) to authenticated;

-- Lock the helper tables down completely: only the functions above touch them.
revoke all on public.staff, public.staff_requests, public.office_log, public.business_settings, public.payouts, public.payout_items from anon, authenticated;
