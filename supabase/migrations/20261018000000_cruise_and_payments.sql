-- Cruise-visitor features + payment hardening for real money.
--
-- Payments: amount checks, failure and refund tracking, hosted-checkout reuse, a commission ledger.
-- Cruise: ship calls, port-time-safe bookings, tickets with check-in codes, meeting points, split payments.

-- =====================================================================================
-- Payments: money-safe columns
-- =====================================================================================
alter table public.payments
  add column currency text not null default 'usd' check (currency = 'usd'),
  add column amount_cents int generated always as ((round(amount_usd * 100))::int) stored,
  add column paid_amount_cents int,
  add column checkout_session_id text,
  add column checkout_url text,
  add column checkout_expires_at timestamptz,
  -- Set when money arrived but something is off (amount mismatch). Ops must look at these.
  add column review_reason text,
  -- Refund queue: process-refunds sends these to the processor.
  add column refund_requested_at timestamptz,
  add column refund_reason text,
  add column refunded_at timestamptz,
  add column refund_ref text,
  add column refund_error text,
  add column refund_attempts int not null default 0,
  -- Split payments: which shares of the group booking this payment covers.
  add column split_id uuid,
  add column share_from int,
  add column share_count int,
  -- Taxi rides booked with an activity are paid in the same checkout as the booking.
  add column covers_ride_ids uuid[] not null default '{}';

create index payments_refund_queue on public.payments (refund_requested_at) where refund_requested_at is not null and refunded_at is null;
create index payments_review on public.payments (created_at) where review_reason is not null;
create index payments_by_split on public.payments (split_id) where split_id is not null;

-- Commission per operator (owner option; 15% default).
alter table public.operators
  add column commission_pct numeric(5, 2) not null default 15 check (commission_pct between 0 and 100),
  add column sign_color text;

-- =====================================================================================
-- Cruise ship calls
-- =====================================================================================
create table public.ship_calls (
  id uuid primary key default gen_random_uuid(),
  call_date date not null,                -- Roatán local date
  ship_name text not null,
  cruise_line text,
  port text not null check (port in ('mahogany', 'coxen')),
  arrive_at timestamptz not null,
  all_aboard_at timestamptz not null,
  passengers int check (passengers is null or passengers > 0),
  created_at timestamptz not null default now(),
  check (all_aboard_at > arrive_at),
  unique (call_date, ship_name)
);
create index on public.ship_calls (call_date);
alter table public.ship_calls enable row level security;
create policy "read ship calls" on public.ship_calls for select using (true);
create policy "admin ship calls" on public.ship_calls for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================================
-- Listings: meeting points and durations
-- =====================================================================================
alter table public.listings
  add column meeting_text text,
  add column meeting_lat double precision,
  add column meeting_lon double precision,
  add column meeting_photo_url text,       -- a photo the operator took of the meeting spot
  add column port_pickup boolean not null default false,  -- operator collects cruise guests at the port gate
  add column duration_minutes int check (duration_minutes is null or duration_minutes between 15 and 720);

-- =====================================================================================
-- Bookings: ship link, ticket code, check-in
-- =====================================================================================
alter table public.bookings
  add column ship_call_id uuid references public.ship_calls (id),
  add column ticket_code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  add column checked_in_at timestamptz,
  add column cancelled_at timestamptz;
create unique index bookings_ticket_code on public.bookings (ticket_code);

