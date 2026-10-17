// Database tests for the account page. Usage: node supabase/tests/account.test.mjs
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



// ---- Profile settings ----
await as(G, "update profiles set emergency_name='Ana', emergency_phone='+1 555 010 2000', notify_offers=true where id=$1", [G]);
const pr = (await as(G, 'select * from profiles where id=$1', [G])).rows[0];
ok(pr.emergency_name === 'Ana' && pr.notify_offers === true, 'guest saves emergency contact and opts in to offers');
ok((await one('select notify_offers, notify_trips from profiles where id=$1', [G2])).notify_offers === false, 'offers are OFF by default (opt-in only)');
await throws(() => as(G, "update profiles set emergency_phone='call me maybe' where id=$1", [G]), /check/, 'emergency phone must look like a phone number');
await as(G2, "update profiles set emergency_name='Hacker' where id=$1", [G]);
ok((await one('select emergency_name from profiles where id=$1', [G])).emergency_name === 'Ana', "nobody can edit someone else's profile");
await throws(() => as(G, "update profiles set role='admin' where id=$1", [G]), /only_admin_can_change_role/, 'guests still cannot make themselves admin');

// ---- Help requests ----
await as(G, "insert into support_requests (guest_id, topic, message) values ($1, 'lost', 'Left my hat on the boat')", [G]);
ok((await as(G, "select * from inbox_messages where title='We got your message'")).rows.length === 1, 'help request → instant "we got your message" in Support');
await as(G, "insert into support_requests (guest_id, topic, message) values ($1, 'safety', 'Captain was speeding near swimmers')", [G]);
ok((await as(G, "select * from inbox_messages where title='We got your safety report' and category='priority'")).rows.length === 1, 'safety report → Priority acknowledgement');
await throws(() => as(G, "insert into support_requests (guest_id, topic, message) values ($1, 'other', 'pretending')", [G2]), /row-level security/, 'cannot write as someone else');
ok((await as(G2, 'select * from support_requests')).rows.length === 0, 'help requests are private');
const strangerRide = await one("insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd, status) values ($1,'we','inf',1,'shared','now',1.5,5,'completed') returning id", [G2]);
await throws(() => as(G, "insert into support_requests (guest_id, topic, message, ride_id) values ($1,'ride','about this ride',$2)", [G, strangerRide.id]), /row-level security/, "cannot attach someone else's ride to a request");

// ---- Partner applications ----
await as(G2, "insert into partner_applications (applicant_id, kind, name, whatsapp, business_name) values ($1,'captain','Marlon','+504 9999-0000','Boat 07')", [G2]);
ok((await as(G2, 'select * from partner_applications')).rows.length === 1 && (await as(G, 'select * from partner_applications')).rows.length === 0, 'captain applies; applications are private');
ok((await as(A, 'select * from partner_applications')).rows.length === 1, 'admin sees applications');
await as(G2, "update partner_applications set status='approved'");
ok((await one("select status from partner_applications limit 1")).status === 'new', 'applicants cannot approve themselves (status stays new until an admin decides)');

// ---- Account deletion ----
const LIST = (await one("select id from listings where booking <> 'info' limit 1")).id;
const up = await one("insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status) values ($1,$2,current_date+3,'10:00',2,100,'paid') returning id", [G, LIST]);
await throws(() => as(G, 'select erase_guest($1)', [G]), /permission denied/, 'guests cannot call the erase function directly');
ok((await one('select erase_guest($1) r', [G])).r === 'has_upcoming', 'deletion waits while there is an upcoming paid trip');
await db.query("update bookings set status='completed', trip_date=current_date-1 where id=$1", [up.id]);
await db.query("insert into saved_places (guest_id, label, dock_id, icon) values ($1,'Home','we','home')", [G]);
ok((await one('select erase_guest($1) r', [G])).r === 'ok', 'guest with no upcoming trips can delete');
const gone = await one('select full_name, emergency_name, emergency_phone, deleted_at from profiles where id=$1', [G]);
ok(gone.emergency_name === null && gone.emergency_phone === null && gone.deleted_at !== null, 'personal data erased');
ok(Number((await one('select count(*) n from saved_places where guest_id=$1', [G])).n) === 0, 'saved places erased');
ok(Number((await one('select count(*) n from bookings where guest_id=$1', [G])).n) === 1, 'anonymous trip records kept (legal requirement)');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
