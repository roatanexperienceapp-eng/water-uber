// Database tests: runs the real migration + seed in an embedded Postgres (PGlite) with Supabase's
// auth schema stubbed, then checks prices can't be forged, RLS isolation, ride state machine and
// contact unlocking. Usage (from repo root):  node supabase/tests/db.test.mjs
// Needs: npm i -D @electric-sql/pglite   (or run from a folder where it is installed: PGLITE_DIR=...)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.env.PGLITE_DIR ?? process.cwd(), 'noop.js'));
const { PGlite } = await import(require.resolve('@electric-sql/pglite'));

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const db = new PGlite();
let passed = 0;
let failed = 0;
const ok = (cond, name) => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};
const throws = async (fn, re, name) => {
  try {
    await fn();
    ok(false, `${name} (expected error)`);
  } catch (e) {
    ok(re.test(String(e.message)), `${name} → ${e.message}`);
  }
};

// ---- Minimal stand-ins for what Supabase provides ----
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);
for (const f of (await import('node:fs')).readdirSync(path.join(root, 'migrations')).sort()) await db.exec(readFileSync(path.join(root, 'migrations', f), 'utf8'));
await db.exec(`
  -- Same as Supabase's defaults: full table privileges for API roles; Row Level Security is the only guard.
  grant all on all tables in schema public to anon, authenticated, service_role;
`);
await db.exec(readFileSync(path.join(root, 'seed.sql'), 'utf8'));

const count = async (sql) => Number((await db.query(sql)).rows[0].n);
ok((await count('select count(*) n from listings')) === 157, 'seed: 157 listings');
ok((await count('select count(*) n from portals')) === 14, 'seed: 14 portals');
ok((await count("select count(*) n from docks where in_flat_zone")) === 5, 'seed: 5 flat-zone docks');

// ---- People ----
const GUEST_A = '11111111-1111-1111-1111-111111111111';
const GUEST_B = '22222222-2222-2222-2222-222222222222';
const CAPT_1 = '33333333-3333-3333-3333-333333333333';
const CAPT_2 = '44444444-4444-4444-4444-444444444444';
for (const id of [GUEST_A, GUEST_B, CAPT_1, CAPT_2]) await db.query('insert into auth.users (id) values ($1)', [id]);
ok((await count('select count(*) n from profiles')) === 4, 'trigger: profile created for each new user');
await db.query("update profiles set role = 'captain', full_name = 'Capt. One', whatsapp = '+50499990001' where id = $1", [CAPT_1]);
await db.query("update profiles set role = 'captain', full_name = 'Capt. Two', whatsapp = '+50499990002' where id = $1", [CAPT_2]);
const boat1 = (await db.query("insert into boats (captain_id, name, kind, seats) values ($1, 'Taxi 1', 'taxi', 8) returning id", [CAPT_1])).rows[0].id;
await db.query("insert into boats (captain_id, name, kind, seats) values ($1, 'Taxi 2', 'taxi', 4)", [CAPT_2]);

// Run a statement as a signed-in user (RLS on).
async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

// ---- Rides are created by the server (service role) — clients cannot insert ----
await throws(
  () => as(GUEST_A, "insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd) values ($1,'we','inf',2,'shared','now',1.5,0)", [GUEST_A]),
  /row-level security|permission denied/,
  'guest cannot insert a ride with a forged $0 fare',
);
const ride = (
  await db.query("insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd) values ($1,'we','inf',2,'shared','now',1.5,10) returning *", [GUEST_A])
).rows[0];
ok(ride.status === 'awaiting_payment', 'new ride starts awaiting payment');

// ---- RLS isolation ----
ok((await as(GUEST_A, 'select * from rides')).rows.length === 1, 'guest A sees own ride');
ok((await as(GUEST_B, 'select * from rides')).rows.length === 0, 'guest B cannot see guest A ride');
ok((await as(CAPT_1, 'select * from rides')).rows.length === 0, 'captain cannot see unpaid rides');
ok((await as(GUEST_A, 'select * from operators')).rows.length === 0, 'guests cannot read operator contacts');
ok((await as(GUEST_A, 'select * from listings')).rows.length === 157, 'anyone can read the catalogue');

// ---- Guests cannot tamper with their own ride or fake payments ----
await as(GUEST_A, 'update rides set fare_usd = 0, status = $2 where id = $1', [ride.id, 'paid']);
const after = (await db.query('select fare_usd, status from rides where id = $1', [ride.id])).rows[0];
ok(Number(after.fare_usd) === 10 && after.status === 'awaiting_payment', 'guest update of own fare/status is silently ignored');
await throws(
  () => as(GUEST_A, "insert into payments (guest_id, ride_id, amount_usd, provider, status) values ($1, $2, 10, 'fake', 'succeeded')", [GUEST_A, ride.id]),
  /row-level security/,
  'guest cannot insert a fake succeeded payment',
);
await as(GUEST_A, 'delete from rides where id = $1', [ride.id]);
ok((await count(`select count(*) n from rides where id = '${ride.id}'`)) === 1, 'guest cannot delete a ride');

