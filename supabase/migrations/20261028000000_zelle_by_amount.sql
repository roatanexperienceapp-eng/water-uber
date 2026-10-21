-- Backup match for Zelle deposit emails WITHOUT a booking code in the memo.
-- Confirms only when exactly ONE pending Zelle payment has exactly this amount and was created in the
-- hour before the deposit email arrived (the bank emails within minutes). Two candidates (or none) = nothing confirmed; a person checks.
-- The time window keeps unrelated Zelle income (rent, other businesses) from matching old bookings.
create or replace function public.confirm_zelle_by_amount(p_received_usd numeric, p_bank_ref text, p_received_at timestamptz)
returns text
language plpgsql security definer set search_path = public as $$
declare v_ids uuid[]; v_pay public.payments;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'not_allowed'; end if;
  if coalesce(trim(p_bank_ref), '') = '' then raise exception 'bank_ref_required'; end if;
  if p_received_usd is null or p_received_usd <= 0 or p_received_at is null then raise exception 'bad_input'; end if;
  select array_agg(id) into v_ids from (
    select id from public.payments
     where provider = 'zelle' and status = 'pending'
       and amount_usd = p_received_usd
       and created_at between p_received_at - interval '1 hour' and p_received_at + interval '5 minutes'
     for update
  ) x;
  if coalesce(cardinality(v_ids), 0) = 0 then raise exception 'no_match'; end if;
  if cardinality(v_ids) > 1 then raise exception 'ambiguous'; end if;
  select * into v_pay from public.payments where id = v_ids[1];
  return public.mark_payment_succeeded(v_pay.id, 'zelle:' || trim(p_bank_ref), v_pay.amount_cents);
end $$;
revoke all on function public.confirm_zelle_by_amount(numeric, text, timestamptz) from public, anon;
grant execute on function public.confirm_zelle_by_amount(numeric, text, timestamptz) to authenticated; -- admins only (checked inside)