-- Operator (or admin) scans the guest's QR and checks them in. Only for their own listings.
create function public.check_in(p_code text) returns table (booking_id uuid, listing_name text, quantity int, trip_date date, trip_time text, already_checked_in boolean)
language plpgsql security definer set search_path = public as $$
declare v_b public.bookings; v_name text; v_owner uuid;
begin
  select bk.* into v_b from public.bookings bk where bk.ticket_code = upper(trim(p_code)) for update;
  if v_b.id is null then raise exception 'ticket_not_found' using errcode = 'P0002'; end if;
  select l.name, o.owner_id into v_name, v_owner
    from public.listings l left join public.operators o on o.id = l.operator_id where l.id = v_b.listing_id;
  if not public.is_admin() and v_owner is distinct from auth.uid() then
    raise exception 'not_your_ticket' using errcode = '42501';
  end if;
  if v_b.status not in ('paid', 'completed') then raise exception 'ticket_not_paid' using errcode = 'P0001'; end if;
  booking_id := v_b.id; listing_name := v_name; quantity := v_b.quantity; trip_date := v_b.trip_date; trip_time := v_b.trip_time;
  already_checked_in := v_b.checked_in_at is not null;
  if v_b.checked_in_at is null then update public.bookings set checked_in_at = now() where id = v_b.id; end if;
  return next;
end $$;

-- =====================================================================================
-- Split payments ("split with my group")
-- =====================================================================================
create table public.booking_splits (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id),
  organizer_id uuid not null references public.profiles (id),
  shares int not null check (shares between 2 and 12),
  total_cents int not null check (total_cents > 0),
  token text not null unique default encode(sha256((gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex'),
  deadline_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'complete', 'expired')),
  created_at timestamptz not null default now()
);
alter table public.payments add constraint payments_split_fk foreign key (split_id) references public.booking_splits (id);
alter table public.payments add constraint payments_share_range check (
  (split_id is null and share_from is null and share_count is null)
  or (split_id is not null and share_from >= 0 and share_count >= 1)
);
alter table public.booking_splits enable row level security;
create policy "organizer reads split" on public.booking_splits for select using (organizer_id = auth.uid() or public.is_admin());

-- Cents for shares [from, from+count): the first (total % shares) shares carry one extra cent.
-- Must match shareCents() in _shared/payments.ts.
create function public.split_share_cents(p_total int, p_shares int, p_from int, p_count int) returns int
language sql immutable as $$
  select p_count * (p_total / p_shares) + greatest(0, least(p_from + p_count, p_total % p_shares) - p_from);
$$;

-- Shares that are paid, or held by a checkout started in the last 30 minutes.
create function public.split_taken(p_split_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(share_count), 0)::int from public.payments
   where split_id = p_split_id
     and (status = 'succeeded' or (status = 'pending' and created_at > now() - interval '30 minutes'));
$$;

-- Server only: create the split right after the booking. The organizer pays the first share.
create function public.create_split(p_booking_id uuid, p_organizer uuid, p_shares int, p_deadline timestamptz) returns public.booking_splits
language plpgsql security definer set search_path = public as $$
declare v_b public.bookings; v_s public.booking_splits;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if v_b.id is null or v_b.guest_id <> p_organizer then raise exception 'not_your_booking' using errcode = '42501'; end if;
  if v_b.status <> 'awaiting_payment' or v_b.total_usd is null then raise exception 'not_splittable' using errcode = 'P0001'; end if;
  if p_deadline <= now() then raise exception 'too_late_to_split' using errcode = 'P0001'; end if;
  insert into public.booking_splits (booking_id, organizer_id, shares, total_cents, deadline_at)
  values (p_booking_id, p_organizer, p_shares, (round(v_b.total_usd * 100))::int, p_deadline)
  returning * into v_s;
  return v_s;
end $$;

