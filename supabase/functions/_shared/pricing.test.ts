// Run: deno test supabase/functions/_shared/
import { deepStrictEqual as assertEquals, ok as assert, throws as assertThrows } from 'node:assert';
import { quoteFare, needsFamilyBoat, rideMinutes } from './pricing.ts';
import { DOCKS, routeFor } from './geo.ts';

const q = (from: string, to: string, riders: number, mode: 'shared' | 'private' = 'shared', timing: 'now' | 'scheduled' = 'now') =>
  quoteFare({ from, to, riders, mode, timing });

Deno.test('flat zone: shared is $6 per rider', () => {
  assertEquals(q('we', 'inf', 1).total, 6);
  assertEquals(q('we', 'inf', 4).total, 24);
  assertEquals(q('inf', 'we', 2).rule, 'flat');
});

Deno.test('flat zone: private has a $20 minimum, then $6 per rider', () => {
  assertEquals(q('we', 'inf', 2, 'private').total, 20);
  assertEquals(q('we', 'inf', 6, 'private').total, 36);
});

Deno.test('scheduled pickups are private and add a $5 reservation fee', () => {
  const s = q('we', 'inf', 2, 'shared', 'scheduled');
  assertEquals(s.total, 25);
  assertEquals(s.reservationFee, 5);
});

Deno.test('Sandy Bay: West Bay $15 pp, West End $10 pp, 3-person minimum, both directions', () => {
  assertEquals(q('inf', 'sandyD', 1).total, 45); // 1 rider pays the 3-person minimum
  assertEquals(q('sandyD', 'fos', 3).total, 45);
  assertEquals(q('ban', 'tranquil', 5).total, 75);
  assertEquals(q('we', 'sandyD', 2).total, 30);
  assertEquals(q('blueBahia', 'lasRocas', 4).total, 40);
  assertEquals(q('we', 'sandyD', 1).rule, 'zone');
  assert(q('we', 'sandyD', 1).breakdown.includes('3-person minimum'));
  assertEquals(q('we', 'sandyD', 2, 'shared', 'scheduled').total, 35); // + $5 reservation
});

Deno.test('outside the zones: $6 per rider per mile, rounded to whole dollars', () => {
  const r = q('we', 'coxenD', 2);
  assertEquals(r.rule, 'distance');
  assertEquals(r.total, Math.round(6 * 2 * r.miles));
  assert(r.breakdown.endsWith(`= $${r.total}`));
});

Deno.test('riders are clamped to 1–12', () => {
  assertEquals(q('we', 'inf', 0).total, 6);
  assertEquals(q('we', 'inf', 99).total, 72);
});

Deno.test('same dock is rejected', () => {
  assertThrows(() => q('we', 'we', 2));
});

Deno.test('West End to Infinity Bay is about 1.5 miles and 11 minutes', () => {
  const r = routeFor('we', 'inf');
  assert(r.miles > 1.2 && r.miles < 1.8, `got ${r.miles}`);
  assertEquals(rideMinutes(r.miles), q('we', 'inf', 1).rideMinutes);
});

Deno.test('every dock can reach every other dock by sea', () => {
  for (const a of DOCKS) for (const b of DOCKS) if (a.id !== b.id) assert(routeFor(a.id, b.id).miles > 0, `${a.id}->${b.id}`);
});

Deno.test('family boat for more than 6 riders or kids', () => {
  assertEquals(needsFamilyBoat(6, false), false);
  assertEquals(needsFamilyBoat(7, false), true);
  assertEquals(needsFamilyBoat(2, true), true);
});