// ---- Guests cannot promote themselves ----
await throws(() => as(GUEST_A, "update profiles set role = 'admin' where id = $1", [GUEST_A]), /only_admin_can_change_role/, 'guest cannot make themselves admin');
await as(GUEST_A, "update profiles set full_name = 'Ana' where id = $1", [GUEST_A]);
ok((await db.query('select full_name from profiles where id = $1', [GUEST_A])).rows[0].full_name === 'Ana', 'guest can edit own name');
await throws(() => as(GUEST_A, 'select mark_payment_succeeded($1, $2)', [ride.id, 'x']), /permission denied/, 'guest cannot mark a payment succeeded');

// ---- Payment → paid (server side, idempotent) ----
await throws(() => as(CAPT_1, 'select accept_ride($1)', [ride.id]), /ride_not_available|ride_not_found/, 'captain cannot accept an unpaid ride');
const pay = (await db.query("insert into payments (guest_id, ride_id, amount_usd, provider) values ($1, $2, 10, 'test') returning id", [GUEST_A, ride.id])).rows[0].id;
await db.query("select mark_payment_succeeded($1, 'ch_1')", [pay]);
await db.query("select mark_payment_succeeded($1, 'ch_1')", [pay]);
ok((await db.query('select status from rides where id = $1', [ride.id])).rows[0].status === 'paid', 'webhook marks ride paid (twice is harmless)');
ok((await as(CAPT_1, 'select * from rides')).rows.length === 1, 'captain sees paid ride waiting for a boat');
ok((await as(GUEST_A, 'select * from ride_contact($1)', [ride.id])).rows.length === 0, 'no captain WhatsApp before a captain accepts');

// ---- Accept: first captain wins, second is refused ----
const accepted = (await as(CAPT_1, 'select * from accept_ride($1)', [ride.id])).rows[0];
ok(accepted.status === 'accepted' && accepted.captain_id === CAPT_1, 'captain 1 accepts');
await throws(() => as(CAPT_2, 'select accept_ride($1)', [ride.id]), /ride_not_available/, 'captain 2 cannot take the same ride');
ok((await as(CAPT_2, 'select * from rides')).rows.length === 0, "captain 2 no longer sees captain 1's ride");

// ---- Contact unlock ----
const contact = (await as(GUEST_A, 'select * from ride_contact($1)', [ride.id])).rows[0];
ok(contact?.whatsapp === '+50499990001', 'paying guest gets the captain WhatsApp after acceptance');
ok((await as(GUEST_B, 'select * from ride_contact($1)', [ride.id])).rows.length === 0, 'another guest gets nothing');

// ---- State machine ----
await throws(() => as(CAPT_1, "select advance_ride($1, 'completed')", [ride.id]), /bad_transition/, 'cannot skip from accepted to completed');
await as(CAPT_1, "select advance_ride($1, 'onboard')", [ride.id]);
await throws(() => as(GUEST_A, 'select cancel_ride($1)', [ride.id]), /too_late_to_cancel/, 'guest cannot cancel once aboard');
await as(CAPT_1, "select advance_ride($1, 'completed')", [ride.id]);
ok((await db.query('select status from rides where id = $1', [ride.id])).rows[0].status === 'completed', 'ride completes');

// ---- Boat too small ----
const big = (
  await db.query("insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd, status) values ($1,'we','inf',8,'private','now',1.5,40,'paid') returning id", [GUEST_B])
).rows[0].id;
await throws(() => as(CAPT_2, 'select accept_ride($1)', [big]), /boat_too_small/, '4-seat boat cannot take 8 riders');

// ---- Positions: captains write only their own boat ----
await as(CAPT_1, 'insert into boat_positions (boat_id, lon, lat, online) values ($1, -86.6, 16.3, true)', [boat1]);
await throws(
  () => as(CAPT_2, 'insert into boat_positions (boat_id, lon, lat, online) values ($1, -86.6, 16.3, true) on conflict (boat_id) do update set lat = 0', [boat1]),
  /row-level security/,
  "captain 2 cannot move captain 1's boat",
);
ok((await as(GUEST_A, 'select * from live_boats')).rows.length === 1, 'guest map shows the online boat');

// ---- Bookings contact unlock ----
const bk = (
  await db.query("insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status) values ($1, 'snork-shipwreck-snorkel-tour', current_date + 1, '09:00', 2, 170, 'awaiting_payment') returning id", [GUEST_A])
).rows[0].id;
await db.query("update operators set whatsapp = '+50488887777'");
ok((await as(GUEST_A, 'select * from booking_contact($1)', [bk])).rows.length === 0, 'no operator WhatsApp before payment');
const bpay = (await db.query("insert into payments (guest_id, booking_id, amount_usd, provider) values ($1, $2, 170, 'test') returning id", [GUEST_A, bk])).rows[0].id;
await db.query("select mark_payment_succeeded($1, 'ch_2')", [bpay]);
ok((await as(GUEST_A, 'select * from booking_contact($1)', [bk])).rows[0]?.whatsapp === '+50488887777', 'operator WhatsApp unlocks after payment');

// ---- Assistant rate limit ----
let last;
for (let i = 0; i < 3; i++) last = (await db.query('select bump_assistant_usage($1, 2) as ok', [GUEST_A])).rows[0].ok;
ok(last === false, 'assistant limit blocks the 3rd call when limit is 2');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
