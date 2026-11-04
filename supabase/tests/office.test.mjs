// Database tests for the office: roles, what each role sees, payouts. Usage: node supabase/tests/office.test.mjs
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

const id = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const OWNER = id(11), MGR = id(12), TEAM = id(13), STRANGER = id(14), GUEST = id(15), CAPT = id(16), DRV = id(17);
for (const [u, e] of [[OWNER, 'owner@x.com'], [MGR, 'mgr@x.com'], [TEAM, 'team@x.com'], [STRANGER, 's@x.com'], [GUEST, 'guest@x.com'], [CAPT, 'capt@x.com'], [DRV, 'drv@x.com']])
  await db.query('insert into auth.users (id, email) values ($1, $2)', [u, e]);
await db.query("update profiles set full_name='Ana Guest', whatsapp='+15550100' where id=$1", [GUEST]);
await db.query("update profiles set full_name='Cap Ray', whatsapp='+50499990001' where id=$1", [CAPT]);
await db.query("insert into staff (user_id, role, display_name) values ($1, 'owner', 'Dean')", [OWNER]);

async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const val = async (uid, sql, p = []) => Object.values((await as(uid, sql, p)).rows[0])[0];
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];

// ---- Roles ----
ok((await val(OWNER, 'select office_me()')).role === 'owner', 'owner is recognised');
ok(await val(OWNER, 'select is_admin()'), 'owner counts as admin for existing screens');
ok((await val(STRANGER, 'select office_me()')).role === null, 'a stranger has no role');
await throws(() => as(STRANGER, "select office_board(current_date, current_date)"), /office_forbidden/, 'a stranger cannot open the board');
await throws(() => as(GUEST, "select office_money(current_date, current_date)"), /office_forbidden/, 'a guest cannot see money');

// Sign up and approval.
await as(MGR, "select office_request_access('Maria Manager')");
await as(TEAM, "select office_request_access('Tom Team')");
ok((await val(MGR, 'select office_me()')).requested === true, 'a new sign-up waits for approval');
const staff0 = await val(OWNER, 'select office_staff()');
ok(staff0.requests.length === 2 && staff0.requests.some((r) => r.email === 'mgr@x.com'), 'owner sees pending sign-ups with emails');
await throws(() => as(MGR, `select office_set_staff('${TEAM}', 'manager')`), /office_forbidden/, 'a waiting person cannot approve anyone');
await as(OWNER, `select office_set_staff('${MGR}', 'manager')`);
await as(OWNER, `select office_set_staff('${TEAM}', 'team')`);
await throws(() => as(OWNER, `select office_set_staff('${MGR}', 'owner')`), /bad_role/, 'there is only one owner');
await throws(() => as(OWNER, `select office_set_staff('${OWNER}', null)`), /cannot_change_own_role/, 'owner cannot lock themself out');
ok((await val(MGR, 'select office_me()')).role === 'manager', 'manager approved');
ok((await val(TEAM, 'select office_me()')).role === 'team', 'team member approved');
await throws(() => as(MGR, `select office_set_staff('${TEAM}', 'manager')`), /office_forbidden/, 'a manager cannot change roles');
ok(!(await val(MGR, 'select is_admin()')), 'a manager is not an admin');

// ---- Data: a completed water taxi ride, a completed land ride, a paid tour ----
await db.query("insert into crew (id, display_name, roles, profile_id) values ('ray', 'Captain Ray', '{taxi}', $1)", [CAPT]);
const ride = (await one(`insert into rides (guest_id, from_dock, to_dock, riders, mode, timing, miles, fare_usd, status, captain_id, paid_at, accepted_at, completed_at)
  values ($1, 'we', 'inf', 2, 'shared', 'now', 1.4, 12, 'completed', $2, now(), now(), now()) returning id`, [GUEST, CAPT])).id;
const veh = (await one(`insert into vehicles (name, kind, seats, plate, driver_id, driver_name) values ('Corolla', 'car', 4, 'HBX1', $1, 'Kevin') returning id`, [DRV])).id;
await db.query(`insert into land_rides (guest_id, pickup_lat, pickup_lon, pickup_label, dropoff_lat, dropoff_lon, dropoff_label, riders, vehicle_kind, timing, km, fare_usd, status, vehicle_id, driver_id, paid_at, accepted_at, completed_at)
  values ($1, 16.3168, -86.523, 'Airport', 16.2845, -86.5967, 'West Bay', 2, 'car', 'now', 11.2, 25, 'completed', $2, $3, now(), now(), now())`, [GUEST, veh, DRV]);
const tour = (await one(`insert into bookings (guest_id, listing_id, trip_date, trip_time, quantity, total_usd, status, paid_at)
  values ($1, 'horse-west-bay-tours', (now() at time zone 'America/Tegucigalpa')::date, '09:00', 2, 100, 'paid', now()) returning id`, [GUEST])).id;
