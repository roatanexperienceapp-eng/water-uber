// Database tests for Zelle payments. Usage: node supabase/tests/zelle.test.mjs
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



const pass = await one(`insert into guest_passes (guest_id, pass_type, riders, price_usd, starts_at, expires_at, status) values ($1,'week',2,70,now(),now()+interval '7 days','awaiting_payment') returning *`, [G]);
const pay = await one("insert into payments (guest_id, pass_id, amount_usd, provider) values ($1,$2,70,'zelle') returning *", [G, pass.id]);
const code = (await one('select zelle_code($1) c', [pay.id])).c;
ok(/^RWT-[0-9A-F]{8}$/.test(code), `memo code looks like ${code}`);

// Guests can't see the list or confirm their own payment.
await throws(() => as(G, 'select * from zelle_pending()'), /not_allowed/, 'a guest cannot list Zelle payments');
await throws(() => as(G, "select confirm_zelle($1, 70, 'X1')", [code]), /not_allowed/, 'a guest cannot confirm their own Zelle payment');
await throws(() => as(null, "select confirm_zelle($1, 70, 'X1')", [code]), /permission denied|not_allowed/, 'signed-out callers cannot confirm');

// The admin sees it waiting.
const list = (await as(A, 'select * from zelle_pending()')).rows;
ok(list.length === 1 && list[0].code === code && Number(list[0].amount_usd) === 70 && list[0].what === 'pass', 'admin sees the pending Zelle payment with its code and amount');

// Checks before confirming.
await throws(() => as(A, "select confirm_zelle($1, 60, 'X1')", [code]), /amount_short/, 'a short transfer is refused');
await throws(() => as(A, "select confirm_zelle($1, 70, '  ')", [code]), /bank_ref_required/, 'the bank confirmation number is required');
await throws(() => as(A, "select confirm_zelle('RWT-00000000', 70, 'X1')"), /no_pending_zelle_payment/, 'an unknown code is refused');
ok((await one('select status from guest_passes where id=$1', [pass.id])).status === 'awaiting_payment', 'nothing changed after refused attempts');

// Confirm (lower-case code typed by hand still matches).
ok((await as(A, "select confirm_zelle($1, 70, 'BOA-123') r", [code.toLowerCase()])).rows[0].r === 'ok', 'admin confirms → ok');
ok((await one('select status from guest_passes where id=$1', [pass.id])).status === 'active', 'the pass is active');
const after = await one('select status, provider_ref from payments where id=$1', [pay.id]);
ok(after.status === 'succeeded' && after.provider_ref === 'zelle:BOA-123', 'payment succeeded with the bank reference');
await throws(() => as(A, "select confirm_zelle($1, 70, 'BOA-123')", [code]), /no_pending_zelle_payment/, 'confirming twice is refused');
ok((await as(A, 'select * from zelle_pending()')).rows.length === 0, 'the waiting list is empty');

// The SQL editor (no signed-in user) can confirm too.
const pass2 = await one(`insert into guest_passes (guest_id, pass_type, riders, price_usd, starts_at, expires_at, status) values ($1,'week',2,70,now(),now()+interval '7 days','awaiting_payment') returning *`, [G2]);
const pay2 = await one("insert into payments (guest_id, pass_id, amount_usd, provider) values ($1,$2,70,'zelle') returning *", [G2, pass2.id]);
ok((await one("select confirm_zelle(zelle_code($1), 75, 'CH-9') r", [pay2.id])).r === 'ok', 'SQL editor confirms; overpaying is accepted');

// A card payment can't be confirmed through the Zelle function.
const pass3 = await one(`insert into guest_passes (guest_id, pass_type, riders, price_usd, starts_at, expires_at, status) values ($1,'week',2,70,now(),now()+interval '7 days','awaiting_payment') returning *`, [G2]);
const card = await one("insert into payments (guest_id, pass_id, amount_usd, provider) values ($1,$2,70,'stripe') returning *", [G2, pass3.id]);
await throws(() => db.query("select confirm_zelle(zelle_code($1), 70, 'X')", [card.id]), /no_pending_zelle_payment/, 'card payments cannot be confirmed as Zelle');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
