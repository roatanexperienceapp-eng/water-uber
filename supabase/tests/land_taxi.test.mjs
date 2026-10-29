// Database tests for the land taxi: vehicles, drivers, rides, payments. Usage: node supabase/tests/land_taxi.test.mjs
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
const A = '55555555-5555-5555-5555-555555555555', D = '33333333-3333-3333-3333-333333333333', V = '44444444-4444-4444-4444-444444444444';
for (const id of [G, H, A, D, V]) await db.query('insert into auth.users (id) values ($1)', [id]);
await db.query("update profiles set role='admin' where id=$1", [A]);
await db.query("update profiles set full_name='Maria Lopez', whatsapp='+15550001' where id=$1", [G]);
await db.query("update profiles set full_name='Kevin Driver', whatsapp='+50499990002' where id=$1", [D]);

async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];

const car = (await one(`insert into vehicles (name, kind, seats, plate, color, driver_id, driver_name) values ('Corolla', 'car', 4, 'HBX1234', 'White', $1, 'Kevin') returning id`, [D])).id;
const van = (await one(`insert into vehicles (name, kind, seats, driver_id, driver_name) values ('Hiace', 'van', 12, $1, 'Vic') returning id`, [V])).id;
await db.query(`insert into vehicle_positions (vehicle_id, lat, lon, online, available) values ($1, 16.3168, -86.523, true, true), ($2, 16.30, -86.59, true, true)`, [car, van]);

const ride = async (guest, riders = 2, kind = 'car', status = 'awaiting_payment') => (await one(`insert into land_rides
  (guest_id, pickup_lat, pickup_lon, pickup_label, dropoff_lat, dropoff_lon, dropoff_label, riders, vehicle_kind, timing, km, fare_usd, status)
  values ($1, 16.3168, -86.523, 'Airport', 16.2845, -86.5967, 'West Bay', $2, $3, 'now', 11.2, 25, $4) returning id`, [guest, riders, kind, status])).id;

// ---- Map: cars without drivers' details ----
const live = (await as(null, 'select * from live_vehicles()')).rows;
ok(live.length === 2 && !('driver_id' in live[0]), 'anyone sees online cars, never who drives them');
await db.query("update vehicle_positions set updated_at = now() - interval '5 minutes' where vehicle_id=$1", [van]);
ok((await as(null, 'select * from live_vehicles()')).rows.length === 1, 'stale cars drop off the map');
await db.query("update vehicle_positions set updated_at = now() where vehicle_id=$1", [van]);
ok((await as(G, 'select * from vehicles')).rows.length === 0, 'guests cannot read vehicles (licence numbers stay private)');
await throws(() => db.query(`insert into land_rides (guest_id, pickup_lat, pickup_lon, pickup_label, dropoff_lat, dropoff_lon, dropoff_label, riders, vehicle_kind, timing, km, fare_usd)
  values ($1, 25.7, -80.1, 'Miami', 16.28, -86.59, 'West Bay', 1, 'car', 'now', 5, 10)`, [G]), /check constraint/, 'pickups off the island are refused');

// ---- Payment marks the ride paid ----
const r1 = await ride(G);
const pay = (await one(`insert into payments (guest_id, land_ride_id, amount_usd, provider) values ($1, $2, 25, 'test') returning id`, [G, r1])).id;
const waterRide = (await one(`insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd) values ($1, 'we', 'inf', 1, 'private', 'now', 1, 20) returning id`, [G])).id;
await throws(() => db.query(`insert into payments (guest_id, land_ride_id, ride_id, amount_usd, provider) values ($1, $2, $3, 25, 'test')`, [G, r1, waterRide]), /payments_one_target|null value|violates/, 'a payment pays exactly one thing');
ok((await one('select mark_payment_succeeded($1, $2) r', [pay, 'ref1'])).r === 'ok', 'payment succeeds');
ok((await one('select status from land_rides where id=$1', [r1])).status === 'paid', 'land ride is paid');

