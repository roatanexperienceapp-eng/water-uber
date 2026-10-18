-- Packages (water taxi pass + own snorkel/fishing tours at a discount) and passes for any group size 2–12.

alter table public.guest_passes drop constraint if exists guest_passes_pass_type_check;
alter table public.guest_passes add constraint guest_passes_pass_type_check check (
  pass_type ~ '^(week|twoWeek)([2-9]|1[0-2])$' or pass_type in ('week', 'twoWeek', 'tenPack', 'family')
);

create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id),
  pass_id uuid not null unique references public.guest_passes (id),
  group_size int not null check (group_size between 1 and 12),
  subtotal_cents int not null check (subtotal_cents > 0),
  discount_pct numeric(5, 2) not null check (discount_pct between 0 and 50),
  discount_cents int not null check (discount_cents >= 0),
  total_cents int not null check (total_cents > 0),
  pass_share_cents int not null,
  tours_share_cents int not null,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (total_cents = subtotal_cents - discount_cents),
  check (pass_share_cents + tours_share_cents = total_cents)
);
alter table public.bundles enable row level security;
create policy "own bundles" on public.bundles for select using (guest_id = auth.uid() or public.is_admin());

alter table public.bookings add column bundle_id uuid references public.bundles (id);
alter table public.payments add column bundle_id uuid references public.bundles (id);
alter table public.payments drop constraint payments_one_target;
alter table public.payments add constraint payments_one_target check (
  (case when ride_id is not null then 1 else 0 end) + (case when booking_id is not null then 1 else 0 end)
  + (case when pass_id is not null then 1 else 0 end) + (case when donation_id is not null then 1 else 0 end)
  + (case when bundle_id is not null then 1 else 0 end) = 1
);

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
             when ride_id is not null or pass_id is not null then round(paid_amount_cents * s.ride_platform_pct / 100)
             else round(paid_amount_cents * coalesce(commission_pct, 15) / 100) end), 0)::bigint as earn
      from paid
  )
  select t.don, t.earn, round(t.earn * s.pledge_pct / 100)::bigint,
         coalesce((select sum(round(amount_usd * 100)) from public.charity_transfers), 0)::bigint,
         (t.don + round(t.earn * s.pledge_pct / 100) - coalesce((select sum(round(amount_usd * 100)) from public.charity_transfers), 0))::bigint
    from totals t;
end $$;

revoke all on function public.mark_payment_succeeded(uuid, text, int) from public, anon, authenticated;
