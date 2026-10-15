// Fare and ETA rules. Shared by the app (for quotes) and the server (which recomputes before charging).
// Change prices HERE ONLY. Amounts are in whole US dollars.
import { FLAT_ZONE, routeFor } from './geo.ts';

export const PRICING = {
  /** Flat fare per rider inside the West End ↔ West Bay zone. */
  flatPerRider: 5,
  /** Private boat minimum inside the flat zone. */
  privateMinimum: 20,
  /** Outside the flat zone: dollars per rider per mile (owner's rule). */
  perRiderPerMile: 5,
  /** Added to any scheduled (reserved) pickup. */
  reservationFee: 5,
  /** Riders above this get a larger family boat. */
  standardBoatSeats: 6,
  maxRiders: 12,
} as const;

/** Assumed cruising speed and docking time. Replace with captains' real numbers. */
export const BOAT_MPH = 12;
export const DOCK_MINUTES = 3;

export type RideMode = 'shared' | 'private';
export type RideTiming = 'now' | 'scheduled';

export interface FareInput {
  from: string;
  to: string;
  riders: number;
  mode: RideMode;
  timing: RideTiming;
}

export interface FareQuote {
  total: number;
  miles: number;
  rideMinutes: number;
  rule: 'flat' | 'distance';
  /** Human-readable breakdown, e.g. "3.9 mi × $5 × 2 = $39". */
  breakdown: string;
  reservationFee: number;
}

export function isFlatZone(from: string, to: string): boolean {
  return FLAT_ZONE.includes(from) && FLAT_ZONE.includes(to);
}

export function rideMinutes(miles: number): number {
  return Math.ceil((miles / BOAT_MPH) * 60) + DOCK_MINUTES;
}

export function quoteFare(input: FareInput): FareQuote {
  const riders = Math.min(PRICING.maxRiders, Math.max(1, Math.floor(input.riders)));
  if (input.from === input.to) throw new Error('Pickup and drop-off must be different docks');
  const route = routeFor(input.from, input.to);
  const flat = isFlatZone(input.from, input.to);
  // Scheduled pickups are always a private boat for the group.
  const mode: RideMode = input.timing === 'scheduled' ? 'private' : input.mode;
  let base: number;
  let breakdown: string;
  if (flat) {
    base = mode === 'shared' ? PRICING.flatPerRider * riders : Math.max(PRICING.privateMinimum, PRICING.flatPerRider * riders);
    breakdown = mode === 'shared' ? `$${PRICING.flatPerRider} × ${riders}` : `private boat, $${PRICING.privateMinimum} minimum`;
  } else {
    base = Math.round(PRICING.perRiderPerMile * riders * route.miles);
    breakdown = `${route.miles.toFixed(1)} mi × $${PRICING.perRiderPerMile} × ${riders}`;
  }
  const fee = input.timing === 'scheduled' ? PRICING.reservationFee : 0;
  const total = base + fee;
  return {
    total,
    miles: route.miles,
    rideMinutes: rideMinutes(route.miles),
    rule: flat ? 'flat' : 'distance',
    breakdown: `${breakdown}${fee ? ` + $${fee}` : ''} = $${total}`,
    reservationFee: fee,
  };
}

export function needsFamilyBoat(riders: number, hasKids: boolean): boolean {
  return riders > PRICING.standardBoatSeats || hasKids;
}
