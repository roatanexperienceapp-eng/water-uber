// Database tests for payments (real-money safety) and cruise features. Usage: node supabase/tests/cruise.test.mjs
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
await db.query('insert into boat_positions (boat_id, lon, lat, online) values ($1,-86.6,16.3,true), ($2,-86.6,16.29,true)', [b1, b2]);

async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const newRide = (extra = '', vals = []) => one(
  `insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, scheduled_for, pickup_at, miles, fare_usd, status${extra ? ',' + extra : ''})
   values ($1,'we','inf',2,'private','scheduled', now() + interval '1 hour', now() + interval '1 hour', 1.5, 25, 'paid'${vals.length ? ',' + vals.map((_, i) => '$' + (i + 2)).join(',') : ''}) returning *`, [G, ...vals]);


const LIST = (await one("select id from listings where booking <> 'info' limit 1")).id;
await db.query("update listings set booking='instant', price_usd=100, unit='person' where id=$1", [LIST]);
const newBooking = (qty = 1, total = 100, status = 'awaiting_payment') => one(
  `insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status) values ($1,$2,current_date+1,'10:00',$3,$4,$5) returning *`, [G, LIST, qty, total, status]);
const newPay = (col, id, amt, guest = G) => one(`insert into payments (guest_id, ${col}, amount_usd, provider) values ($1,$2,$3,'stripe') returning *`, [guest, id, amt]);

// ---- Payments: only the signed webhook (service role) can mark paid ----
let bk = await newBooking();
let p = await newPay('booking_id', bk.id, 100);
ok(p.amount_cents === 10000, 'amount stored in exact cents');
await throws(() => as(G, "select mark_payment_succeeded($1,'pi_x',10000)", [p.id]), /permission denied/, 'a guest cannot mark their own payment paid');
await throws(() => as(G, 'update payments set status=$2 where id=$1', [p.id, 'succeeded']).then((r) => { if (r.affectedRows === 0) throw new Error('no rows: denied by RLS'); }), /denied|permission/, 'a guest cannot update payments directly');
ok((await one("select mark_payment_succeeded($1,'pi_1',10000) r", [p.id])).r === 'ok', 'webhook marks payment succeeded');
ok((await one('select status from bookings where id=$1', [bk.id])).status === 'paid', 'booking becomes paid');
ok((await one("select mark_payment_succeeded($1,'pi_1',10000) r", [p.id])).r === 'already_processed', 'webhook retry is harmless (idempotent)');

bk = await newBooking();
p = await newPay('booking_id', bk.id, 100);
ok((await one("select mark_payment_succeeded($1,'pi_2',9900) r", [p.id])).r === 'needs_review', 'charged amount different from asked → flagged for review');
ok((await one('select status from bookings where id=$1', [bk.id])).status === 'awaiting_payment', '…and the booking is NOT confirmed');

bk = await newBooking();
p = await newPay('booking_id', bk.id, 100);
await db.query("update bookings set status='cancelled' where id=$1", [bk.id]);
ok((await one("select mark_payment_succeeded($1,'pi_3',10000) r", [p.id])).r === 'refund_requested', 'paid for a cancelled booking → refund queued automatically');
ok((await one('select refund_requested_at from payments where id=$1', [p.id])).refund_requested_at !== null, 'refund is in the queue');
await db.query("select mark_payment_refunded($1,'re_1')", [p.id]);
const rf = await one('select status, refunded_at from payments where id=$1', [p.id]);
ok(rf.status === 'refunded' && rf.refunded_at !== null, 'refund worker marks it refunded');

bk = await newBooking();
p = await newPay('booking_id', bk.id, 100);
await db.query('select mark_payment_failed($1)', [p.id]);
ok((await one('select status from payments where id=$1', [p.id])).status === 'failed', 'expired checkout marks payment failed');
ok((await one("select mark_payment_succeeded($1,'pi_4',10000) r", [p.id])).r === 'ok', 'a late success after expiry still confirms (money arrived)');

// ---- One checkout for an activity + its taxi rides ----
bk = await newBooking();
const leg1 = await one(`insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, scheduled_for, pickup_at, miles, fare_usd, status, booking_id) values ($1,'inf','we',2,'private','scheduled',now()+interval '3 hours',now()+interval '3 hours',1.5,25,'awaiting_payment',$2) returning *`, [G, bk.id]);
const leg2 = await one(`insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, scheduled_for, pickup_at, miles, fare_usd, status, booking_id) values ($1,'we','inf',2,'private','scheduled',now()+interval '6 hours',now()+interval '6 hours',1.5,25,'awaiting_payment',$2) returning *`, [G, bk.id]);
p = await one(`insert into payments (guest_id, booking_id, amount_usd, provider, covers_ride_ids) values ($1,$2,150,'stripe',$3) returning *`, [G, bk.id, [leg1.id, leg2.id]]);
await db.query("select mark_payment_succeeded($1,'pi_combo',15000)", [p.id]);
ok((await one('select count(*) n from rides where booking_id=$1 and status=$2', [bk.id, 'paid'])).n == 2, 'one payment confirms the tour AND both taxi legs');

// ---- Ride cancellation refunds ----
const ride = await one(`insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd, status) values ($1,'we','inf',2,'shared','now',1.5,10,'awaiting_payment') returning *`, [G]);
const rp = await newPay('ride_id', ride.id, 10);
await db.query("select mark_payment_succeeded($1,'pi_r',1000)", [rp.id]);
await as(G, 'select cancel_ride($1)', [ride.id]);
ok((await one('select refund_requested_at from payments where id=$1', [rp.id])).refund_requested_at !== null, 'cancelling a paid ride before a captain accepts queues a refund');

