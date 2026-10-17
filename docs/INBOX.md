# Inbox: sending offers, support notes, updates and alerts

Guests have an **Inbox** tab with filters **All · Offers · Support · Updates · Priority** and an unread badge.

## The one rule

**Priority = safety and trip alerts only.** Rough water, schedule changes, a ship-deadline risk, a cancelled
booking. Never promotions. The database refuses messages in Priority that look like a promotion
("% off", "discount", "promo", "sale", "oferta"…). If guests learn Priority sometimes holds ads, they stop
reading it, and the day a real alert matters it gets ignored.

## How to send

**In the app:** sign in as an admin → Account → **Send inbox message**. Choose type, who sees it (everyone,
cruise visitors, week-stay guests), title, message, an optional button (Ride, Passes, a portal…), and how many
days it shows.

**From the database** (for things the screen doesn't do yet):
```sql
-- A personal Support note to one guest (find their id in auth.users by email)
insert into inbox_messages (category, title, body, guest_id)
values ('support', 'About your towels', 'We''ll have 4 towels on the boat at 2 pm.',
        (select id from auth.users where email = 'guest@example.com'));

-- An offer only for one ship's passengers, with Spanish text
insert into inbox_messages (category, title, body, cta_label, cta_path, ship_call_id, translations, expires_at)
values ('offer', 'Back before all-aboard', 'Snorkel the shipwreck with port pickup.', 'See snorkel trips', '/portal/snork',
        'SHIP-CALL-ID', '{"es": {"title": "De vuelta antes del all-aboard", "body": "Snorkel en el naufragio con recogida en el puerto."}}',
        now() + interval '1 day');
```
Buttons can only open pages inside the app (paths starting with `/`), never outside websites.

## Messages the app sends by itself

| When | Category | To |
|---|---|---|
| A captain reports **rough** water | Priority | everyone (once per coast per 2 h, gone after 3 h) |
| A group booking expires unpaid | Priority | the organizer |
| A booking is paid | Update ("Your ticket is ready" → opens the ticket) | the guest |
| A refund is sent | Update | the guest |
| A missed-pickup credit is added | Update | the guest |

## Not built yet (and why)

- **Phone notifications (push).** The inbox only shows when the app is open. Push needs Expo push tokens and a
  sender, and **Apple only allows promotional push if the guest opted in** (App Review Guideline 4.5.4).
  Plan: push for Priority and Updates by default, Offers only with a separate opt-in switch.
- **Two-way support chat.** Support messages are one-way from your team today; guests reach you through Isla or
  the operator's WhatsApp after paying.
