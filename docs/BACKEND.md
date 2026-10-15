# Backend (Supabase)

Everything the app stores or decides lives in Supabase: the database, logins, live boat positions and
five server functions. The app never sets a price or a status itself.

## What's in `supabase/`

| Path | What it is |
|---|---|
| `migrations/20261008000000_init.sql` | All tables, security rules (RLS) and ride/booking actions |
| `seed.sql` | 8 docks, 14 portals, 157 listings. Generated: `npm run seed` |
| `functions/_shared/geo.ts` | Docks, sea lanes, shortest route by water (shared with the app) |
| `functions/_shared/pricing.ts` | **The only place prices are defined** (shared with the app) |
| `functions/create-ride` | Creates a water taxi ride with a server-computed fare |
| `functions/create-booking` | Creates a tour/rental booking (instant or concierge request) |
| `functions/create-payment` | Starts a payment for a ride/booking (processor not chosen yet) |
| `functions/payment-webhook` | The only place anything becomes "paid" (processor calls it) |
| `functions/assistant` | "Isla", the AI assistant. Holds the Anthropic key; 40 questions/user/day |
| `tests/db.test.mjs` | 35 checks: forged prices, privacy between users, ride flow, contact unlock |
| `functions/_shared/pricing.test.ts` | 9 checks on fares and routes |

## How a water taxi ride flows

1. Guest taps **Request boat** → `create-ride` checks the docks/riders/time and computes the fare → ride is `awaiting_payment`.
2. Guest pays → processor confirms to `payment-webhook` → ride becomes `paid`.
3. Online captains see paid rides → first to tap **Accept** gets it (`accept_ride`; a second captain is refused) → `accepted`.
4. Only now can the guest see the captain's name and WhatsApp (`ride_contact`).
5. Captain marks `onboard`, then `completed`. Guests can cancel until they are aboard.

## How tours and rentals flow

- **instant** listings (your own, with a fixed price, partner operator): server computes the total → pay → operator WhatsApp unlocks.
- **request** listings (everyone else today): booking is `requested`. Your team calls the operator, then sets
  a price (SQL below) → guest pays → `paid`. This is the concierge model, so you can sell before operators sign up.
- **info** listings (pharmacies, hospitals): cannot be booked; the server refuses.

## One-time setup (on your computer)

1. Create a project at supabase.com. Region: **East US** (closest to Roatán).
2. In **Project Settings → API Keys**, make sure the project uses the **new keys** (`sb_publishable_…` and
   `sb_secret_…`) and, under **JWT Signing Keys**, an asymmetric signing key. The server functions reject the old
   `eyJ…` keys.
3. In a terminal in the project folder:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push                  # creates all tables and rules
   npx supabase db push --include-seed   # loads docks, portals and listings
   npx supabase functions deploy         # deploys all five functions
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
4. **Authentication → Providers → Email**: keep it on; the app signs people in with a 6-digit email code.
   In **Authentication → Email Templates → Magic Link**, include `{{ .Token }}` so the email shows the code.
5. Put the project URL and publishable key in `.env` (see `.env.example`).

## Day-to-day operations (Supabase dashboard → SQL editor)

Make yourself admin (after you sign in once in the app):
```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

Add a captain and their boat (after the captain signs in once in the captain app):
```sql
update profiles set role = 'captain', full_name = 'Capt. Name', whatsapp = '+504XXXXXXXX'
 where id = (select id from auth.users where email = 'captain@example.com');
insert into boats (captain_id, name, kind, seats)
values ((select id from auth.users where email = 'captain@example.com'), 'Water taxi 03', 'taxi', 8);
```

Sign up a business as a partner and turn on instant booking for one of its listings:
```sql
insert into operators (name, whatsapp, is_partner) values ('Wahoo Slayer Fishing Charter', '+504XXXXXXXX', true) returning id;
update listings set operator_id = 'PASTE-ID', booking = 'instant', price_usd = 450, unit = 'boat'
 where id = 'fish-wahoo-slayer-fishing-charter';
```

Send a price for a concierge request:
```sql
update bookings set total_usd = 320, status = 'quoted', ops_note = 'Confirmed with captain' where id = 'BOOKING-ID';
```

See requests waiting for your team:
```sql
select b.id, l.name, b.trip_date, b.trip_time, b.quantity, b.created_at
  from bookings b join listings l on l.id = b.listing_id
 where b.status = 'requested' order by b.created_at;
```

## Not done yet (by design)

- **Payment processor.** `create-payment` and `payment-webhook` contain the full flow and the database side,
  but the processor-specific calls are marked `TODO(payments)`. Pick the processor first (docs/DECISIONS.md).
- **Push notifications** to captains for new rides. Today the captain app refreshes; add Expo push next.
- **Refunds** after a cancellation are manual from the processor dashboard.

## Running the tests

```bash
npm i -D @electric-sql/pglite   # once
npm run test:db                 # 35 database checks in an embedded Postgres
npm run test:server             # 9 pricing checks (needs Deno: https://deno.com)
npm run typecheck
```
