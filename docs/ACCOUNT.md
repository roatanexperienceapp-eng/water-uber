# Account page: what's there and what your team does with it

Guests see: **Help · Wallet · Safety · Inbox** tiles, a **Safety checkup** (5 steps), and Manage account,
Settings, Saved places, Ride passes, Offers, Drive with Water Uber, List your business, Every Child Roatán, Legal.

Left out on purpose (they don't apply to this app): ratings, family accounts, simple mode, business profiles,
partner rewards, Eats.

## Required by the app stores

- **Delete account** (Apple 5.1.1(v)): Manage account → Delete my account. Erases name, contacts, saved places
  and messages and permanently disables the login. Anonymous payment records stay (tax law). Blocked while the
  guest has an upcoming paid trip, so nobody loses a paid tour by accident.
- **Privacy policy and terms**: the Legal screen opens `EXPO_PUBLIC_WEB_URL/privacy` and `/terms`. Those two pages
  must exist on your website before you submit to the App Store (Apple also asks for the privacy URL in
  App Store Connect).
- **Offers notifications are OFF by default** (Apple 4.5.4); guests opt in under Settings.

## Daily: help requests

```sql
-- Open requests, safety first
select id, topic, message, created_at from support_requests where status = 'open'
 order by (topic = 'safety') desc, created_at;

-- Reply (the guest sees it in Inbox → Support), then close it
insert into inbox_messages (category, title, body, guest_id)
values ('support', 'About your hat', 'Found it! Pick it up at the West End dock office.',
        (select guest_id from support_requests where id = 'REQUEST-ID'));
update support_requests set status = 'answered' where id = 'REQUEST-ID';
```
Safety reports send the guest an instant Priority acknowledgement ("If anyone is in danger, call 911 first").

## Weekly: captain and business applications

```sql
select kind, name, whatsapp, business_name, details, created_at from partner_applications where status = 'new';
update partner_applications set status = 'approved' where id = 'APPLICATION-ID';
```
Approving doesn't create the boat or listing by itself. Add captains and partners as in docs/BACKEND.md
("Add a captain and their boat", "Sign up a business as a partner").

## Emergency contacts

Stored on the guest's profile (`emergency_name`, `emergency_phone`); only the guest and admins can read them.
```sql
select full_name, emergency_name, emergency_phone from profiles where id = 'GUEST-ID';
```
