// Database tests for giving (donations + pledge). Usage: node supabase/tests/giving.test.mjs
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

const G = '11111111-1111-1111-1111-111111111111', G2 = '22222222-2222-2222-2222-222222222222', A = '55555555-5555-5555-5555-555555555555';
const C = '33333333-3333-3333-3333-333333333333';
for (const id of [G, G2, A, C]) await db.query('insert into auth.users (id) values ($1)', [id]);
await db.query("update profiles set role='admin' where id=$1", [A]);
await db.query("update profiles set role='captain' where id=$1", [C]);
await db.query("insert into boats (captain_id,name,kind,seats) values ($1,'B','taxi',8)", [C]);

async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];


const pay = (col, id, amt, guest = G) => one(`insert into payments (guest_id, ${col}, amount_usd, provider) values ($1,$2,$3,'stripe') returning *`, [guest, id, amt]);

// ---- Donations ----
await throws(() => as(null, 'select create_donation(10)'), /sign_in_required|permission/, 'signed-out visitors cannot start a donation without a session');
await throws(() => as(G, 'select create_donation(0.5)'), /bad_amount/, 'minimum donation is $1');
await throws(() => as(G, 'select create_donation(10000)'), /bad_amount/, 'maximum donation is $5,000 (fraud guard)');
await throws(() => as(G, 'select create_donation(10.555)'), /bad_amount/, 'no fractions of a cent');
const d = (await as(G, "select * from create_donation(25, 'For the kids')")).rows[0];
ok(d.status === 'awaiting_payment' && Number(d.amount_usd) === 25, 'guest starts a $25 donation');
ok((await as(G2, 'select * from donations')).rows.length === 0, "donations are private to the donor");
const dp = await pay('donation_id', d.id, 25);
ok((await one("select mark_payment_succeeded($1,'pi_d1',2500) r", [dp.id])).r === 'ok', 'paid donation is accepted (not mistaken for a booking and refunded)');
ok((await one('select status from donations where id=$1', [d.id])).status === 'paid', 'donation marked paid');
const anyBk = await one("insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status) values ($1,(select id from listings where booking <> 'info' limit 1),current_date+1,'10:00',1,50,'awaiting_payment') returning id", [G]);
await throws(() => db.query("insert into payments (guest_id, donation_id, booking_id, amount_usd, provider) values ($1,$2,$3,1,'stripe')", [G, d.id, anyBk.id]), /payments_one_target/, 'a payment pays for exactly one thing (no donation + booking mix)');

// ---- Pledge: 10% of the app's earnings, not gross sales ----
const LIST = (await one("select id, operator_id from listings where ours and booking <> 'info' limit 1"));
const PART = (await one("select id from listings where not ours and booking <> 'info' limit 1")).id;
const op = await one("insert into operators (name, commission_pct) values ('Partner', 15) returning id");
await db.query('update listings set operator_id=$2 where id=$1', [PART, op.id]);
const bkOwn = await one("insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status) values ($1,$2,current_date+1,'10:00',1,100,'awaiting_payment') returning *", [G, LIST.id]);
const bkPart = await one("insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status) values ($1,$2,current_date+1,'10:00',1,200,'awaiting_payment') returning *", [G, PART]);
const ride = await one("insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd, status) values ($1,'we','inf',2,'shared','now',1.5,10,'awaiting_payment') returning *", [G]);
for (const [col, id, amt, ref] of [['booking_id', bkOwn.id, 100, 'pi_o'], ['booking_id', bkPart.id, 200, 'pi_p'], ['ride_id', ride.id, 10, 'pi_r']]) {
  const p = await pay(col, id, amt);
  await db.query('select mark_payment_succeeded($1,$2,$3)', [p.id, ref, amt * 100]);
}
const owed = (await as(A, 'select * from giving_owed()')).rows[0];
// earnings: own tour $100 (100%) + partner $200 × 15% = $30 + ride $10 × 20% = $2  → $132; pledge 10% = $13.20
ok(Number(owed.earnings_cents) === 13200, 'earnings = own tours in full + partner commission + rides share ($132)');
ok(Number(owed.pledge_cents) === 1320, 'pledge = 10% of earnings ($13.20), not 10% of $310 sales');
ok(Number(owed.donations_cents) === 2500 && Number(owed.owed_cents) === 3820, 'owed to the charity = $25 donations + $13.20 pledge');
await throws(() => as(G, 'select * from giving_owed()'), /admins_only/, 'only admins see earnings and what is owed');

// ---- Transfers and the public counter ----
await throws(() => as(G, "insert into charity_transfers (amount_usd) values (100)"), /row-level security/, 'guests cannot record transfers');
await as(A, "insert into charity_transfers (amount_usd, note) values (30, 'October transfer')");
const pub = (await as(null, 'select * from giving_public()')).rows[0];
ok(pub.charity_name === 'Every Child Roatán' && Number(pub.pledge_pct) === 10, 'public page shows the charity and the 10% pledge');
ok(Number(pub.raised_cents) === 2500 && pub.donors === 1 && Number(pub.given_cents) === 3000, 'public sees raised by guests and money actually given (no revenue)');
ok(!('earnings_cents' in pub), 'public never sees earnings');
ok(Number((await as(A, 'select owed_cents from giving_owed()')).rows[0].owed_cents) === 820, 'owed goes down after a transfer ($8.20 left)');

// ---- Refunded donation ----
await db.query("select mark_payment_refunded($1,'re_d1')", [dp.id]);
ok((await one('select status from donations where id=$1', [d.id])).status === 'refunded', 'refunded donation is marked refunded');
ok(Number((await as(null, 'select raised_cents from giving_public()')).rows[0].raised_cents) === 0, 'refunded donations leave the public total');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
