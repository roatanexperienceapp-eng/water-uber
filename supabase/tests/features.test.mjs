// Database tests for the week-stay features. Usage: node supabase/tests/features.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.env.PGLITE_DIR ?? process.cwd(), 'noop.js'));
const { PGlite } = await import(require.resolve('@electric-sql/pglite'));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const db = new PGlite();
let passed = 0, failed = 0;
const ok = (c, n) => { c ? passed++ : failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const throws = async (fn, re, n) => { try { await fn(); ok(false, `${n} (expected error)`); } catch (e) { ok(re.test(String(e.message)), `${n} → ${e.message}`); } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);
for (const f of readdirSync(path.join(root, 'migrations')).sort()) await db.exec(readFileSync(path.join(root, 'migrations', f), 'utf8'));
await db.exec('grant all on all tables in schema public to anon, authenticated, service_role;');
await db.exec(readFileSync(path.join(root, 'seed.sql'), 'utf8'));

const G = '11111111-1111-1111-1111-111111111111', G2 = '22222222-2222-2222-2222-222222222222';
const C1 = '33333333-3333-3333-3333-333333333333', C2 = '44444444-4444-4444-4444-444444444444';
for (const id of [G, G2, C1, C2]) await db.query('insert into auth.users (id) values ($1)', [id]);
await db.query("update profiles set role='captain', full_name='Capt One' where id=$1", [C1]);
await db.query("update profiles set role='captain', full_name='Capt Two' where id=$1", [C2]);
const b1 = (await db.query("insert into boats (captain_id,name,kind,seats,has_lights) values ($1,'Lit boat','taxi',8,true) returning id", [C1])).rows[0].id;
const b2 = (await db.query("insert into boats (captain_id,name,kind,seats,has_lights) values ($1,'Dark boat','taxi',8,false) returning id", [C2])).rows[0].id;
for (const [id, crew] of [[C1, 'patrick'], [C2, 'quinn']]) await db.query("update crew set profile_id=$1, license_no='HN-X', license_expires='2099-12-31', verified_at=now() where id=$2", [id, crew]);
await db.query('insert into boat_positions (boat_id, lon, lat, online) values ($1,-86.6,16.3,true), ($2,-86.6,16.29,true)', [b1, b2]);

async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const newRide = (extra = '', vals = []) => one(
  `insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, scheduled_for, pickup_at, miles, fare_usd, status${extra ? ',' + extra : ''})
   values ($1,'we','inf',2,'private','scheduled', now() + interval '1 hour', now() + interval '1 hour', 1.5, 25, 'paid'${vals.length ? ',' + vals.map((_, i) => '$' + (i + 2)).join(',') : ''}) returning *`, [G, ...vals]);

// ---- 1. Guaranteed pickup ----
let r = await newRide();
await as(C1, 'select accept_ride($1)', [r.id]);
ok((await one('select captain_confirmed_at from rides where id=$1', [r.id])).captain_confirmed_at === null, 'ride an hour away is accepted but not yet confirmed');
await throws(() => as(C2, 'select confirm_ride($1)', [r.id]), /not_your_ride/, "another captain cannot confirm someone else's ride");
await as(C1, 'select confirm_ride($1)', [r.id]);
ok((await one('select captain_confirmed_at from rides where id=$1', [r.id])).captain_confirmed_at !== null, 'assigned captain confirms');

let r2 = await newRide();
await as(C1, 'select accept_ride($1)', [r2.id]);
await db.query("update rides set pickup_at = now() + interval '10 minutes' where id=$1", [r2.id]);
let wd = await one('select * from run_pickup_watchdog()');
let after = await one('select status, captain_id, reassign_count from rides where id=$1', [r2.id]);
ok(wd.reassigned === 1 && after.status === 'paid' && after.captain_id === null && after.reassign_count === 1, 'unconfirmed ride 10 min out goes back to the queue');
ok((await one('select available from boat_positions where boat_id=$1', [b1])).available === true, "reassigned captain's boat is free again");

let r3 = await newRide();
await db.query("update rides set pickup_at = now() - interval '15 minutes' where id=$1", [r3.id]);
wd = await one('select * from run_pickup_watchdog()');
await db.query('select * from run_pickup_watchdog()');
ok(Number((await one('select count(*) n from ride_credits where ride_id=$1', [r3.id])).n) === 1, 'missed pickup earns exactly one credit (watchdog twice)');
ok((await as(G, 'select * from ride_credits')).rows.length >= 1 && (await as(G2, 'select * from ride_credits')).rows.length === 0, 'credits are private to the guest');
await throws(() => as(G, 'select run_pickup_watchdog()'), /permission denied/, 'guests cannot run the watchdog');

// ---- 2. Night rides ----
const night = await newRide('needs_lit_boat', [true]);
await throws(() => as(C2, 'select accept_ride($1)', [night.id]), /needs_lit_boat/, 'boat without lights cannot take a night ride');
ok((await as(C1, 'select * from accept_ride($1)', [night.id])).rows[0].status === 'accepted', 'lit boat takes the night ride');
const tok = (await as(G, 'select enable_ride_share($1) t', [night.id])).rows[0].t;
ok(tok.length === 64, 'guest gets a share link token');
await throws(() => as(G2, 'select enable_ride_share($1)', [night.id]), /not_your_ride/, "cannot share someone else's ride");
const seen = (await as(null, 'select * from shared_ride_status($1)', [tok])).rows[0];
ok(seen && seen.boat_name === 'Lit boat' && seen.lat !== null, 'family with the link (not signed in) sees boat and position');
ok((await as(null, 'select * from shared_ride_status($1)', ['short'])).rows.length === 0, 'a guessed short token shows nothing');
ok(!('fare_usd' in seen) && !('guest_id' in seen), 'shared view hides price and guest identity');

// ---- 3. Shared seats ----
const s1 = (await one("select take_shared_seats('we','inf',1,15,3) id")).id;
const s2 = (await one("select take_shared_seats('we','inf',1,15,3) id")).id;
ok(s1 === s2, 'second rider joins the same open boat');
await one("select take_shared_seats('we','inf',1,15,3)");
const sb = await one('select seats_taken, status from shared_boats where id=$1', [s1]);
ok(sb.seats_taken === 3 && sb.status === 'full', 'third rider fills the boat and it leaves now');
const s4 = (await one("select take_shared_seats('we','inf',1,15,3) id")).id;
ok(s4 !== s1, 'next rider opens a new boat');
ok((await as(G2, 'select * from shared_boats')).rows.length >= 1, 'open shared boats are visible to guests');
await throws(() => as(G, "select take_shared_seats('we','inf',1,15,3)"), /permission denied/, 'guests cannot grab seats directly');

// ---- 4. Passes ----
const pass = await one("insert into guest_passes (guest_id, pass_type, riders, price_usd, starts_at, expires_at, rides_total) values ($1,'tenPack',1,40,now(),now()+interval '30 days',2) returning id", [G]);
ok((await one('select consume_pass_ride($1,$2,now()) ok', [pass.id, G])).ok === false, 'unpaid pass cannot be used');
const pp = await one("insert into payments (guest_id, pass_id, amount_usd, provider) values ($1,$2,40,'test') returning id", [G, pass.id]);
await db.query("select mark_payment_succeeded($1,'ch_p')", [pp.id]);
ok((await one('select status from guest_passes where id=$1', [pass.id])).status === 'active', 'payment activates the pass');
ok((await one('select consume_pass_ride($1,$2,now()) ok', [pass.id, G2])).ok === false, "another guest cannot use someone else's pass");
ok((await one('select consume_pass_ride($1,$2,now()) ok', [pass.id, G])).ok === true, 'pass ride 1');
ok((await one('select consume_pass_ride($1,$2,now()) ok', [pass.id, G])).ok === true, 'pass ride 2');
ok((await one('select consume_pass_ride($1,$2,now()) ok', [pass.id, G])).ok === false, 'used-up pass refuses ride 3');
await throws(() => as(G, "update guest_passes set rides_used=0 where id=$1 returning id", [pass.id]).then((x) => { if (!x.rows.length) throw new Error('blocked'); }), /blocked/, 'guest cannot reset their pass');

// ---- 5. Saved places and repeat rides ----
await as(G, "insert into saved_places (guest_id,label,dock_id,icon) values ($1,'My rental','we','home')", [G]);
await throws(() => as(G, "insert into saved_places (guest_id,label,dock_id) values ($1,'Sneaky','we')", [G2]), /row-level security/, "cannot save a place on someone else's account");
ok((await as(G2, 'select * from saved_places')).rows.length === 0, "saved places are private");
await throws(() => as(G, "insert into repeat_rides (guest_id,from_dock,to_dock,riders,pickup_time,start_date,end_date,fare_usd,miles) values ($1,'we','inf',1,'08:30',current_date,current_date+5,0,1.5)", [G]), /row-level security/, 'guest cannot create a repeat ride with a made-up fare');
const rr = await one("insert into repeat_rides (guest_id,from_dock,to_dock,riders,pickup_time,start_date,end_date,fare_usd,miles) values ($1,'we','inf',1, to_char((now() at time zone 'America/Tegucigalpa') + interval '2 hours','HH24:MI'), current_date - 1, current_date + 5, 10, 1.5) returning id", [G]);
await db.query('select * from run_pickup_watchdog()');
await db.query('select * from run_pickup_watchdog()');
const made = await db.query('select fare_usd, status from rides where repeat_id=$1', [rr.id]);
ok(made.rows.length === 1 && Number(made.rows[0].fare_usd) === 10 && made.rows[0].status === 'awaiting_payment', 'repeat ride creates exactly one ride for the next 24h, at the server price');
await throws(() => as(G, "update repeat_rides set pickup_time='03:00' where id=$1", [rr.id]), /only_pause_allowed/, 'guest cannot edit a repeat ride, only pause it');
await as(G, 'update repeat_rides set active=false where id=$1', [rr.id]);
ok((await one('select active from repeat_rides where id=$1', [rr.id])).active === false, 'guest can pause a repeat ride');

// ---- 6. Sea conditions ----
await as(C1, "select report_sea('north','choppy')");
await throws(() => as(G, "select report_sea('west','calm')"), /not_a_captain/, 'guests cannot post sea reports');
ok((await as(G2, 'select * from sea_reports')).rows.length === 1, 'everyone can read sea reports');

// ---- 7. Activity-linked ride ----
const bk = await one("insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, status) values ($1,'dive-west-bay-divers', current_date+1, '09:00', 2, 'requested') returning id", [G]);
const linked = await newRide('booking_id', [bk.id]);
ok(linked.booking_id === bk.id, 'a ride can be linked to the booked activity');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
