// Packages: a water taxi pass + your own snorkel and/or fishing tour, at a discount.
// Pure TypeScript shared by the app (shows the price) and the server (charges it). Owner settings below.
import { toCents } from './payments.ts';
import { activityTotalUsd } from './tours.ts';

export const BUNDLE_SETTINGS = {
  /** Discount on the WHOLE package (pass + tours) by number of tours added. OWNER: confirm these. */
  discountPctByTours: { 1: 10, 2: 15 } as Record<number, number>,
  /** Tours that can be packaged. Only fixed-price tours qualify; a tour without a price is shown as "coming soon". */
  tours: [
    { listingId: 'snork-shipwreck-snorkel-tour', kind: 'snorkel' },
    { listingId: 'snork-pigeon-key-nurse-sharks', kind: 'snorkel' },
    { listingId: 'snork-blue-channel', kind: 'snorkel' },
    { listingId: 'snork-dolphin-show', kind: 'snorkel' },
    { listingId: 'snork-cayos-cochinos', kind: 'snorkel' },
    { listingId: 'fish-bottom-fishing', kind: 'fishing' },
    { listingId: 'fish-deep-sea-trolling', kind: 'fishing' },
  ] as { listingId: string; kind: 'snorkel' | 'fishing' }[],
} as const;

export type TourKind = 'snorkel' | 'fishing';

export interface BundleTourPrice {
  listingId: string;
  kind: TourKind;
  /** Price per unit from the listing. */
  priceUsd: number;
  unit: 'person' | 'boat' | 'day' | 'ski';
}

export interface BundleQuote {
  passCents: number;
  toursCents: number;
  subtotalCents: number;
  discountPct: number;
  discountCents: number;
  totalCents: number;
  /** How the discounted total splits between the pass and the tours (for accounting). */
  passShareCents: number;
  toursShareCents: number;
}

/** Price of a package for a group. Throws on rule breaks (two snorkel tours, no tours, …). */
export function bundleQuote(passPriceUsd: number, groupSize: number, tours: BundleTourPrice[]): BundleQuote {
  if (tours.length < 1) throw new Error('bundle_needs_a_tour');
  const kinds = tours.map((t) => t.kind);
  if (new Set(kinds).size !== kinds.length) throw new Error('one_tour_per_kind');
  const discountPct = BUNDLE_SETTINGS.discountPctByTours[tours.length];
  if (discountPct == null) throw new Error('too_many_tours');
  const passCents = toCents(passPriceUsd);
  const toursCents = tours.reduce((sum, t) => sum + toCents(activityTotalUsd(t.priceUsd, t.unit, groupSize)), 0);
  const subtotalCents = passCents + toursCents;
  const discountCents = Math.round((subtotalCents * discountPct) / 100);
  const totalCents = subtotalCents - discountCents;
  const passShareCents = Math.round((totalCents * passCents) / subtotalCents);
  return { passCents, toursCents, subtotalCents, discountPct, discountCents, totalCents, passShareCents, toursShareCents: totalCents - passShareCents };
}

export function bundleTour(listingId: string) {
  return BUNDLE_SETTINGS.tours.find((t) => t.listingId === listingId);
}
