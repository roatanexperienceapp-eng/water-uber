// Database tests for group passes and packages. Usage: node supabase/tests/bundles.test.mjs
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



const passRow = (type, riders, price) => one(`insert into guest_passes (guest_id, pass_type, riders, price_usd, starts_at, expires_at, status) values ($1,$2,$3,$4,now(),now()+interval '7 days','awaiting_payment') returning *`, [G, type, riders, price]);

// ---- Any group size 2–12 ----
ok(!!(await passRow('week3', 3, 105)), 'family of 3 can have a pass (week3)');
ok(!!(await passRow('twoWeek11', 11, 770)), 'group of 11, two weeks (twoWeek11)');
await throws(() => passRow('week13', 13, 455), /check/, 'no pass bigger than 12 people');
await throws(() => passRow('week1', 1, 35), /check/, 'no 1-person pass (owner prices start at 2)');

// ---- Package: pass + own snorkel tour, one payment ----
const gp = await passRow('week3', 3, 105);
const bu = await one(`insert into bundles (guest_id, pass_id, group_size, subtotal_cents, discount_pct, discount_cents, total_cents, pass_share_cents, tours_share_cents)
  values ($1,$2,3,36000,10,3600,32400,9450,22950) returning *`, [G, gp.id]);
await throws(() => db.query(`insert into bundles (guest_id, pass_id, group_size, subtotal_cents, discount_pct, discount_cents, total_cents, pass_share_cents, tours_share_cents)
  values ($1,(select id from guest_passes where pass_type='twoWeek11'),11,1000,10,100,950,500,450)`, [G]), /check/, 'package totals must add up (subtotal − discount = total)');
const snork = await one(`insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status, bundle_id)
  values ($1,'snork-shipwreck-snorkel-tour',current_date+2,'09:00',3,255,'awaiting_payment',$2) returning *`, [G, bu.id]);
ok((await as(G, 'select * from bundles')).rows.length === 1 && (await as(G2, 'select * from bundles')).rows.length === 0, 'packages are private');
const p = await one("insert into payments (guest_id, bundle_id, amount_usd, provider) values ($1,$2,324,'stripe') returning *", [G, bu.id]);
await throws(() => db.query("insert into payments (guest_id, bundle_id, pass_id, amount_usd, provider) values ($1,$2,$3,1,'stripe')", [G, bu.id, gp.id]), /payments_one_target/, 'a payment is for the package OR the pass, not both');
ok((await one("select mark_payment_succeeded($1,'pi_bu',32400) r", [p.id])).r === 'ok', 'one payment for the whole package');
ok((await one('select status from guest_passes where id=$1', [gp.id])).status === 'active', '…activates the water taxi pass');
ok((await one('select status from bookings where id=$1', [snork.id])).status === 'paid', '…and confirms the snorkel tour (ticket is ready)');
ok((await as(G, "select * from inbox_messages where title='Your ticket is ready'")).rows.length === 1, 'guest gets "Your ticket is ready" for the tour');
ok((await one("select mark_payment_succeeded($1,'pi_bu',32400) r", [p.id])).r === 'already_processed', 'webhook retry is harmless');

// ---- Giving: package earnings = pass share × ride share + tours share (own tours) ----
const owed = (await as(A, 'select * from giving_owed()')).rows[0];
// pass share $94.50 × 20% = $18.90; tours share $229.50 → earnings $248.40; pledge 10% = $24.84
ok(Number(owed.earnings_cents) === 24840 && Number(owed.pledge_cents) === 2484, 'package counted correctly toward the 10% pledge');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
