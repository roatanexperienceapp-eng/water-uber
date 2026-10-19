// Database tests for the community (posts, sightings, reports, blocks, rules) and app feedback.
// Usage: node supabase/tests/community.test.mjs
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

const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
const D = '44444444-4444-4444-4444-444444444444', ADMIN = '55555555-5555-5555-5555-555555555555';
for (const id of [A, B, C, D, ADMIN]) await db.query('insert into auth.users (id) values ($1)', [id]);
await db.query("update profiles set role='admin' where id=$1", [ADMIN]);

async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const post = (uid, body, extra = {}) =>
  as(uid, `insert into community_posts (author_id, author_name, channel, body, parent_id, spot, species, link_url, media_path, media_kind) values ($1,'x',$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [uid, extra.channel ?? 'discuss', body, extra.parent ?? null, extra.spot ?? null, extra.species ?? null, extra.link ?? null, extra.media ?? null, extra.media ? 'image' : null]).then((r) => r.rows[0]);

// ---- Rules first ----
await throws(() => post(A, 'Hi all'), /accept_rules_first/, 'cannot post before accepting the community rules');
await as(A, "update profiles set community_terms_at = now() where id = $1", [A]);
await throws(() => post(A, 'Hi all'), /pick_a_name_first/, 'cannot post without a display name');
await as(A, "update profiles set community_name = 'Ana from Ohio' where id = $1", [A]);
for (const [u, n] of [[B, 'Ben'], [C, 'Cy'], [D, 'Dee']]) await as(u, 'update profiles set community_terms_at = now(), community_name = $2 where id = $1', [u, n]);
await as(D, "update profiles set community_name = 'Water Uber Team' where id = $1", [D]);
await throws(() => post(D, 'Official: free rides!'), /reserved_name/, 'guests cannot pose as the business');
await as(D, "update profiles set community_name = 'Dee' where id = $1", [D]);

// ---- Posting ----
const p1 = await post(A, 'Is West Bay crowded on Tuesdays?');
ok(p1.author_name === 'Ana from Ohio' && !p1.hidden, 'post saved with the author\'s display name (not what the app sent)');
await throws(() => as(A, "insert into community_posts (author_id, author_name, channel, body) values ($1,'x','discuss','hi')", [B]), /row-level security/, 'cannot post as someone else');
await throws(() => as(null, "insert into community_posts (author_id, author_name, channel, body) values ($1,'x','discuss','hi')", [A]), /row-level security|permission/, 'signed-out visitors cannot post');
await throws(() => post(B, 'this is shit'), /blocked_words/, 'offensive words are blocked');
await throws(() => post(B, 'Hola pendejo'), /blocked_words/, 'Spanish offensive words are blocked too');
ok((await post(B, 'Shitake mushrooms at the market?')).id, 'whole-word filter: innocent words containing a bad word still post');
await throws(() => post(B, 'see', { link: 'http://evil.example' }), /link_url|check|violates/, 'only https links allowed');
await throws(() => post(B, '', {}), /has_content/, 'empty posts rejected');
await throws(() => post(B, 'pic', { media: `${A}/photo.jpg` }), /bad_media_path/, 'cannot attach a file from someone else\'s folder');
ok((await post(B, 'pic', { media: `${B}/photo.jpg` })).media_kind === 'image', 'photo post from own folder');

// ---- Replies and sightings ----
const r1 = await post(B, 'Mornings are calmer', { parent: p1.id });
ok(r1.parent_id === p1.id, 'reply saved');
await throws(() => post(C, 'reply to reply', { parent: r1.id }), /cannot_reply_here/, 'replies are one level deep');
const s1 = await post(C, 'Hawksbill turtle!', { channel: 'sighting', spot: 'Spooky Channel', species: 'Hawksbill turtle', media: `${C}/turtle.jpg` });
ok(s1.channel === 'sighting' && s1.spot === 'Spooky Channel', 'sighting with spot and species');

// ---- Reading ----
ok((await as(B, "select * from community_posts where channel='discuss' and parent_id is null")).rows.length === 3, 'guests read the discussion');
ok((await as(null, 'select * from community_posts')).rows.length === 0, 'signed-out visitors read nothing');

// ---- Block ----
await as(A, 'insert into community_blocks (blocker_id, blocked_id) values ($1,$2)', [A, B]);
ok(!(await as(A, 'select author_id from community_posts')).rows.some((r) => r.author_id === B), 'blocked author disappears for the blocker');
ok((await as(C, 'select author_id from community_posts')).rows.some((r) => r.author_id === B), '…but not for others');

// ---- Report → hidden after 3 ----
for (const u of [A, C]) await as(u, "insert into community_reports (post_id, reporter_id, reason) values ($1,$2,'spam')", [s1.id, u]);
ok(!(await db.query('select hidden from community_posts where id=$1', [s1.id])).rows[0].hidden, '2 reports: still visible');
await throws(() => as(A, "insert into community_reports (post_id, reporter_id, reason) values ($1,$2,'spam')", [s1.id, A]), /duplicate|unique/, 'one report per person');
await as(D, "insert into community_reports (post_id, reporter_id, reason) values ($1,$2,'abuse')", [s1.id, D]);
ok((await db.query('select hidden from community_posts where id=$1', [s1.id])).rows[0].hidden, '3rd report hides the post for review');
ok((await as(B, 'select * from community_posts where id=$1', [s1.id])).rows.length === 0, 'hidden post gone for others');
ok((await as(C, 'select * from community_posts where id=$1', [s1.id])).rows.length === 1, 'author still sees own hidden post');
ok((await as(ADMIN, 'select * from community_reports')).rows.length === 3, 'office sees the reports');
ok((await as(B, 'select * from community_reports')).rows.length === 0, 'guests do not see others\' reports');
await as(C, 'update community_posts set hidden=false where id=$1', [s1.id]);
ok((await db.query('select hidden from community_posts where id=$1', [s1.id])).rows[0].hidden, 'author cannot un-hide');
await as(ADMIN, 'update community_posts set hidden=false where id=$1', [s1.id]);
ok(!(await db.query('select hidden from community_posts where id=$1', [s1.id])).rows[0].hidden, 'office can restore after review');

// ---- Delete ----
await as(B, 'delete from community_posts where id=$1', [p1.id]);
ok((await db.query('select count(*)::int n from community_posts where id=$1', [p1.id])).rows[0].n === 1, 'cannot delete someone else\'s post');
await as(A, 'delete from community_posts where id=$1', [p1.id]);
ok((await db.query('select count(*)::int n from community_posts where id=$1 or parent_id=$1', [p1.id])).rows[0].n === 0, 'author deletes post (replies go too)');

// ---- Rate limit ----
await db.query('update community_settings set max_posts_per_day = 3');
await post(D, 'one'); await post(D, 'two'); await post(D, 'three');
await throws(() => post(D, 'four'), /too_many_posts/, 'daily post limit');

// ---- Feedback (private) ----
await as(A, "insert into app_feedback (guest_id, rating, kind, body) values ($1, 4, 'confusing', 'Where do I see my ticket?')", [A]);
await throws(() => as(A, "insert into app_feedback (guest_id, kind) values ($1, 'idea')", [A]), /feedback_has_content/, 'empty feedback rejected');
ok((await as(B, 'select * from app_feedback')).rows.length === 0, 'feedback is private');
ok((await as(A, 'select * from app_feedback')).rows.length === 1 && (await as(ADMIN, 'select * from app_feedback')).rows.length === 1, 'author and office can read it');

// ---- Account deletion removes community content ----
ok((await db.query('select erase_guest($1) r', [C])).rows[0].r === 'ok', 'erase_guest runs');
ok((await db.query('select count(*)::int n from community_posts where author_id=$1', [C])).rows[0].n === 0, 'deleted account: posts removed');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
