// Database tests for the inbox. Usage: node supabase/tests/inbox.test.mjs
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

// ---- Sending ----
const offer = (await as(A, "insert into inbox_messages (category,title,body,cta_label,cta_path) values ('offer','Sunset snorkel','10% off before 10 am','Book','/portal/snork') returning *")).rows[0];
ok(offer && offer.source === 'team', 'admin sends an offer to everyone');
await throws(() => as(G, "insert into inbox_messages (category,title,body) values ('offer','Spam','Buy now')"), /row-level security|permission/, 'guests cannot send messages');
await throws(() => as(A, "insert into inbox_messages (category,title,body) values ('priority','Big sale','20% off all tours today')"), /offers_are_not_priority/, 'a promotion cannot be posted as Priority');
await throws(() => as(A, "insert into inbox_messages (category,title,body,source) values ('update','x','y','system')"), /row-level security/, 'staff cannot fake system messages');
await throws(() => as(A, "insert into inbox_messages (category,title,body,cta_path) values ('offer','x','y','https://evil.example')"), /check/, 'buttons can only open in-app pages (no outside links)');
const personal = (await as(A, "insert into inbox_messages (category,title,body,guest_id) values ('support','Your question','We have your towels.',$1) returning id", [G])).rows[0];
await as(A, "insert into inbox_messages (category,title,body,starts_at,expires_at) values ('update','Old news','gone', now() - interval '2 hours', now() - interval '1 hour')");
await throws(() => as(A, "insert into inbox_messages (category,title,body,expires_at) values ('update','x','y', now() - interval '1 hour')"), /check/, 'expiry before start is refused');

// ---- Reading ----
const gSees = (await as(G, 'select id, title from inbox_messages')).rows.map((r) => r.title);
ok(gSees.includes('Sunset snorkel') && gSees.includes('Your question'), 'guest sees broadcasts and their own messages');
ok(!gSees.includes('Old news'), 'expired messages disappear');
ok(!(await as(G2, 'select title from inbox_messages')).rows.some((r) => r.title === 'Your question'), "nobody sees someone else's personal message");
ok((await as(null, 'select * from inbox_messages')).rows.length === 0, 'signed-out visitors see nothing');

// ---- Read state ----
ok((await as(G, 'select mark_inbox_read($1) n', [[offer.id, personal.id]])).rows[0].n === 2, 'guest marks two messages read');
ok((await as(G, 'select mark_inbox_read($1) n', [[offer.id]])).rows[0].n === 0, 'marking again is harmless');
ok((await as(G2, 'select mark_inbox_read($1) n', [[personal.id]])).rows[0].n === 0, "cannot mark someone else's message");
ok((await as(G2, 'select * from inbox_reads')).rows.length === 0, 'read receipts are private');

// ---- System messages ----
await as(C, "select report_sea('north','rough')");
await as(C, "select report_sea('north','rough')");
const rough = (await as(G, "select * from inbox_messages where category='priority'")).rows;
ok(rough.length === 1 && rough[0].source === 'system' && /North side/.test(rough[0].body), 'rough sea report → one Priority alert for everyone (no duplicates)');

await db.query("insert into ride_credits (guest_id, amount_usd, reason) values ($1, 10, 'missed_pickup')", [G]);
ok((await as(G, "select * from inbox_messages where title='Ride credit added'")).rows.length === 1, 'missed-pickup credit → personal update');

const LIST = (await one("select id from listings where booking <> 'info' limit 1")).id;
const bk = await one("insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status) values ($1,$2,current_date+1,'10:00',2,100,'awaiting_payment') returning *", [G, LIST]);
await db.query("update bookings set status='paid' where id=$1", [bk.id]);
const tk = (await as(G, "select * from inbox_messages where title='Your ticket is ready'")).rows[0];
ok(tk && tk.cta_path === `/ticket/${bk.id}`, 'paid booking → "Your ticket is ready" with a button to the ticket');

const bk2 = await one("insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status) values ($1,$2,current_date+1,'10:00',2,100,'awaiting_payment') returning *", [G, LIST]);
await db.query("select * from create_split($1,$2,2, now() + interval '2 hours')", [bk2.id, G]);
await db.query("update booking_splits set deadline_at = now() - interval '1 minute' where booking_id=$1", [bk2.id]);
await db.query('select run_split_watchdog()');
ok((await as(G, "select * from inbox_messages where title='Group booking cancelled' and category='priority'")).rows.length === 1, 'expired group booking → Priority message to the organizer');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
