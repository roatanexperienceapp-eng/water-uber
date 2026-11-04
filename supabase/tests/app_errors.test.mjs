// Database tests for crash and error reports. Usage: node supabase/tests/app_errors.test.mjs
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

const OWNER = '00000000-0000-0000-0000-000000000011', MGR = '00000000-0000-0000-0000-000000000012', GUEST = '00000000-0000-0000-0000-000000000015';
for (const u of [OWNER, MGR, GUEST]) await db.query('insert into auth.users (id) values ($1)', [u]);
await db.query("insert into staff (user_id, role, display_name) values ($1, 'owner', 'Dean'), ($2, 'manager', 'Maria')", [OWNER, MGR]);
async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const log = (uid, msg, route = '/checkout', dev = 'device-aaa', kind = 'crash') =>
  as(uid, 'select log_app_error($1,$2,$3,$4,$5,$6,$7,$8)', ['guest', 'ios', '1.0.0', route, kind, msg, 'at Checkout (bundle:1:2)', dev]);

await log(null, "Cannot read property 'fare' of undefined");
await log(GUEST, "Cannot read property 'fare' of undefined", '/checkout', 'device-bbb');
await log(GUEST, 'Network request failed for ride 12345', '/land/abc12345', 'device-bbb', 'handled');
await log(GUEST, 'Network request failed for ride 67890', '/land/def67890', 'device-bbb', 'handled');
ok(Number((await db.query('select count(*) n from app_errors')).rows[0].n) === 4, 'signed-out and signed-in devices can report');
ok((await db.query('select user_id from app_errors where device_id = $1 limit 1', ['device-bbb'])).rows[0].user_id === GUEST, 'report records the signed-in account');
ok((await as(GUEST, 'select * from app_errors')).rows.length === 0, 'guests cannot read reports');
await as(null, "select log_app_error('guest','ios',null,null,'crash','x','', 'abc')");
ok(Number((await db.query('select count(*) n from app_errors')).rows[0].n) === 4, 'too-short device id is ignored');
for (let i = 0; i < 40; i++) await log(null, `spam ${i}`, '/', 'device-spam');
ok(Number((await db.query("select count(*) n from app_errors where device_id='device-spam'")).rows[0].n) === 30, 'a device can send at most 30 reports an hour');
await log(null, 'x'.repeat(2000), '/', 'device-long');
ok((await db.query("select length(message) n from app_errors where device_id='device-long'")).rows[0].n === 500, 'long messages are trimmed');

const rep = Object.values((await as(OWNER, 'select office_app_errors(7)')).rows[0])[0];
const fare = rep.problems.find((p) => p.message.includes('fare'));
ok(fare.times === 2 && fare.devices === 2, 'same crash from two phones groups into one problem');
const net = rep.problems.filter((p) => p.message.startsWith('Network request failed'));
ok(net.length === 1 && net[0].times === 2, 'ride numbers are blurred so the network errors group together');
ok(rep.crashes >= 2 && rep.by_day.length >= 1, 'owner sees crash count and daily totals');
ok(Object.values((await as(MGR, 'select office_app_errors(7)')).rows[0])[0].total === rep.total, 'manager sees app health too');
await throws(() => as(GUEST, 'select office_app_errors(7)'), /office_forbidden/, 'guests cannot open app health');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