await db.query(`insert into payments (guest_id, ride_id, amount_usd, provider, status) values ($1, $2, 12, 'card', 'succeeded')`, [GUEST, ride]);
await db.query(`insert into payments (guest_id, booking_id, amount_usd, provider, status) values ($1, $2, 100, 'zelle', 'succeeded')`, [GUEST, tour]);

const today = "(now() at time zone 'America/Tegucigalpa')::date";
const ob = await val(OWNER, `select office_board(${today}, ${today})`);
ok(ob.rides.length === 1 && ob.rides[0].captain === 'Captain Ray' && ob.rides[0].fare === 12, 'owner sees the ride, captain and fare');
ok(ob.rides[0].guest_email === 'guest@x.com' && ob.rides[0].guest_phone === '+15550100', 'owner sees guest contacts');
ok(ob.land_rides.length === 1 && ob.land_rides[0].driver === 'Kevin', 'owner sees which driver did the land ride');
const mb = await val(MGR, `select office_board(${today}, ${today})`);
ok(mb.rides.length === 1 && mb.bookings.length === 1 && mb.bookings[0].total === 100, 'manager sees all bookings with fares');
const tb = await val(TEAM, `select office_board(${today}, ${today})`);
ok(tb.rides.length === 0 && tb.land_rides.length === 0, 'team member does not see taxi rides');
ok(tb.bookings.length === 1 && tb.bookings[0].total === null && tb.bookings[0].guest_phone === '+15550100', 'team member sees the tour and guest contact, not the money');
await throws(() => as(MGR, `select office_money(${today}, ${today})`), /office_forbidden/, 'manager cannot see money');
await throws(() => as(MGR, 'select office_payouts_owed()'), /office_forbidden/, 'manager cannot see payouts or splits');
await throws(() => as(TEAM, `select office_people(${today}, ${today})`), /office_forbidden/, 'team member cannot see the people list');
const mp = await val(MGR, `select office_people(${today}, ${today})`);
const ray = mp.captains.find((c) => c.name === 'Captain Ray');
ok(ray.rides_done === 1 && ray.earned === null, 'manager sees who did what, not earnings');
ok(mp.drivers[0].rides_done === 1, 'manager sees driver rides done');

// ---- Team member manages the tour ----
await as(TEAM, `select office_update_booking('${tour}', 'check_in')`);
await as(TEAM, `select office_update_booking('${tour}', 'provider', null, 'captain', '${CAPT}')`);
await as(TEAM, `select office_update_booking('${tour}', 'note', 'Bring 2 helmets')`);
await as(TEAM, `select office_update_booking('${tour}', 'complete')`);
const b = await one('select * from bookings where id=$1', [tour]);
ok(b.status === 'completed' && b.checked_in_at && b.provider_captain_id === CAPT && b.ops_note === 'Bring 2 helmets' && b.handled_by === TEAM, 'team member checks in, assigns a captain, notes, completes');
await throws(() => as(TEAM, `select office_update_booking('${tour}', 'provider', null, 'captain', '${GUEST}')`), /bad_provider/, 'only real captains can be assigned');
await throws(() => as(STRANGER, `select office_update_booking('${tour}', 'complete')`), /office_forbidden/, 'a stranger cannot change bookings');

// ---- Money and payouts (owner) ----
const money = await val(OWNER, `select office_money(${today}, ${today})`);
ok(Number(money.net_sales) === 112 && Number(money.you_keep) === 22.4 && Number(money.providers_share) === 89.6, 'owner sees sales, 20% kept, provider share');
await as(OWNER, 'select office_set_settings(25, 3)');
ok(Number((await val(OWNER, 'select office_settings()')).commission_pct) === 25, 'owner changes the percentage');
await throws(() => as(MGR, 'select office_set_settings(5, 3)'), /office_forbidden/, 'manager cannot change the percentage');
const owed = await val(OWNER, 'select office_payouts_owed()');
const capOwed = owed.find((o) => o.payee_kind === 'captain');
ok(owed.length === 2, 'two payees owed: the captain and the driver');
ok(capOwed.items === 2 && Number(capOwed.gross_usd) === 112 && Number(capOwed.amount_usd) === 84 && capOwed.due_on, 'captain owed for ride + tour at 75%, with a due date');
const paid = await val(OWNER, `select office_mark_paid('captain', '${CAPT}', 'Tigo Money', 'TX123')`);
ok(Number(paid.amount_usd) === 84 && paid.items === 2, 'owner marks the captain paid');
ok((await val(OWNER, 'select office_payouts_owed()')).length === 1, 'captain is no longer owed');
await throws(() => as(OWNER, `select office_mark_paid('captain', '${CAPT}', 'cash')`), /nothing_owed/, 'cannot pay the same rides twice');
const hist = await val(OWNER, 'select office_payout_history(10)');
ok(hist[0].payee_name === 'Captain Ray' && hist[0].paid_by === 'Dean' && Number(hist[0].commission_pct) === 25, 'payout history records who paid and at what percentage');
const log = await val(OWNER, 'select office_activity(50)');
ok(log.some((l) => l.action === 'payout.paid') && log.some((l) => l.action === 'booking.complete' && l.who === 'Tom Team'), 'activity log records payouts and who completed the tour');

