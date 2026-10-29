#!/usr/bin/env node
// Builds src/data/islandPlaces.ts — every store, hotel, restaurant, dive shop, pharmacy, park,
// gas station, beach and community on Roatán — from OpenStreetMap (© OpenStreetMap contributors, ODbL).
//
//   node scripts/osm-places.mjs                 # download fresh data from the Overpass API
//   node scripts/osm-places.mjs saved.json      # or use an Overpass JSON file you saved
//
// Google Maps data is NOT used: Google's terms forbid storing it in our own app.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BBOX = '16.24,-86.65,16.52,-86.18'; // Roatán (same box as supabase/functions/_shared/land.ts)
const QUERY = `[out:json][timeout:120];
(
  nwr["shop"](${BBOX});
  nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|pharmacy|hospital|clinic|doctors|dentist|fuel|bank|atm|marketplace|place_of_worship|school|police|townhall|ferry_terminal|bus_station|car_rental)$"](${BBOX});
  nwr["tourism"~"^(hotel|guest_house|hostel|motel|resort|apartment|chalet|camp_site|attraction|viewpoint|zoo|museum)$"](${BBOX});
  nwr["leisure"~"^(park|nature_reserve|beach_resort|marina|garden|sports_centre|stadium)$"](${BBOX});
  nwr["natural"="beach"](${BBOX});
  nwr["sport"="scuba_diving"](${BBOX});
  nwr["aeroway"="aerodrome"](${BBOX});
  node["place"~"^(town|village|hamlet|suburb|neighbourhood|locality)$"](${BBOX});
);
out center tags;`;

/** OSM tags → our place kinds (order matters: first match wins). */
export function kindOf(t) {
  if (t.place) return 'community';
  if (t.aeroway === 'aerodrome') return 'airport';
  if (t.amenity === 'ferry_terminal') return 'port';
  if (t.sport === 'scuba_diving' || t.shop === 'scuba_diving') return 'dive';
  if (t.amenity === 'fuel') return 'gas';
  if (t.amenity === 'pharmacy' || t.shop === 'chemist') return 'pharmacy';
  if (['hospital', 'clinic', 'doctors', 'dentist'].includes(t.amenity)) return 'health';
  if (t.tourism && ['hotel', 'guest_house', 'hostel', 'motel', 'resort', 'apartment', 'chalet', 'camp_site'].includes(t.tourism)) return 'hotel';
  if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream'].includes(t.amenity)) return 'restaurant';
  if (t.natural === 'beach' || t.leisure === 'beach_resort') return 'beach';
  if (t.leisure && ['park', 'nature_reserve', 'garden'].includes(t.leisure)) return 'park';
  if (t.tourism && ['attraction', 'viewpoint', 'zoo', 'museum'].includes(t.tourism)) return 'park';
  if (t.shop && ['supermarket', 'convenience', 'mall', 'department_store', 'general', 'greengrocer', 'bakery', 'butcher', 'alcohol', 'beverages'].includes(t.shop)) return 'store';
  if (t.shop) return 'shop';
  if (t.amenity === 'marketplace') return 'store';
  if (t.leisure === 'marina') return 'port';
  if (['bank', 'atm'].includes(t.amenity)) return 'bank';
  if (t.amenity === 'car_rental') return 'shop';
  if (t.amenity === 'police' || t.amenity === 'townhall') return 'town';
  if (t.amenity === 'school' || t.amenity === 'place_of_worship') return 'landmark';
  if (t.leisure) return 'park';
  return null;
}

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const km = (a, b) => {
  const kx = 111.32 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 110.57);
};

export function buildPlaces(elements) {
  const raw = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    const name = (t['name:en'] || t.name || '').trim();
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const kind = kindOf(t);
    if (!name || !kind || typeof lat !== 'number' || typeof lon !== 'number') continue;
    raw.push({ osm: `${e.type[0]}${e.id}`, name: name.slice(0, 60), kind, lat: +lat.toFixed(6), lon: +lon.toFixed(6) });
  }
  const communities = raw.filter((p) => p.kind === 'community');
  const communityOf = (p) => {
    let best = null;
    for (const c of communities) {
      const d = km(p, c);
      if (!best || d < best.d) best = { name: c.name, d };
    }
    return best && best.d < 6 ? best.name : 'Roatán';
  };
  // One entry per business: same name within 150 m is a duplicate (OSM often has a node and a building).
  const out = [];
  for (const p of raw.sort((a, b) => a.name.localeCompare(b.name))) {
    if (out.some((q) => q.name.toLowerCase() === p.name.toLowerCase() && km(p, q) < 0.15)) continue;
    out.push({ ...p, community: p.kind === 'community' ? p.name : communityOf(p) });
  }
  const used = new Set();
  return out.map((p) => {
    let id = `osm-${slug(p.name)}`;
    if (used.has(id)) id = `${id}-${p.osm}`;
    used.add(id);
    return { id, name: p.name, kind: p.kind, community: p.community, lat: p.lat, lon: p.lon };
  });
}

async function download() {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'RoatanWaterTaxi/1.0 (roatanexperienceapp@gmail.com)' },
    body: 'data=' + encodeURIComponent(QUERY),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export function render(places, sourceNote) {
  const counts = {};
  for (const p of places) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
  return `// GENERATED by scripts/osm-places.mjs — do not edit by hand; run the script again to refresh.
// Data © OpenStreetMap contributors, available under the Open Database Licence (ODbL): https://www.openstreetmap.org/copyright
// ${sourceNote}. ${places.length} places: ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')}.
import type { IslandPlace } from './islandPlaces.types.ts';

export const ISLAND_PLACES: IslandPlace[] = ${JSON.stringify(places, null, 0).replace(/\},\{/g, '},\n  {').replace(/^\[/, '[\n  ').replace(/\]$/, ',\n]')};
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const data = file ? JSON.parse(readFileSync(file, 'utf8')) : await download();
  const places = buildPlaces(data.elements ?? []);
  const out = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/data/islandPlaces.ts');
  writeFileSync(out, render(places, `Downloaded ${new Date().toISOString().slice(0, 10)}`));
  console.log(`Wrote ${places.length} places to ${out}`);
}
