// How an activity's price turns into a total. Shared by the app (shows it) and the server (charges it).

export type PriceUnit = 'person' | 'boat' | 'day' | 'ski';

export const TOUR_SETTINGS = {
  /** People per boat on per-boat charters (deep sea trolling). OWNER: confirm. A group of 8 needs 2 boats. */
  seatsPerBoat: 6,
} as const;

/** Boats a group needs on a per-boat charter. */
export function boatsFor(people: number, seats: number = TOUR_SETTINGS.seatsPerBoat): number {
  return Math.max(1, Math.ceil(people / seats));
}

/**
 * Total for `quantity` (people for person/boat prices; jet skis or days otherwise).
 * Per-boat: price × boats needed, never one boat for a group that cannot fit in it.
 */
export function activityTotalUsd(priceUsd: number, unit: PriceUnit | undefined, quantity: number): number {
  if (unit === 'boat') return priceUsd * boatsFor(quantity);
  return priceUsd * quantity;
}