// ---- Chart ----
const tr = await val(OWNER, "select office_trend('today')");
ok(tr.unit === 'hour' && tr.buckets.length === 24, 'today chart has 24 hourly bars');
const sum = (t, k) => t.buckets.reduce((a, b) => a + (b[k] ?? 0), 0);
ok(sum(tr, 'water') === 1 && sum(tr, 'land') === 1 && sum(tr, 'tours') === 1, 'today chart counts the ride, land ride and tour');
ok(tr.buckets.find((b) => b.tours === 1).start.endsWith('T09:00'), 'tour is counted at its 9:00 start');
const wk = await val(MGR, "select office_trend('week')");
ok(wk.unit === 'day' && wk.buckets.length === 7 && sum(wk, 'water') === 1, 'manager sees the 7-day chart');
const yr = await val(OWNER, "select office_trend('year')");
ok(yr.unit === 'month' && yr.buckets.length === 12 && yr.by_weekday.length === 7 && yr.busiest_hour !== null, 'year chart has 12 months and busiest day/hour');
ok((await val(OWNER, "select office_trend('yesterday')")).buckets.length === 24, 'yesterday chart has 24 hourly bars');
ok((await val(OWNER, "select office_trend('month')")).buckets.length === 30, 'month chart has 30 days');
const tt = await val(TEAM, "select office_trend('today')");
ok(tt.buckets.every((b) => b.water === null && b.land === null) && sum(tt, 'tours') === 1, 'team member chart shows tours only');
await throws(() => as(STRANGER, "select office_trend('today')"), /office_forbidden/, 'a stranger cannot see the chart');
await throws(() => as(OWNER, "select office_trend('decade')"), /bad_period/, 'unknown period refused');

// ---- Chart v2 ----
const tot = (c, k) => c.points.reduce((a, b) => a + Number(b[k] ?? 0), 0);
const h1 = await val(OWNER, "select office_chart('1h')");
ok(h1.points.length === 12 && tot(h1, 'water') === 1 && tot(h1, 'land') === 1, '1H: 12 five-minute points with the ride and land ride just now');
const d1 = await val(OWNER, "select office_chart('24h')"), w1 = await val(OWNER, "select office_chart('1w')");
ok(d1.points.length === 24 && w1.points.length === 28, '24H has 24 points, 1W has 28');
const m1 = await val(OWNER, "select office_chart('1m')");
ok(m1.points.length === 30 && tot(m1, 'tours') === 1 && Number(m1.prev_total) === 0, '1M counts the tour; nothing in the month before');
const y1 = await val(OWNER, "select office_chart('1y')"), a1 = await val(OWNER, "select office_chart('all')");
ok(y1.points.length === 52 && a1.points.length >= 12 && a1.prev_total === null, '1Y weekly, All monthly');
const ppl = await val(OWNER, "select office_chart('1m', 'people')");
ok(tot(ppl, 'water') === 2 && tot(ppl, 'land') === 2 && tot(ppl, 'tours') === 2, 'people counts riders and tour guests');
const rev = await val(OWNER, "select office_chart('1m', 'revenue')");
ok(tot(rev, 'water') === 12 && tot(rev, 'land') === 25 && tot(rev, 'tours') === 100, 'owner sees revenue by service');
await throws(() => as(MGR, "select office_chart('1m', 'revenue')"), /office_forbidden/, 'manager cannot chart revenue');
const tm = await val(TEAM, "select office_chart('1m')");
ok(tm.series.length === 1 && tm.points.every((p) => p.water === null) && tot(tm, 'tours') === 1, 'team member chart is tours only');
await throws(() => as(OWNER, "select office_chart('5y')"), /bad_period/, 'unknown chart period refused');

// ---- Tables are closed to direct reads ----
ok((await as(MGR, 'select * from payouts')).rows.length === 0, 'payouts table is not readable directly');
ok((await as(GUEST, 'select * from staff')).rows.length === 0, 'staff table is not readable directly');

// ---- Removing someone ----
await as(OWNER, `select office_set_staff('${TEAM}', null)`);
await throws(() => as(TEAM, `select office_board(${today}, ${today})`), /office_forbidden/, 'a removed team member loses access');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