-- Server only: hold the next share(s) for a payer and create their pending payment.
-- p_count null = every remaining share (the organizer "pays the rest").
create function public.reserve_split_share(p_token text, p_guest uuid, p_count int, p_provider text) returns public.payments
language plpgsql security definer set search_path = public as $$
declare v_s public.booking_splits; v_taken int; v_count int; v_pay public.payments;
begin
  select * into v_s from public.booking_splits where token = p_token for update;
  if v_s.id is null then raise exception 'split_not_found' using errcode = 'P0002'; end if;
  if v_s.status <> 'open' or v_s.deadline_at <= now() then raise exception 'split_closed' using errcode = 'P0001'; end if;
  -- Reuse this payer's own open checkout instead of holding more shares.
  select * into v_pay from public.payments
   where split_id = v_s.id and guest_id = p_guest and status = 'pending' and created_at > now() - interval '30 minutes'
     and (p_count is not null and share_count = p_count)
   order by created_at desc limit 1;
  if v_pay.id is not null then return v_pay; end if;
  v_taken := public.split_taken(v_s.id);
  v_count := coalesce(p_count, v_s.shares - v_taken);
  if v_count < 1 or v_taken + v_count > v_s.shares then raise exception 'no_shares_left' using errcode = 'P0001'; end if;
  insert into public.payments (guest_id, booking_id, amount_usd, provider, split_id, share_from, share_count)
  values (p_guest, v_s.booking_id, public.split_share_cents(v_s.total_cents, v_s.shares, v_taken, v_count) / 100.0, p_provider, v_s.id, v_taken, v_count)
  returning * into v_pay;
  return v_pay;
end $$;

-- Anyone with the link sees the group booking's progress. No names, emails or contact details.
create function public.split_status(p_token text) returns table (
  listing_name text, trip_date date, trip_time text, quantity int, shares int, paid_shares int,
  share_cents int, total_cents int, deadline_at timestamptz, status text
)
language sql stable security definer set search_path = public as $$
  select l.name, bk.trip_date, bk.trip_time, bk.quantity, s.shares,
         (select coalesce(sum(p.share_count), 0)::int from public.payments p where p.split_id = s.id and p.status = 'succeeded'),
         public.split_share_cents(s.total_cents, s.shares, s.shares - 1, 1), s.total_cents, s.deadline_at, s.status
    from public.booking_splits s
    join public.bookings bk on bk.id = s.booking_id
    join public.listings l on l.id = bk.listing_id
   where s.token = p_token;
$$;

-- =====================================================================================
-- Payment state changes (server only, called from the signed webhook and the refund worker)
-- =====================================================================================
create function public.request_refund(p_payment_id uuid, p_reason text) returns void
language sql security definer set search_path = public as $$
  update public.payments set refund_requested_at = coalesce(refund_requested_at, now()), refund_reason = coalesce(refund_reason, p_reason), updated_at = now()
   where id = p_payment_id and status = 'succeeded' and refunded_at is null;
$$;

drop function public.mark_payment_succeeded(uuid, text);
create function public.mark_payment_succeeded(p_payment_id uuid, p_provider_ref text, p_amount_cents int default null) returns text
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
  elsif v_pay.pass_id is not null then
    update public.guest_passes set status = 'active' where id = v_pay.pass_id and status = 'awaiting_payment';
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

