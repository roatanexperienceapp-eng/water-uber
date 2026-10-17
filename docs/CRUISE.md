# Cruise visitors: how the features work and what your team maintains

## The 7 features

| # | Feature | Where |
|---|---|---|
| 1 | **Ship button** next to the language button. Picking today's ship turns on cruise mode. | `src/components/ShipButton.tsx` |
| 2 | **All-aboard countdown** on Explore, portals, checkout and confirmation. Orange under 2 h, red under 1 h. | `AllAboardBar.tsx` |
| 3 | **"Fits your port time"** badges; checkout only offers start times that get the group back to the port 60 min before all-aboard. The server refuses anything else. | `_shared/cruise.ts`, `create-booking` |
| 4 | **Book without installing**: every listing has a QR / link (`/l/<id>`) that opens the website, or the app if installed. Guests get an anonymous session, no sign-up. | `ShareQR.tsx`, `app/l/[id].tsx` |
| 5 | **Offline ticket**: QR + 8-letter code, meeting point, ship deadline, saved on the phone. Trips shows "You're offline. Your tickets still work." | `TicketCard.tsx`, `lib/tickets.ts` |
| 6 | **Meeting point card**: port gate for tours with port pickup (orange Water Uber sign), otherwise the operator's spot plus taxi time from the port. | `lib/meeting.ts` |
| 7 | **Crowd meter**: ships in port today → quiet / busy / very busy / packed, with advice. | `CrowdMeter.tsx` |
| + | **Split with my group**: each friend pays their share by link (web, no app). Spot held until everyone pays; unpaid at the deadline → cancelled and refunded automatically. | `SplitCard.tsx`, `app/split/[token].tsx` |

All cruise times are **island time** and say so. Many ships keep a different clock from the island, so the
app tells guests to check their ship's daily planner.

## Owner settings (`supabase/functions/_shared/cruise.ts` → `CRUISE_SETTINGS`)

| Setting | Now | Meaning |
|---|---|---|
| `backAtPortMinutesBefore` | 60 | Guests must be back at the gate this long before all-aboard |
| `disembarkMinutes` | 30 | Ship docks → guest at the gate |
| `crowd` | 4,000 / 8,000 / 12,000 | Passengers ashore for busy / very busy / packed |
| `splitPayBeforeMinutes` | 60 | Group must finish paying this long before the start |
| `splitMaxHours` | 24 | …and within 24 h of booking |

**Road times from each port** (`TRANSFER_MINUTES` in the same file) are estimates. Check them against your
own drivers' times; they decide what "fits".

## What your team maintains

### The ship schedule (every week)
The app reads the `ship_calls` table. Enter each call from the port's published schedule:
```sql
insert into ship_calls (call_date, ship_name, cruise_line, port, arrive_at, all_aboard_at, passengers) values
 ('2026-11-03', 'Ship name', 'Line', 'coxen',    '2026-11-03 08:00-06', '2026-11-03 17:00-06', 4200),
 ('2026-11-03', 'Ship name', 'Line', 'mahogany', '2026-11-03 07:00-06', '2026-11-03 16:30-06', 3900);
```
`port` is `coxen` (Port of Roatán, Town Center) or `mahogany` (Mahogany Bay). Use **island time** with `-06`.
All-aboard is usually 30 minutes before departure; use the ship's published all-aboard if you have it.

### Meeting points and port pickup
For each partner listing:
```sql
update listings set port_pickup = true,
  meeting_text = 'Blue tent at the end of the Half Moon Bay dock.',
  duration_minutes = 150
 where id = 'snork-...';
```
`duration_minutes` overrides the typical length for the category, so set it for anything unusual.
A photo of the meeting spot can go in `meeting_photo_url` (take your own photo; don't copy one).

### Checking guests in
The guide scans the QR (or types the 8-letter code). Operators who have an app login (`operators.owner_id`)
can check in only their own guests; admins can check in anyone (`select * from check_in('CYLN8JA1');`).
A scanner screen for operators is the natural next feature.

## Universal links (so links open the app when it's installed)

The app is configured for `EXPO_PUBLIC_WEB_URL` (paths `/l/`, `/split/`, `/ship/`). The website must serve:

- `https://YOUR-DOMAIN/.well-known/apple-app-site-association` (JSON, no extension) listing
  `TEAMID.com.roatanexperience.watertaxi` with paths `/l/*`, `/split/*`, `/ship/*`;
- `https://YOUR-DOMAIN/.well-known/assetlinks.json` with the Android package name and the SHA-256 of the
  Play signing certificate (from the Play Console).

Without these files the links still work; they just open the website instead of the app.

## Printing QR codes

- **One listing:** tap the QR icon on any listing → Share link / screenshot the QR.
- **A pier sign for a ship day:** a QR to `https://YOUR-DOMAIN/ship/<ship_call id>` sets the guest's ship and
  opens Explore in cruise mode.

## App Clips / Instant Apps (later)

The website is the no-download path today. An iOS App Clip (and Android Instant App) can come after launch.
It needs a separate small target, Apple's size limits, and a native build; it isn't worth doing before the
main app is approved.
