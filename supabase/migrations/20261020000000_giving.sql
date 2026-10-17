-- Giving: guest donations to Every Child Roatán + the app's pledge of 10% of what it earns.
--
-- Money rules:
--   * Donations are their own payment type and are passed on 100% (card fees disclosed on the page).
--   * The pledge is 10% of the app's EARNINGS: the part of each payment the app keeps (its commission
--     on partner tours, all of its own tours, and the configured share of rides and passes). Not gross sales.
--   * The public sees money actually handed to the charity (charity_transfers), never revenue figures.
--   * Admins see what is owed: donations + pledge − transfers.

create table public.giving_settings (
  id int primary key default 1 check (id = 1),
  charity_name text not null default 'Every Child Roatán',
  pledge_pct numeric(5, 2) not null default 10 check (pledge_pct between 0 and 100),
  -- Share of water taxi fares and passes that is the app's earnings (the rest goes to captains). OWNER: set this.
  ride_platform_pct numeric(5, 2) not null default 20 check (ride_platform_pct between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.giving_settings (id) values (1);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles (id),
  amount_usd numeric(10, 2) not null check (amount_usd between 1 and 5000),
  message text check (message is null or length(message) <= 280),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index on public.donations (status, paid_at);

-- Money actually handed to the charity (bank transfer, cash with receipt). Entered by admins.
create table public.charity_transfers (
  id uuid primary key default gen_random_uuid(),
  amount_usd numeric(10, 2) not null check (amount_usd > 0),
  transferred_on date not null default current_date,
  note text,                 -- e.g. "October pledge + guest donations", receipt number
  receipt_url text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.payments add column donation_id uuid references public.donations (id);
alter table public.payments drop constraint payments_one_target;
alter table public.payments add constraint payments_one_target check (
  (case when ride_id is not null then 1 else 0 end) + (case when booking_id is not null then 1 else 0 end)
  + (case when pass_id is not null then 1 else 0 end) + (case when donation_id is not null then 1 else 0 end) = 1
);

alter table public.giving_settings enable row level security;
alter table public.donations enable row level security;
alter table public.charity_transfers enable row level security;
create policy "read giving settings" on public.giving_settings for select using (true);
create policy "admin giving settings" on public.giving_settings for update using (public.is_admin()) with check (public.is_admin());
create policy "own donations" on public.donations for select using (donor_id = auth.uid() or public.is_admin());
create policy "admin transfers" on public.charity_transfers for all using (public.is_admin()) with check (public.is_admin());

-- Guests start a donation (amount checked here); they pay it through create-payment like anything else.
create function public.create_donation(p_amount numeric, p_message text default null) returns public.donations
language plpgsql security definer set search_path = public as $$
declare v_d public.donations;
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode = '42501'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 5000 or p_amount <> round(p_amount, 2) then
    raise exception 'bad_amount' using errcode = 'P0001';
  end if;
  insert into public.donations (donor_id, amount_usd, message) values (auth.uid(), p_amount, nullif(trim(p_message), ''))
  returning * into v_d;
  return v_d;
end $$;

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

-- Donation refunded (processor dashboard or refund queue) → mark it.
create function public.donation_on_refund() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.donation_id is not null and new.refunded_at is not null and old.refunded_at is null then
    update public.donations set status = 'refunded' where id = new.donation_id;
  end if;
  return new;
end $$;
create trigger donation_refund after update of refunded_at on public.payments for each row execute function public.donation_on_refund();

create or replace view public.money_ledger with (security_invoker = true) as
  select p.id as payment_id,
         coalesce(p.updated_at, p.created_at) as at,
         case when p.ride_id is not null then 'ride' when p.pass_id is not null then 'pass' when p.donation_id is not null then 'donation' else 'booking' end as kind,
         p.ride_id, p.booking_id, p.pass_id, p.split_id,
         l.operator_id, o.name as operator_name, r.captain_id,
         p.paid_amount_cents as gross_cents,
         case when l.operator_id is not null then round(p.paid_amount_cents * o.commission_pct / 100)::int end as platform_fee_cents,
         case when l.operator_id is not null then p.paid_amount_cents - round(p.paid_amount_cents * o.commission_pct / 100)::int end as operator_net_cents,
         p.status, p.refunded_at, p.review_reason, p.provider, p.provider_ref, p.donation_id
    from public.payments p
    left join public.bookings bk on bk.id = p.booking_id
    left join public.listings l on l.id = bk.listing_id
    left join public.operators o on o.id = l.operator_id
    left join public.rides r on r.id = p.ride_id
   where p.status in ('succeeded', 'refunded')
     and public.is_admin();

-- Public: what guests raised and what has actually been handed over. No revenue figures.
create function public.giving_public() returns table (charity_name text, pledge_pct numeric, raised_cents bigint, donors int, given_cents bigint, last_given_on date)
language sql stable security definer set search_path = public as $$
  select s.charity_name, s.pledge_pct,
         coalesce((select sum(round(amount_usd * 100)) from public.donations where status = 'paid'), 0)::bigint,
         (select count(distinct donor_id) from public.donations where status = 'paid')::int,
         coalesce((select sum(round(amount_usd * 100)) from public.charity_transfers), 0)::bigint,
         (select max(transferred_on) from public.charity_transfers)
    from public.giving_settings s where s.id = 1;
$$;

-- Admin: what the charity is owed right now.
create function public.giving_owed() returns table (donations_cents bigint, earnings_cents bigint, pledge_cents bigint, transferred_cents bigint, owed_cents bigint)
language plpgsql stable security definer set search_path = public as $$
declare s public.giving_settings;
begin
  if not public.is_admin() then raise exception 'admins_only' using errcode = '42501'; end if;
  select * into s from public.giving_settings where id = 1;
  return query
  with paid as (
    select p.*, o.commission_pct
      from public.payments p
      left join public.bookings bk on bk.id = p.booking_id
      left join public.listings l on l.id = bk.listing_id
      left join public.operators o on o.id = l.operator_id
     where p.status = 'succeeded' and p.refunded_at is null and p.review_reason is null
  ), totals as (
    select coalesce(sum(paid_amount_cents) filter (where donation_id is not null), 0)::bigint as don,
           coalesce(sum(case
             when donation_id is not null then 0
             when ride_id is not null or pass_id is not null then round(paid_amount_cents * s.ride_platform_pct / 100)
             else round(paid_amount_cents * coalesce(commission_pct, 15) / 100) end), 0)::bigint as earn
      from paid
  )
  select t.don, t.earn, round(t.earn * s.pledge_pct / 100)::bigint,
         coalesce((select sum(round(amount_usd * 100)) from public.charity_transfers), 0)::bigint,
         (t.don + round(t.earn * s.pledge_pct / 100) - coalesce((select sum(round(amount_usd * 100)) from public.charity_transfers), 0))::bigint
    from totals t;
end $$;

grant execute on function public.create_donation(numeric, text) to authenticated;
grant execute on function public.giving_public() to anon, authenticated;
revoke all on function public.giving_owed() from public, anon;
grant execute on function public.giving_owed() to authenticated;  -- the function itself checks is_admin()
revoke all on function public.mark_payment_succeeded(uuid, text, int) from public, anon, authenticated;
