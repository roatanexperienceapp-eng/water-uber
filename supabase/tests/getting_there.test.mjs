// Database tests for the cruise van columns, guest location sharing and the crew "on the way" list.
// Usage: node supabase/tests/getting_there.test.mjs
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

const G = '11111111-1111-1111-1111-111111111111', H = '22222222-2222-2222-2222-222222222222';
const A = '55555555-5555-5555-5555-555555555555', C = '33333333-3333-3333-3333-333333333333', X = '44444444-4444-4444-4444-444444444444';
for (const id of [G, H, A, C, X]) await db.query('insert into auth.users (id) values ($1)', [id]);
await db.query("update profiles set role='admin' where id=$1", [A]);
await db.query("update profiles set full_name='Maria Lopez', whatsapp='+15550001' where id=$1", [G]);
await db.query("update crew set profile_id=$1 where id=(select id from crew order by sort limit 1)", [C]);

async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const today = (await one("select (now() at time zone 'America/Tegucigalpa')::date::text d")).d;
const ours = (await one("select id from listings where ours and booking='instant' limit 1")).id;
const partner = (await one("select id from listings where not ours limit 1")).id;
const call = (await one(`insert into ship_calls (call_date, ship_name, port, arrive_at, all_aboard_at)
  values ($1, 'Test Ship', 'coxen', now() - interval '1 hour', now() + interval '8 hours') returning id`, [today])).id;

// ---- Van columns ----
await throws(() => db.query(`insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status, van_seats)
  values ($1, $2, $3, '10:00', 2, 100, 'awaiting_payment', 2)`, [G, ours, today]), /van_all_or_nothing/, 'van needs price and both times');
await throws(() => db.query(`insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status, van_seats, van_usd, van_pickup_at, van_return_at)
  values ($1, $2, $3, '10:00', 2, 100, 'awaiting_payment', 2, 50, now(), now())`, [G, ours, today]), /van_needs_ship/, 'van only for cruise guests');
const vb = (await one(`insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status, ship_call_id, van_seats, van_usd, van_pickup_at, van_return_at)
  values ($1, $2, $3, '10:00', 2, 150, 'awaiting_payment', $4, 2, 50, now(), now() + interval '5 hours') returning id`, [G, ours, today, call])).id;
ok(!!vb, 'a cruise booking with the van saves');

// ---- Sharing location ----
await throws(() => as(null, 'select share_position(16.3, -86.5)'), /permission denied|sign_in/, 'anonymous visitors cannot share');
await throws(() => as(G, 'select share_position(16.3, -86.5)'), /no_trip_today/, 'unpaid booking: cannot share yet');
await db.query("update bookings set status='paid' where id=$1", [vb]);
await throws(() => as(G, 'select share_position(40.7, -74.0)'), /off_island/, 'a position off the island is refused (no home addresses)');
const p = (await as(G, 'select * from share_position(16.3195, -86.5390, 12)')).rows[0];
ok(p.sharing === true && p.accuracy_m === 12, 'paid trip today: guest shares position');
await as(G, 'select share_position(16.3200, -86.5400)');
ok((await one('select count(*)::int n from guest_positions')).n === 1, 'sharing again updates the one row');
await as(G, "update guest_positions set lat = 16.4").catch(() => null);
ok((await one('select lat from guest_positions')).lat === 16.32, 'guests cannot write the table directly');
const other = await as(H, 'select * from guest_positions');
ok(other.rows.length === 0, 'another guest cannot see the position');
await throws(() => as(H, 'select share_position(16.3, -86.5)'), /no_trip_today/, 'guest without a trip cannot share');

// ---- Crew list ----
await throws(() => as(G, 'select * from guests_on_the_way()'), /crew_only/, 'guests cannot see the crew list');
await throws(() => as(X, 'select * from guests_on_the_way()'), /crew_only/, 'an unlinked account cannot see the crew list');
let rows = (await as(C, 'select * from guests_on_the_way()')).rows;
ok(rows.length === 1 && rows[0].kind === 'booking' && rows[0].ship_name === 'Test Ship', 'linked crew sees today\'s paid tour with the ship');
ok(rows[0].guest_name === 'Maria' && rows[0].guest_whatsapp === '+15550001', 'crew sees first name and WhatsApp only');
ok(Math.abs(rows[0].lat - 16.32) < 1e-9 && rows[0].van_pickup_at, 'crew sees the shared position and van pickup');

// Partner listing without van: crew does not see it, admin does.
await db.query(`insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status) values ($1, $2, $3, '11:00', 1, 10, 'paid')`, [H, partner, today]);
ok((await as(C, 'select * from guests_on_the_way()')).rows.length === 1, 'crew does not see other businesses\' tours');
ok((await as(A, 'select * from guests_on_the_way()')).rows.length === 2, 'the office sees every paid trip today');

// Ride today
await db.query(`insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd, status) values ($1, 'we', 'inf', 2, 'private', 'now', 2, 20, 'paid')`, [H]);
rows = (await as(C, 'select * from guests_on_the_way()')).rows;
ok(rows.some((r) => r.kind === 'ride' && r.from_dock === 'we' && r.lat === null), 'crew sees today\'s rides; no position if the guest is not sharing');

// Stale position hidden
await db.query("update guest_positions set updated_at = now() - interval '3 hours' where guest_id=$1", [G]);
rows = (await as(C, 'select * from guests_on_the_way()')).rows;
ok(rows.find((r) => r.kind === 'booking' && r.title).lat === null, 'positions older than 2 hours are hidden');

// ---- Stop and erase ----
await as(G, 'select share_position(16.3200, -86.5400)');
await as(G, 'select stop_sharing_position()');
const stopped = await one('select * from guest_positions where guest_id=$1', [G]);
ok(stopped.sharing === false && stopped.lat === null && stopped.lon === null, 'stop sharing wipes the position');
await as(G, 'select share_position(16.3200, -86.5400)');
await db.query('update profiles set deleted_at = now() where id=$1', [G]);
const erased = await one('select * from guest_positions where guest_id=$1', [G]);
ok(erased.lat === null && !erased.sharing, 'deleting the account wipes the position');
await throws(() => as(G, 'select has_trip_today($1)', [G]), /permission denied/, 'has_trip_today is not callable from the app');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
