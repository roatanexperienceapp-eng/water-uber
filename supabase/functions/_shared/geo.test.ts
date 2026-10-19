import { deepStrictEqual as eq, ok } from 'node:assert';
import { DOCKS, FLAT_ZONE, nodeCoords, routeFor, SEA_EDGES, type LngLat } from './geo.ts';
import { COAST } from '../../../src/data/coast.ts';

function inPoly([x, y]: LngLat, poly: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[j];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}
const onLand = (p: LngLat) => COAST.some((poly) => inPoly(p, poly));

Deno.test('every pier is in the water', () => {
  for (const d of DOCKS) ok(!onLand([d.lon, d.lat]), `${d.name} is on land`);
});

Deno.test('no sea lane crosses land', () => {
  for (const [a, b] of SEA_EDGES) {
    const [p, q] = [nodeCoords(a), nodeCoords(b)];
    for (let i = 1; i < 60; i++) ok(!onLand([p[0] + ((q[0] - p[0]) * i) / 60, p[1] + ((q[1] - p[1]) * i) / 60]), `${a}–${b} crosses land`);
  }
});

Deno.test('every pier can reach every other pier by sea', () => {
  for (const a of DOCKS) for (const b of DOCKS) ok(routeFor(a.id, b.id).miles >= 0);
});

Deno.test('flat zone is exactly the West End and West Bay piers', () => {
  eq([...FLAT_ZONE].sort(), DOCKS.filter((d) => d.area === 'West End' || d.area === 'West Bay').map((d) => d.id).sort());
  eq(FLAT_ZONE.length, 21);
});