// ---- Drivers ----
ok((await as(D, 'select * from land_rides')).rows.length === 1, 'drivers see paid rides waiting for a driver');
ok((await as(H, 'select * from land_rides')).rows.length === 0, 'other guests see nothing');
await throws(() => as(D, 'select accept_land_ride($1)', [r1]), /license_not_verified/, 'unverified driver cannot accept');
await throws(() => as(D, "select verify_vehicle($1, 'DL-1', '2030-01-01', 'P-9')", [car]), /admins_only/, 'drivers cannot verify themselves');
await as(A, "select verify_vehicle($1, 'DL-1', '2030-01-01', 'P-9')", [car]);
await as(A, "select verify_vehicle($1, 'DL-2', '2030-01-01', 'P-8')", [van]);
const r6 = await ride(H, 6, 'van', 'paid');
await throws(() => as(D, 'select accept_land_ride($1)', [r6]), /vehicle_too_small/, 'a car cannot take a van ride');
await throws(() => as(G, 'select accept_land_ride($1)', [r1]), /not_a_driver/, 'guests cannot accept rides');
const acc = (await as(D, 'select * from accept_land_ride($1)', [r1])).rows[0];
ok(acc.status === 'accepted' && acc.vehicle_id === car, 'verified driver accepts');
ok((await one('select available from vehicle_positions where vehicle_id=$1', [car])).available === false, 'car is busy');
await throws(() => as(V, 'select accept_land_ride($1)', [r1]), /ride_not_available/, 'a taken ride cannot be taken twice');
const r2 = await ride(H, 1, 'car', 'paid');
await throws(() => as(D, 'select accept_land_ride($1)', [r2]), /finish_current_ride/, 'one ride at a time');

// ---- Guest sees the driver and the car ----
const drv = (await as(G, 'select * from land_ride_driver($1)', [r1])).rows[0];
ok(drv.driver_name === 'Kevin' && drv.plate === 'HBX1234' && drv.whatsapp === '+50499990002' && drv.lat > 16, 'guest sees driver, plate, WhatsApp and the car on the map');
ok((await as(H, 'select * from land_ride_driver($1)', [r1])).rows.length === 0, 'another guest cannot');
ok((await as(D, 'select * from land_ride_guest($1)', [r1])).rows[0].guest_name === 'Maria', 'driver sees the guest first name');

// ---- Trip flow ----
await throws(() => as(D, "select advance_land_ride($1, 'completed')", [r1]), /bad_transition/, 'cannot skip pickup');
ok((await as(D, 'select * from land_ride_arrived($1)', [r1])).rows[0].arrived_at !== null, 'driver marks arrived');
await as(D, "select advance_land_ride($1, 'onboard')", [r1]);
await throws(() => as(G, 'select cancel_land_ride($1)', [r1]), /too_late_to_cancel/, 'cannot cancel once on board');
const done = (await as(D, "select * from advance_land_ride($1, 'completed')", [r1])).rows[0];
ok(done.status === 'completed' && done.picked_up_at && done.completed_at, 'ride completed');
ok((await one('select available from vehicle_positions where vehicle_id=$1', [car])).available === true, 'car is free again');
ok((await as(G, 'select * from land_ride_driver($1)', [r1])).rows[0].lat === null, 'after the ride the guest no longer sees where the car is');

// ---- Cancel and refund ----
const r3 = await ride(G);
const p3 = (await one(`insert into payments (guest_id, land_ride_id, amount_usd, provider) values ($1, $2, 25, 'test') returning id`, [G, r3])).id;
await one('select mark_payment_succeeded($1, $2)', [p3, 'ref3']);
await as(G, 'select cancel_land_ride($1)', [r3]);
ok((await one('select refund_requested_at from payments where id=$1', [p3])).refund_requested_at !== null, 'cancel before a driver accepts: refund requested');
await throws(() => as(H, 'select cancel_land_ride($1)', [r2]).then(() => as(G, 'select cancel_land_ride($1)', [r6])), /not_your_ride/, 'cannot cancel someone else\'s ride');
// Paid after cancel → automatic refund
const r4 = await ride(G);
const p4 = (await one(`insert into payments (guest_id, land_ride_id, amount_usd, provider) values ($1, $2, 25, 'test') returning id`, [G, r4])).id;
await as(G, 'select cancel_land_ride($1)', [r4]);
ok((await one('select mark_payment_succeeded($1, $2) r', [p4, 'ref4'])).r === 'refund_requested', 'payment arriving for a cancelled ride is refunded');

// ---- Giving counts land rides like rides ----
const g = (await as(A, 'select * from giving_owed()')).rows[0];
ok(Number(g.earnings_cents) > 0, 'land ride earnings count in the giving totals');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
