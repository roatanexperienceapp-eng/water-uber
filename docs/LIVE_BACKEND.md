# Live backend: what is done and what is left

Project: **roatan-water-taxi** (Supabase, region us-east-1, free plan), ref `crcxjbiqnlzmqrdwpozj`.

## Done
- All database migrations applied (tables, security rules, functions), and checked against the tested
  copy by fingerprint: tables, columns, functions, rules, indexes and views match.
- Seed data: 28 piers, 14 portals, 229 listings, 10 captains, the owner operator.
- 12 server functions deployed: create-ride, create-booking, create-pass, create-bundle, create-repeat-ride,
  create-payment (card + Zelle), payment-webhook, process-refunds, pickup-watchdog, assistant (Isla),
  identify-marine-life (fish scanner), delete-account.
- Security hardening (`20261027000000_hardening.sql`): signed-out visitors can't call guest functions.
- Website: roatanwatertaxi.com/privacy, /terms, /refunds and /paid (payment return page).

## Left to do (in this order)

### 1. Approve the account-deletion function (needed before App Store review)
Supabase asks for approval on any SQL that deletes rows. Paste this in Supabase → SQL Editor → Run,
or tell Claude to send it again and tap Approve:
the full `create or replace function public.erase_guest ...` block from
`supabase/migrations/20261025000000_community.sql` (the last statement in that file, plus its `revoke` line).
Until then, "Delete my account" in the live app returns an error.

### 2. Supabase dashboard settings (2 minutes)
- Authentication → Sign In / Providers → **Allow anonymous sign-ins: ON** (guests use the app without signing up).
- Authentication → URL Configuration → Site URL `https://roatanwatertaxi.com`.
- Authentication → Emails → SMTP: the Gmail settings in docs/CONTACT.md.

### 3. Secrets (Supabase → Edge Functions → Secrets)
| Secret | What for |
|---|---|
| `ANTHROPIC_API_KEY` | Isla and the fish scanner (console.anthropic.com) |
| `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card payments, once the Stripe account exists |
| `PUBLIC_WEB_URL=https://roatanwatertaxi.com` | Payment return links |
Never put these in the app or in git.

### 4. Timers
pickup-watchdog every minute and process-refunds every 5 minutes (Supabase → Integrations → Cron,
calling the function URL with the secret key). Set these up when real rides start.

### 5. Admin account
Sign in to the live app once, then in SQL Editor:
`update profiles set role = 'admin' where id = '<your user id from Authentication → Users>';`
Admins can confirm Zelle payments, verify captain licenses and moderate the community.

## Switching the app between demo and live
`cp .env.live .env` then `npx expo start -c` (live). `rm .env` then `npx expo start -c` (demo).
Live mode needs step 2 (anonymous sign-ins) first, or the app can't sign guests in.
