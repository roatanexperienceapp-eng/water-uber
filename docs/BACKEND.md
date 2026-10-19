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
   npx supabase functions deploy         # deploys all eleven functions
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
4. **Authentication → Providers → Email**: keep it on; the app signs people in with a 6-digit email code.
   In **Authentication → Email Templates → Magic Link**, include `{{ .Token }}` so the email shows the code.
5. Put the project URL and publishable key in `.env` (see `.env.example`).
6. **Turn on the pickup watchdog** (guaranteed pickups, repeat rides, shared boats depend on it). In
   **Database → Extensions** enable `pg_cron` and `pg_net`, then run once in the SQL editor:
   ```sql
   select cron.schedule('pickup-watchdog', '* * * * *', $$
     select net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/pickup-watchdog',
       headers := jsonb_build_object('apikey', 'YOUR_SB_SECRET_KEY', 'Content-Type', 'application/json'),
       body := '{}'::jsonb)
   $$);
   ```
   Every minute it re-assigns rides whose captain hasn't confirmed 15 min before pickup, credits guests
   for missed pickups, creates the next 24 h of repeat rides, and closes shared boats that have left.
   Store the secret key in Vault rather than pasting it if you prefer (`vault.create_secret`).

## Payments and cruise features

See **docs/PAYMENTS.md** (how money flows, go-live checklist, daily money checks) and **docs/CRUISE.md**
(ship schedule, meeting points, QR links, universal links).

## Week-stay features (the 7)

All business numbers live in `supabase/functions/_shared/features.ts` → `FEATURE_SETTINGS`. Change a value
there, redeploy functions and ship an app update; app and server read the same file.

| # | Feature | Server side | App side |
|---|---|---|---|
| 1 | Guaranteed pickup | `confirm_ride`, `run_pickup_watchdog`, `ride_credits` | badge on Ride/Checkout, status on Confirmation/Trips, captain "On my way" |
| 2 | Safe night rides | `create-ride` blocks after last boat; `needs_lit_boat`; `boats.has_lights` checked in `accept_ride` | night banner, land-taxi button, captain sees "lights required" |
| 3 | Shared-seat matching | `shared_boats`, `take_shared_seats` | "Shared boats leaving soon" cards on Ride |
| 4 | Week pass / ride packs | `guest_passes`, `create-pass`, `consume_pass_ride` | `/pass`, "Covered by your pass" on Ride/Checkout |
| 5 | Repeat rides + saved places | `repeat_rides`, `create-repeat-ride`, `saved_places` | place chips + save on Ride, repeat switch, pause/resume on Trips, Account |
| 6 | Sea alerts from captains | `sea_reports`, `report_sea` (3 h expiry) | sea strip on Ride; captain buttons per coast |
| 7 | Boat booked with the activity | `rides.booking_id`, ownership check in `create-ride` | "Add a water taxi there and back" on activity checkout |

Ride pass prices (owner prices): **$35 per person per week, any group from 2 to 12; two weeks costs double**
(2 people $70 / $140 … 3 people $105 / $210 … 12 people $420 / $840). Change `passPricing` and `passes` in
`supabase/functions/_shared/features.ts`.

**Piers** (`supabase/functions/_shared/geo.ts` → `DOCKS`): 28 piers grouped West End, West Bay, Sandy Bay, Coxen Hole,
French Harbour and East End. All 21 West End + West Bay piers are in the **$5 flat zone**. Sandy Bay has fixed fares (`PRICING.zoneFares`):
West Bay ↔ Sandy Bay **$15 pp**, West End ↔ Sandy Bay **$10 pp**, both with a **3-person minimum**. Everything else is $5 per rider per
mile along sea lanes that never cross land (`geo.test.ts` checks this). Piers marked `approx: true` were placed from the
coastline map by name — stand on each one with a phone, read the GPS, and replace `lon`/`lat` before launch (fares to
Sandy Bay, Pristine Bay and Palmetto Bay depend on it). Then run `node scripts/generate-seed.mjs`.

**Your tours** (`src/data/catalogue.ts`, then `node scripts/generate-seed.mjs`):
- Snorkel: Shipwreck $95 pp · Pigeon Key nurse shark swim $190 pp · Blue Channel $30 pp · Dolphin show $45 pp · Cayos Cochinos (full day) $190 pp
- Fishing: Bottom fishing $60 pp · Deep sea trolling, half day, $350 per boat (up to 6 people per boat → 8 people pay for 2 boats; `TOUR_SETTINGS.seatsPerBoat` in `supabase/functions/_shared/tours.ts`)

**Packages** (`supabase/functions/_shared/bundle.ts` → `BUNDLE_SETTINGS`): a pass plus your own tours, bought in
one payment. Add 1 tour → **10% off everything**, snorkel + fishing → **15% off**. Every tour above can go in a package
(one snorkel + one fishing per package). Prices always come from the database at checkout, never from the phone.

**Captains** (`supabase/functions/_shared/crew.ts` → table `crew`): Captain Fletcher, Captain Jordan, Captain Patrick,
Captain Big John, Gordo, David, Justin, Captain Quinn, Captain Darcy, Captain Carter — water taxi, fishing and snorkel.
Guests see names on the "Our captains" page, in Explore, on your tours and on their ride. The **Certified** badge only
shows once the office has entered a licence number + expiry; a captain cannot accept paying rides without it, and the badge
disappears the day after the licence expires:
```sql
-- as an admin, once per captain (from the Supabase SQL editor or the admin tools):
select verify_crew_license('fletcher', '<licence number>', '2027-06-30');
-- link the captain's app account after he signs in:
update crew set profile_id = (select id from auth.users where email = 'fletcher@example.com') where id = 'fletcher';
```

Mark which boats have running lights (only those get night rides):
```sql
update boats set has_lights = true where name in ('Water taxi 03', 'Water taxi 07');
```

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

- **Payment processor account.** The full payment system is built and tested (docs/PAYMENTS.md): hosted
  checkout, signed webhooks, amount checks, refunds, group splits, commission ledger. It needs a processor
  account and keys to take real money.
- **Push notifications** to captains for new rides. Today the captain app refreshes; add Expo push next.
- **Refunds** after a cancellation are manual from the processor dashboard.
- **Share-my-ride page.** The app creates a secret link (`islandride.app/track/<token>`) and the database
  answers `shared_ride_status(token)`, but the small public web page at that address isn't hosted yet.

## Running the tests

```bash
npm i -D @electric-sql/pglite   # once
npm run test:db                 # 234 database checks in an embedded Postgres (security, week-stay, payments, cruise, inbox, giving, account, packages, captains, community)
npm run test:server             # 24 pricing, feature, payment and cruise-rule checks (needs Deno: https://deno.com)
npm run typecheck
```
