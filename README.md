# Water Uber

Water taxi + island guide app for Roatán, Honduras. One codebase builds two apps:
the **guest app** (book water taxis, explore tours, search businesses) and the **captain app** (live GPS, accept rides).

- **App:** Expo (React Native, Expo Router), iOS + Android
- **Backend:** Supabase (Postgres with row-level security, edge functions)

## Run it

```bash
npm install
npx expo start          # scan the QR code with Expo Go
```

Without a `.env`, the app runs in demo mode: simulated boats, nothing charged.
Backend setup and day-to-day operations: see [docs/BACKEND.md](docs/BACKEND.md).

## Tests

```bash
npm test                # app logic (search)
npm run typecheck
npm run test:db         # database security checks (needs @electric-sql/pglite)
npm run test:server     # pricing checks (needs Deno)
```

## Where things live

| Path | What |
|---|---|
| `src/app/` | Screens (Expo Router) |
| `src/lib/api.ts` | All data access; screens never call Supabase directly |
| `src/lib/search.ts` | Business and product search |
| `src/data/catalogue.ts` | 14 portals and 157 Roatán listings (seeds the database) |
| `supabase/functions/_shared/pricing.ts` | **The only place prices are defined** |
| `supabase/functions/_shared/features.ts` | Week-stay feature rules and owner settings (pass prices, credits, night hours) |
| `src/lib/stay.ts` | Passes, shared seats, sea reports, saved places, repeat rides |
| `supabase/functions/_shared/cruise.ts` | Cruise rules: port-time fit, transfer times, crowd meter, split deadlines |
| `supabase/functions/_shared/payments.ts` | Payment provider boundary (Stripe adapter, signature checks, cents maths) |
| `docs/PAYMENTS.md` | How money works + go-live checklist |
| `docs/GIVING.md` | Donations to Every Child Roatán, the 10% pledge, monthly transfer routine |
| `docs/INBOX.md` | Inbox: how to send offers/support/updates, the Priority rule, automatic messages |
| `docs/CRUISE.md` | Cruise features + what the team maintains (ship schedule, meeting points) |
| `supabase/migrations/` | Database tables and security rules |

## Open decisions

- **Payment processor**: Stripe (needs a US company) or a Honduran processor. See docs/PAYMENTS.md.
- **Brand name and bundle ids**: "Water Uber" carries trademark risk; bundle ids can't change after the first store release.
- **Website domain** for no-download booking (`EXPO_PUBLIC_WEB_URL`).
