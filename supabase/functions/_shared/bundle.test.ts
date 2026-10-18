import { deepStrictEqual as eq, throws } from 'node:assert';
import { bundleQuote } from './bundle.ts';

const shipwreck = { listingId: 'snork-shipwreck-snorkel-tour', kind: 'snorkel' as const, priceUsd: 85, unit: 'person' as const };
const fishing = { listingId: 'fish-our-fishing-tour', kind: 'fishing' as const, priceUsd: 400, unit: 'boat' as const };

Deno.test('family of 3: week pass + shipwreck snorkel = 10% off the whole package', () => {
  const q = bundleQuote(105, 3, [shipwreck]); // pass $105 + snorkel 3 × $85 = $255 → $360
  eq(q.subtotalCents, 36000);
  eq(q.discountPct, 10);
  eq(q.totalCents, 32400); // $324, saves $36
  eq(q.passShareCents + q.toursShareCents, q.totalCents);
});

Deno.test('pass + snorkel + fishing = 15% off; per-boat prices are not multiplied by people', () => {
  const q = bundleQuote(140, 4, [shipwreck, fishing]); // 140 + 340 + 400 = 880
  eq(q.subtotalCents, 88000);
  eq(q.discountPct, 15);
  eq(q.totalCents, 74800);
});

Deno.test('package rules', () => {
  throws(() => bundleQuote(70, 2, []), /bundle_needs_a_tour/);
  throws(() => bundleQuote(70, 2, [shipwreck, { ...shipwreck, listingId: 'snork-dolphins-mangroves-tour' }]), /one_tour_per_kind/);
});
