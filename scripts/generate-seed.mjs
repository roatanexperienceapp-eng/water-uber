// Regenerates supabase/seed.sql from the app's catalogue so the database and the app never drift.
// Usage: node scripts/generate-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const cat = readFileSync('src/data/catalogue.ts', 'utf8');
const geo = readFileSync('supabase/functions/_shared/geo.ts', 'utf8');
const pick = (src, re) => JSON.parse(src.match(re)[1]);
const portals = pick(cat, /export const PORTALS: Portal\[\] = (\[[\s\S]*?\]);\n\nexport/);
const listings = pick(cat, /export const LISTINGS: Listing\[\] = (\[[\s\S]*\]);/);
const docks = pick(geo, /export const DOCKS: Dock\[\] = (\[[\s\S]*?\]);/);
const zone = pick(geo, /export const FLAT_ZONE: readonly string\[\] = (\[.*?\]);/);

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? 'null' : String(v));
const b = (v) => (v ? 'true' : 'false');
const OWNER = "'00000000-0000-0000-0000-000000000001'";

const out = [
  '-- Seed data generated from src/data/catalogue.ts and supabase/functions/_shared/geo.ts.',
  '-- Regenerate with: node scripts/generate-seed.mjs   (do not hand-edit listings here; edit the catalogue).',
  '',
  '-- Your own business. Fill in the real WhatsApp before launch.',
  `insert into public.operators (id, name, whatsapp, is_partner) values (${OWNER}, 'Owner tours & rentals', null, true) on conflict do nothing;`,
  '',
  'insert into public.docks (id, name, lon, lat, in_flat_zone) values',
  docks.map((d) => `  (${q(d.id)}, ${q(d.name)}, ${d.lon}, ${d.lat}, ${b(zone.includes(d.id))})`).join(',\n') +
    '\non conflict (id) do update set name = excluded.name, lon = excluded.lon, lat = excluded.lat, in_flat_zone = excluded.in_flat_zone;\n',
  'insert into public.portals (key, icon, names, kind, sort) values',
  portals.map((p, i) => `  (${q(p.key)}, ${q(p.icon)}, ${q(JSON.stringify(p.names))}::jsonb, ${q(p.kind)}, ${i})`).join(',\n') +
    '\non conflict (key) do update set icon = excluded.icon, names = excluded.names, kind = excluded.kind, sort = excluded.sort;\n',
  'insert into public.listings (id, portal_key, operator_id, name, area, description, price_usd, price_is_from, price_text, unit, rating, reviews, phone, lon, lat, tag, ours, booking, sort) values',
  listings
    .map((l, i) => {
      const [lon, lat] = l.coords ?? [null, null];
      return `  (${q(l.id)}, ${q(l.portal)}, ${l.ours ? OWNER : 'null'}, ${q(l.name)}, ${q(l.area)}, ${q(l.description ?? '')}, ${n(l.priceUsd)}, ${b(l.priceIsFrom)}, ${q(l.priceText)}, ${q(l.unit ?? 'person')}, ${n(l.rating)}, ${n(l.reviews)}, ${q(l.phone)}, ${n(lon)}, ${n(lat)}, ${q(l.tag)}, ${b(l.ours)}, ${q(l.booking)}, ${i})`;
    })
    .join(',\n') +
    '\non conflict (id) do update set portal_key = excluded.portal_key, name = excluded.name, area = excluded.area, description = excluded.description, price_usd = excluded.price_usd, price_is_from = excluded.price_is_from, price_text = excluded.price_text, unit = excluded.unit, rating = excluded.rating, reviews = excluded.reviews, phone = excluded.phone, lon = excluded.lon, lat = excluded.lat, tag = excluded.tag, ours = excluded.ours, booking = excluded.booking, sort = excluded.sort, updated_at = now();\n',
];
writeFileSync('supabase/seed.sql', out.join('\n'));
console.log(`seed.sql: ${docks.length} docks, ${portals.length} portals, ${listings.length} listings`);
