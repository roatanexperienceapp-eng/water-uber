-- Zelle: guests send money from their US bank to the business's Zelle email, with a short code in the memo.
-- Nothing tells us automatically that it arrived, so the payment stays 'pending' until a team member
-- checks the bank and runs confirm_zelle(). The guest's pass/booking is confirmed at that moment.
-- The create-payment edge function creates the pending row (provider = 'zelle'); guests can't.

-- The memo code the guest sees: RWT- + first 8 characters of the payment id.
create or replace function public.zelle_code(p_payment_id uuid) returns text
language sql immutable as $$ select 'RWT-' || upper(left(replace(p_payment_id::text, '-', ''), 8)) $$;

-- For the team: every Zelle payment still waiting for a check of the bank.
create or replace function public.zelle_pending()
returns table (code text, payment_id uuid, amount_usd numeric, what text, guest_email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'not_allowed'; end if;
  return query
    select public.zelle_code(p.id), p.id, p.amount_usd,
           case when p.pass_id is not null then 'pass' when p.bundle_id is not null then 'package' else 'booking' end,
           u.email::text, p.created_at
      from public.payments p
      left join auth.users u on u.id = p.guest_id
     where p.provider = 'zelle' and p.status = 'pending'
     order by p.created_at;
end $$;

-- For the team, after seeing the transfer in the bank:
--   select confirm_zelle('RWT-1A2B3C4D', 95.00, 'bank confirmation number');
-- Refuses if the amount received is short. Returns 'ok' when the pass/booking is now confirmed.
create or replace function public.confirm_zelle(p_code text, p_received_usd numeric, p_bank_ref text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_pay public.payments;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'not_allowed'; end if;
  if coalesce(trim(p_bank_ref), '') = '' then raise exception 'bank_ref_required'; end if;
  select * into v_pay from public.payments
   where provider = 'zelle' and status = 'pending' and public.zelle_code(id) = upper(trim(p_code))
   order by created_at desc limit 1;
  if v_pay.id is null then raise exception 'no_pending_zelle_payment'; end if;
  if p_received_usd < v_pay.amount_usd then raise exception 'amount_short: expected %', v_pay.amount_usd; end if;
  return public.mark_payment_succeeded(v_pay.id, 'zelle:' || trim(p_bank_ref), v_pay.amount_cents);
end $$;

revoke all on function public.zelle_pending() from public, anon;
revoke all on function public.confirm_zelle(text, numeric, text) from public, anon;
grant execute on function public.zelle_pending() to authenticated;            -- admins only (checked inside)
grant execute on function public.confirm_zelle(text, numeric, text) to authenticated; -- admins only (checked inside)