// ---- Commission ledger is admin-only ----
await db.query("insert into auth.users (id) values ('55555555-5555-5555-5555-555555555555')");
await db.query("update profiles set role='admin' where id='55555555-5555-5555-5555-555555555555'");
ok((await as(G, 'select * from money_ledger')).rows.length === 0, 'guests never see the money ledger');
ok((await as('55555555-5555-5555-5555-555555555555', 'select * from money_ledger')).rows.length >= 3, 'admin sees the ledger');

// ---- Split payments ----
bk = await newBooking(4, 100.01);
const split = await one("select * from create_split($1,$2,4, now() + interval '2 hours')", [bk.id, G]);
await throws(() => as(G, "select create_split($1,$2,4, now() + interval '2 hours')", [bk.id, G]), /permission denied/, 'guests cannot create splits directly (server only)');
const sh1 = await one("select * from reserve_split_share($1,$2,1,'stripe')", [split.token, G]);
ok(sh1.amount_cents === 2501 && sh1.share_from === 0, 'organizer share: $25.01 (first share carries the extra cent)');
const again = await one("select * from reserve_split_share($1,$2,1,'stripe')", [split.token, G]);
ok(again.id === sh1.id, 'tapping Pay twice reuses the same held share');
const sh2 = await one("select * from reserve_split_share($1,$2,1,'stripe')", [split.token, G2]);
ok(sh2.amount_cents === 2500 && sh2.share_from === 1, 'friend share: $25.00');
await db.query("select mark_payment_succeeded($1,'pi_s1',2501)", [sh1.id]);
await db.query("select mark_payment_succeeded($1,'pi_s2',2500)", [sh2.id]);
let st = (await as(null, 'select * from split_status($1)', [split.token])).rows[0];
ok(st.paid_shares === 2 && st.shares === 4 && st.status === 'open', 'anyone with the link sees 2 of 4 paid (no names or emails)');
ok(!('organizer_id' in st) && !('guest_id' in st), 'split status hides who paid');
ok((await one('select status from bookings where id=$1', [bk.id])).status === 'awaiting_payment', 'booking is held, not confirmed, until every share is paid');
const rest = await one("select * from reserve_split_share($1,$2,null,'stripe')", [split.token, G]);
ok(rest.share_count === 2 && rest.amount_cents === 5000, 'organizer pays the rest: 2 shares, $50.00');
await throws(() => db.query("select * from reserve_split_share($1,$2,1,'stripe')", [split.token, G2]), /no_shares_left/, 'nobody can pay more shares than exist');
await db.query("select mark_payment_succeeded($1,'pi_s3',5000)", [rest.id]);
ok((await one('select status from bookings where id=$1', [bk.id])).status === 'paid', 'all shares paid → booking confirmed');
ok(Number((await one('select sum(paid_amount_cents) s from payments where split_id=$1 and status=$2', [split.id, 'succeeded'])).s) === 10001, 'shares add up to the exact total');

bk = await newBooking(3, 90);
const sp2 = await one("select * from create_split($1,$2,3, now() + interval '2 hours')", [bk.id, G]);
const a1 = await one("select * from reserve_split_share($1,$2,1,'stripe')", [sp2.token, G]);
await db.query("select mark_payment_succeeded($1,'pi_e1',3000)", [a1.id]);
await db.query("update booking_splits set deadline_at = now() - interval '1 minute' where id=$1", [sp2.id]);
ok((await one('select run_split_watchdog() n')).n === 1, 'split past its deadline expires');
ok((await one('select status from bookings where id=$1', [bk.id])).status === 'cancelled', '…booking cancelled');
ok((await one('select refund_requested_at from payments where id=$1', [a1.id])).refund_requested_at !== null, '…and whoever paid is refunded');
await throws(() => db.query("select * from reserve_split_share($1,$2,1,'stripe')", [sp2.token, G2]), /split_closed/, 'expired split takes no more payments');

// ---- Ship calls, tickets, check-in ----
const call = await one("insert into ship_calls (call_date, ship_name, port, arrive_at, all_aboard_at, passengers) values (current_date, 'Test Ship', 'coxen', now(), now() + interval '8 hours', 4000) returning *");
ok((await as(null, 'select * from ship_calls')).rows.length === 1, 'anyone can read the ship schedule');
await throws(() => as(G, "insert into ship_calls (call_date, ship_name, port, arrive_at, all_aboard_at) values (current_date,'X','coxen',now(),now()+interval '1 hour')"), /row-level security|permission/, 'guests cannot edit the ship schedule');
bk = await newBooking();
ok(/^[0-9A-F]{8}$/.test(bk.ticket_code), 'every booking gets an 8-character ticket code');
await throws(() => as(G2, 'select * from check_in($1)', [bk.ticket_code]), /not_your_ticket/, 'a random user cannot check in tickets');
await db.query('update bookings set status=$2 where id=$1', [bk.id, 'paid']);
const op = await one("insert into operators (name, owner_id) values ('Op', $1) returning id", [G2]);
await db.query('update listings set operator_id=$2 where id=$1', [LIST, op.id]);
const ci = (await as(G2, 'select * from check_in($1)', [bk.ticket_code.toLowerCase()])).rows[0];
ok(ci && ci.already_checked_in === false, 'operator scans the QR and checks the group in');
ok((await as(G2, 'select * from check_in($1)', [bk.ticket_code])).rows[0].already_checked_in === true, 'second scan shows "already checked in"');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
