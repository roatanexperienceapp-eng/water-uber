// Tests the OpenStreetMap → island places converter. Usage: node supabase/tests/osm_places.test.mjs
import { readFileSync } from 'node:fs';
import { buildPlaces, kindOf, render } from '../../scripts/osm-places.mjs';
let passed = 0, failed = 0;
const ok = (c, n) => { c ? passed++ : failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const data = JSON.parse(readFileSync(new URL('./fixtures/overpass-sample.json', import.meta.url), 'utf8'));
const places = buildPlaces(data.elements);
const by = (n) => places.find((p) => p.name === n);
ok(places.length === 8, `8 named places kept (got ${places.length})`);
ok(by('Farmacia Test').kind === 'pharmacy' && by('Farmacia Test').community === 'West End', 'pharmacy, community West End');
ok(places.filter((p) => p.name === 'Gas Test').length === 1 && by('Gas Test').kind === 'gas' && by('Gas Test').community === 'French Harbour', 'gas station de-duplicated, community French Harbour');
ok(by('Dive Test').kind === 'dive', 'dive shop');
ok(by('Café Ñandú').id === 'osm-cafe-nandu', 'ids are plain ascii slugs');
ok(by('Super Test').kind === 'store' && by('Hotel Test').kind === 'hotel', 'store and hotel');
ok(kindOf({ amenity: 'bench' }) === null, 'benches are ignored');
ok(new Set(places.map((p) => p.id)).size === places.length, 'ids are unique');
ok(render(places, 'test').includes('OpenStreetMap contributors'), 'output carries the OSM credit');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
