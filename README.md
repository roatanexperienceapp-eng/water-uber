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
| `supabase/migrations/` | Database tables and security rules |
