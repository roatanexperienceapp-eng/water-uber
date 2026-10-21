-- Hardening from the Supabase security advisor. Behaviour is unchanged: every function below already
-- checks who is calling. This just stops signed-out visitors (anon) from calling guest-only functions
-- and stops anyone calling trigger functions directly.

-- Guest/captain/admin functions: signed-in users only (the app signs every guest in, even anonymously).
do $$
declare f text;
begin
  foreach f in array array[
    'accept_ride(uuid)', 'advance_ride(uuid, public.ride_status)', 'booking_contact(uuid)', 'cancel_ride(uuid)',
    'confirm_ride(uuid)', 'create_donation(numeric, text)', 'enable_ride_share(uuid)', 'mark_inbox_read(uuid[])',
    'report_sea(text, text)', 'ride_contact(uuid)', 'verify_crew_license(text, text, date)', 'check_in(text)',
    'giving_owed()', 'zelle_pending()', 'confirm_zelle(text, numeric, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Trigger functions are never called directly.
do $$
declare f text;
begin
  foreach f in array array[
    'community_after_report()', 'community_before_insert()', 'donation_on_refund()', 'guard_role_change()',
    'inbox_on_booking()', 'inbox_on_credit()', 'inbox_on_refund()', 'inbox_on_sea_report()', 'support_ack()',
    'guard_inbox_category()', 'guard_repeat_update()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Fixed search_path on the remaining helpers.
alter function public.split_share_cents(int, int, int, int) set search_path = public;
alter function public.guard_inbox_category() set search_path = public;
alter function public.zelle_code(uuid) set search_path = public;
