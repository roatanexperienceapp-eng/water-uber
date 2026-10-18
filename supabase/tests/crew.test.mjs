// Database tests for the crew roster and licence checks. Usage: node supabase/tests/crew.test.mjs
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

const G = '11111111-1111-1111-1111-111111111111', A = '55555555-5555-5555-5555-555555555555', C = '33333333-3333-3333-3333-333333333333';
for (const id of [G, A, C]) await db.query('insert into auth.users (id) values ($1)', [id]);
await db.query("update profiles set role='admin' where id=$1", [A]);
await db.query("update profiles set role='captain', full_name='Fletcher Legal-Name', whatsapp='+50499990001' where id=$1", [C]);
await db.query("insert into boats (captain_id,name,kind,seats) values ($1,'Taxi','taxi',8)", [C]);

async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];

// ---- Roster ----
const roster = (await as(null, 'select * from crew_public()')).rows;
ok(roster.length === 10, 'seed: 10 captains on the public roster');
ok(roster[0].display_name === 'Captain Fletcher' && roster.some((r) => r.display_name === 'Captain Big John'), 'roster keeps the owner\'s order and names');
ok(roster.every((r) => r.certified === false), 'nobody shows "Certified" until the office verifies a licence');
ok(!('license_no' in roster[0]), 'public roster never includes licence numbers');
ok((await as(null, 'select * from crew')).rows.length === 0, 'anonymous visitors cannot read the crew table');
ok((await as(G, 'select * from crew')).rows.length === 0, 'guests cannot read the crew table');

// ---- A paid ride waiting for a boat ----
const ride = await one("insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd) values ($1,'we','inf',2,'shared','now',1.5,10) returning *", [G]);
const pay = await one("insert into payments (guest_id, ride_id, amount_usd, provider) values ($1,$2,10,'test') returning id", [G, ride.id]);
await db.query("select mark_payment_succeeded($1,'ch_c',1000)", [pay.id]);

await throws(() => as(C, 'select accept_ride($1)', [ride.id]), /license_not_verified/, 'captain with a boat but no crew link cannot carry paying guests');
await db.query("update crew set profile_id=$1 where id='fletcher'", [C]);
await throws(() => as(C, 'select accept_ride($1)', [ride.id]), /license_not_verified/, 'linked but unverified captain is still refused');

// ---- Verifying a licence ----
await throws(() => as(C, "select verify_crew_license('fletcher','HN-123','2099-12-31')"), /admins_only/, 'captains cannot verify themselves');
await throws(() => as(A, "select verify_crew_license('fletcher','HN-123','2020-01-01')"), /license_expired/, 'an expired licence is rejected');
await throws(() => db.query("update crew set verified_at=now() where id='jordan'"), /verified_needs_license/, 'cannot mark verified without a licence number and expiry');
await as(A, "select verify_crew_license('fletcher','HN-123','2099-12-31')");
ok((await as(null, "select certified from crew_public() where id='fletcher'")).rows[0].certified === true, 'verified captain shows "Certified"');
ok((await as(C, 'select license_no from crew')).rows[0]?.license_no === 'HN-123', 'captain can read his own crew row');

const acc = (await as(C, 'select * from accept_ride($1)', [ride.id])).rows[0];
ok(acc.status === 'accepted', 'certified captain accepts the ride');
ok((await as(G, 'select * from ride_contact($1)', [ride.id])).rows[0].captain_name === 'Captain Fletcher', 'guest sees "Captain Fletcher"');

// ---- Expiry ----
await db.query("update crew set license_expires = current_date - 1 where id='fletcher'");
ok((await as(null, "select certified from crew_public() where id='fletcher'")).rows[0].certified === false, 'badge disappears the day after the licence expires');
const ride2 = await one("insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd) values ($1,'we','inf',2,'shared','now',1.5,10) returning *", [G]);
const pay2 = await one("insert into payments (guest_id, ride_id, amount_usd, provider) values ($1,$2,10,'test') returning id", [G, ride2.id]);
await db.query("select mark_payment_succeeded($1,'ch_c2',1000)", [pay2.id]);
await db.query("update boat_positions set available=true");
await throws(() => as(C, 'select accept_ride($1)', [ride2.id]), /license_not_verified/, 'expired licence: no new paying rides');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