create function public.mark_payment_failed(p_payment_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.payments set status = 'failed', updated_at = now() where id = p_payment_id and status = 'pending';
$$;

create function public.mark_payment_refunded(p_payment_id uuid, p_refund_ref text) returns void
language sql security definer set search_path = public as $$
  update public.payments set status = 'refunded', refunded_at = coalesce(refunded_at, now()), refund_ref = coalesce(refund_ref, p_refund_ref), refund_error = null, updated_at = now()
   where id = p_payment_id and status in ('succeeded', 'refunded');
$$;

create function public.record_refund_error(p_payment_id uuid, p_error text) returns void
language sql security definer set search_path = public as $$
  update public.payments set refund_error = left(p_error, 500), refund_attempts = refund_attempts + 1, updated_at = now() where id = p_payment_id;
$$;

-- Cancelling a paid ride before a captain accepts it refunds it automatically (pass rides give the ride back).
create or replace function public.cancel_ride(p_ride_id uuid) returns public.rides
language plpgsql security definer set search_path = public as $$
declare v_ride public.rides; v_was public.ride_status;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.id is null or v_ride.guest_id is distinct from auth.uid() then
    raise exception 'not_your_ride' using errcode = '42501';
  end if;
  if v_ride.status not in ('awaiting_payment', 'paid', 'accepted') then
    raise exception 'too_late_to_cancel' using errcode = 'P0001';
  end if;
  v_was := v_ride.status;
  update public.rides set status = 'cancelled', cancelled_at = now() where id = p_ride_id returning * into v_ride;
  if v_ride.boat_id is not null then
    update public.boat_positions set available = true where boat_id = v_ride.boat_id;
  end if;
  if v_was = 'paid' then
    perform public.request_refund(p.id, 'guest_cancelled_before_accept')
       from public.payments p where p.ride_id = p_ride_id and p.status = 'succeeded';
    if v_ride.pass_id is not null then
      update public.guest_passes set rides_used = greatest(0, rides_used - 1) where id = v_ride.pass_id;
    end if;
  end if;
  -- After acceptance the captain is already on the way: no automatic refund (ops can still refund).
  return v_ride;
end $$;

-- Splits past their deadline: cancel the booking and refund everyone who paid.
create function public.run_split_watchdog() returns int
language plpgsql security definer set search_path = public as $$
declare v_s record; v_n int := 0;
begin
  for v_s in select * from public.booking_splits where status = 'open' and deadline_at <= now() for update skip locked loop
    update public.booking_splits set status = 'expired' where id = v_s.id;
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_s.booking_id and status = 'awaiting_payment';
    perform public.request_refund(p.id, 'split_not_completed') from public.payments p where p.split_id = v_s.id and p.status = 'succeeded';
    update public.payments set status = 'failed', updated_at = now() where split_id = v_s.id and status = 'pending';
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- =====================================================================================
-- Money ledger for payouts and accounting (admins only: security_invoker + payments RLS)
-- =====================================================================================
create view public.money_ledger with (security_invoker = true) as
  select p.id as payment_id,
         coalesce(p.updated_at, p.created_at) as at,
         case when p.ride_id is not null then 'ride' when p.pass_id is not null then 'pass' else 'booking' end as kind,
         p.ride_id, p.booking_id, p.pass_id, p.split_id,
         l.operator_id, o.name as operator_name, r.captain_id,
         p.paid_amount_cents as gross_cents,
         case when l.operator_id is not null then round(p.paid_amount_cents * o.commission_pct / 100)::int end as platform_fee_cents,
         case when l.operator_id is not null then p.paid_amount_cents - round(p.paid_amount_cents * o.commission_pct / 100)::int end as operator_net_cents,
         p.status, p.refunded_at, p.review_reason, p.provider, p.provider_ref
    from public.payments p
    left join public.bookings bk on bk.id = p.booking_id
    left join public.listings l on l.id = bk.listing_id
    left join public.operators o on o.id = l.operator_id
    left join public.rides r on r.id = p.ride_id
   where p.status in ('succeeded', 'refunded')
     and public.is_admin();  -- guests can read their own payments, but never commission figures

-- =====================================================================================
-- Grants
-- =====================================================================================
revoke all on function public.create_split(uuid, uuid, int, timestamptz) from public, anon, authenticated;
revoke all on function public.reserve_split_share(text, uuid, int, text) from public, anon, authenticated;
revoke all on function public.split_taken(uuid) from public, anon, authenticated;
revoke all on function public.request_refund(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_payment_succeeded(uuid, text, int) from public, anon, authenticated;
revoke all on function public.mark_payment_failed(uuid) from public, anon, authenticated;
revoke all on function public.mark_payment_refunded(uuid, text) from public, anon, authenticated;
revoke all on function public.record_refund_error(uuid, text) from public, anon, authenticated;
revoke all on function public.run_split_watchdog() from public, anon, authenticated;
revoke all on function public.check_in(text) from public, anon;
grant execute on function public.check_in(text) to authenticated;
grant execute on function public.split_status(text) to anon, authenticated;
