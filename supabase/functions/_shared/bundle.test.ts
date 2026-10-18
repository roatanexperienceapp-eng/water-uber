import { deepStrictEqual as eq, throws } from 'node:assert';
import { bundleQuote } from './bundle.ts';
import { activityTotalUsd, boatsFor } from './tours.ts';

const shipwreck = { listingId: 'snork-shipwreck-snorkel-tour', kind: 'snorkel' as const, priceUsd: 95, unit: 'person' as const };
const blue = { listingId: 'snork-blue-channel', kind: 'snorkel' as const, priceUsd: 30, unit: 'person' as const };
const bottom = { listingId: 'fish-bottom-fishing', kind: 'fishing' as const, priceUsd: 60, unit: 'person' as const };
const trolling = { listingId: 'fish-deep-sea-trolling', kind: 'fishing' as const, priceUsd: 350, unit: 'boat' as const };

Deno.test('family of 3: week pass + shipwreck snorkel = 10% off the whole package', () => {
  const q = bundleQuote(105, 3, [shipwreck]); // pass $105 + snorkel 3 × $95 = $285 → $390
  eq(q.subtotalCents, 39000);
  eq(q.discountPct, 10);
  eq(q.totalCents, 35100); // $351, saves $39
  eq(q.passShareCents + q.toursShareCents, q.totalCents);
});

Deno.test('pass + snorkel + fishing = 15% off', () => {
  const q = bundleQuote(140, 4, [blue, bottom]); // 140 + 4×30 + 4×60 = 500
  eq(q.subtotalCents, 50000);
  eq(q.discountPct, 15);
  eq(q.totalCents, 42500);
});

Deno.test('deep sea trolling is per boat: up to 6 people share one boat, 8 people need two', () => {
  eq(boatsFor(1), 1);
  eq(boatsFor(6), 1);
  eq(boatsFor(7), 2);
  eq(activityTotalUsd(350, 'boat', 4), 350);
  eq(activityTotalUsd(350, 'boat', 8), 700);
  eq(activityTotalUsd(60, 'person', 8), 480);
  const q = bundleQuote(280, 8, [trolling]); // 280 + 2 boats × 350 = 980
  eq(q.subtotalCents, 98000);
});

Deno.test('package rules', () => {
  throws(() => bundleQuote(70, 2, []), /bundle_needs_a_tour/);
  throws(() => bundleQuote(70, 2, [shipwreck, blue]), /one_tour_per_kind/);
});
