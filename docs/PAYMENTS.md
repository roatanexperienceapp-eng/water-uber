# Payments: how money works, and the go-live checklist

The payment system is built and tested. What's missing is a processor account and its keys. Until those
are set, the app runs in demo mode (no backend) or answers "payments not connected yet" (backend, no keys).

## The rules the code follows

1. **The server sets every price.** The app never sends an amount. `create-payment` works it out from the
   ride, booking, pass or group share in the database.
2. **Guests pay on the processor's hosted page** (Stripe Checkout or equivalent). Card numbers never touch
   our app or servers. That keeps us out of most PCI scope and gives Apple Pay and Google Pay for free.
3. **Only the signed webhook marks anything paid.** `payment-webhook` checks the processor's signature,
   then checks that the amount charged matches what we asked for. A mismatch is flagged
   (`payments.review_reason`) and the booking is **not** confirmed.
4. **Retries are harmless.** Every processor call has an idempotency key (our payment id). The webhook can
   arrive twice; the second time does nothing.
5. **Amounts are whole cents.** No floating-point money anywhere. Group shares add up to the exact total
   (the first shares carry the extra cent).
6. **Refunds are queued, then sent.** Anything that needs money back (a ride cancelled before a captain
   accepts, a group that didn't finish paying, money that arrived for something already cancelled) goes
   into a refund queue. `process-refunds` sends them every 5 minutes, with retries and an error log.

## What gets paid in one checkout

| Purchase | Checkout |
|---|---|
| Water taxi ride | one payment |
| Ride pass | one payment |
| Tour/rental **plus** its water taxi there and back | **one** payment covers all three |
| Group split | one payment per share; organizer can pay the rest in one go |
| Request-type tour (price sent later) | guest taps **Pay** in Trips when the price arrives; linked taxi rides are included |

## Choosing a processor

| Option | Needs | Notes |
|---|---|---|
| **Stripe** (built in) | A company in a Stripe country, e.g. a US LLC (Stripe Atlas or similar) and a US bank account | Fastest to launch. Adapter, signature check and refunds already written and tested. |
| Honduran processor (PixelPay, BAC Credomatic, etc.) | Honduran company and merchant account | Write one adapter in `supabase/functions/_shared/payments.ts` (create checkout, parse webhook, refund). Nothing else changes. |

**Apple and Google rules:** tours, rides and passes are real-world services, so they're paid with a normal
card processor, not in-app purchase. Don't sell digital-only items (like a paid "premium" feature) this way.

## Go-live checklist (Stripe)

1. Create the Stripe account for your company. Turn on **Apple Pay** and **Google Pay** in Payment methods.
2. In Stripe → Developers → Webhooks, add an endpoint:
   `https://YOUR_PROJECT.supabase.co/functions/v1/payment-webhook`
   with events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
3. Set server secrets (never put these in the app or the repo):
   ```bash
   npx supabase secrets set PAYMENT_PROVIDER=stripe \
     STRIPE_SECRET_KEY=sk_live_... \
     STRIPE_WEBHOOK_SECRET=whsec_... \
     PUBLIC_WEB_URL=https://YOUR-DOMAIN
   ```
   Use `sk_test_` keys and a test webhook first. Run the whole flow with Stripe's test card
   `4242 4242 4242 4242`, then switch to live keys.
4. Turn on **anonymous sign-ins** (Supabase → Authentication → Providers). Cruise guests book on the website
   without an account. Also turn on **CAPTCHA** (Cloudflare Turnstile) there to stop bots from creating
   sessions.
5. Schedule the refund worker (SQL editor, after enabling `pg_cron` and `pg_net`):
   ```sql
   select cron.schedule('process-refunds', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://YOUR_PROJECT.supabase.co/functions/v1/process-refunds',
       headers := jsonb_build_object('apikey', 'YOUR_SB_SECRET_KEY', 'Content-Type', 'application/json'),
       body := '{}'::jsonb)
   $$);
   ```
6. Deploy the website (the same app, built for web) at `PUBLIC_WEB_URL`. The checkout page returns guests
   to `/paid` on that site.
7. Test these before real guests:
   - pay for a ride, a pass, a tour with taxi there and back, a group split (2 phones);
   - cancel a paid ride before a captain accepts → refund appears in Stripe within 5 minutes;
   - let a group split expire → booking cancelled, paid shares refunded;
   - close the checkout page without paying → nothing charged, "Payment cancelled".

## Daily money checks (SQL editor)

Payments that need a human:
```sql
select id, amount_cents, paid_amount_cents, review_reason, created_at from payments
 where review_reason is not null order by created_at desc;
```

Refunds that keep failing:
```sql
select id, refund_reason, refund_attempts, refund_error from payments
 where refund_requested_at is not null and refunded_at is null and refund_attempts > 0;
```

What each operator is owed (gross, your commission, their net), this week:
```sql
select operator_name, sum(gross_cents)/100.0 gross, sum(platform_fee_cents)/100.0 fee, sum(operator_net_cents)/100.0 net
  from money_ledger where status = 'succeeded' and at > now() - interval '7 days' and operator_id is not null
 group by operator_name order by net desc;
```
Commission per operator: `update operators set commission_pct = 15 where name = '...';` (default 15%).

## Zelle (manual)

Guests with a US bank can pay **passes, packages and tours booked at least 6 hours ahead** by Zelle to
`roatanexperienceapp@gmail.com`. Water taxi rides and group splits are card only (rides are needed
right away; nobody is watching the bank at 11 pm). Settings: `ZELLE` in `_shared/business.ts`.

How it works:
1. The guest taps **Pay with Zelle**. The pass/booking is created and held, and the server creates a
   pending payment with `provider = 'zelle'`. The app shows the amount, the email and a memo code like `RWT-1A2B3C4D`.
2. The guest sends the money from their bank and taps "I've sent it". Nothing is confirmed yet.
3. Someone on the team checks the bank (8 am–8 pm, at least every 2 hours) and confirms in the SQL editor:

```sql
-- What is waiting
select * from zelle_pending();
-- After seeing the transfer in the bank (code from the memo, amount received, bank's confirmation number)
select confirm_zelle('RWT-1A2B3C4D', 95.00, 'BOA 123456789');
```

`confirm_zelle` refuses a short amount, an unknown code, or a missing bank reference, and confirms the
pass/booking exactly like a card payment does. A transfer with no code: match it by amount and time in
`zelle_pending()`, then confirm with that code.

Things to know before switching it on:
- **Zelle has no buyer protection and no refunds.** A refund means sending a Zelle back by hand.
- Use a **business** Zelle (through a business bank account). Banks can limit or close personal Zelle
  accounts used to take business payments.
- Most cruise guests from Canada, Europe and elsewhere cannot use Zelle. Card stays the main way to pay.
- Never confirm from a screenshot. Only confirm money you can see in the bank account.

## Zelle: automatic (from the bank's deposit email)

When the bank emails roatanexperienceapp@gmail.com that a Zelle deposit arrived, a small Google Apps Script
inside that Gmail (`docs/zelle-gmail-script.gs`) sends the email to the `zelle-email` server function
every 5 minutes. The booking is confirmed automatically only if ALL of these hold:
1. Gmail verified the email really came from the bank (DMARC/DKIM, from Google's own header), and the bank's
   domain is in the `ZELLE_SENDER_DOMAINS` secret. A forged "you got paid" email fails here.
2. The email contains exactly one booking code (RWT-XXXXXXXX) and exactly one dollar amount.
3. The code belongs to a pending Zelle payment and the amount is not short (`confirm_zelle`).
Backup when the guest forgot the code: the email must be money coming IN ("sent you", "deposited"...), contain
exactly one amount, and exactly ONE pending Zelle booking with that exact amount must have been made in the hour
before the email arrived. Two bookings with the same amount → nothing confirmed. (`confirm_zelle_by_amount`)
Anything else gets the Gmail label "Zelle - check by hand" and stays pending for the manual steps above.
The guest's confirmation screen and Trips turn to confirmed on their own.

Setup:
1. script.google.com → New project → paste `docs/zelle-gmail-script.gs` → Save.
2. Run `setup` (allow Gmail access). Copy the secret from the log into Supabase → Edge Functions → Secrets
   as `ZELLE_HOOK_SECRET`.
3. Run `testLatest` and read the log: the "verifiedDomains" shown for your bank's Zelle emails is what goes
   into the `ZELLE_SENDER_DOMAINS` secret (comma-separated, e.g. `ealerts.bankofamerica.com`).
4. Run `startEvery5Minutes`.
Requires that the bank's email includes the memo. If it doesn't, every email gets "check by hand".

## Not automated yet

- **Paying operators and captains.** The ledger shows what each is owed; transfers are manual for now.
  Stripe Connect can automate this later if partners get their own Stripe accounts.
- **Partial refunds** (e.g. one taxi leg cancelled after a combined checkout) are flagged
  `linked_ride_not_payable` and done by hand in the Stripe dashboard.
- **Cancellation policy for tours** beyond the automatic cases above: decide your policy, then ops refunds
  from the Stripe dashboard (the webhook records it automatically).
