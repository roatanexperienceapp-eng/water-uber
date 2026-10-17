import { transferMinutes } from '../../supabase/functions/_shared/cruise.ts';
import type { ShipCall } from '../../supabase/functions/_shared/cruise.ts';
import type { Listing } from '@/types';

/**
 * Where the guest meets the guide, in plain words.
 * Cruise guest + operator does port pickup → the port gate. Otherwise the operator's meeting point,
 * plus how long the taxi from the port takes when the guest is on a ship.
 */
export function meetingText(listing: Listing, ship: ShipCall | null, t: (k: string) => string): string {
  if (ship && listing.portPickup) return t(`meetPort_${ship.port}`);
  const base = listing.meeting ?? t('meetAskOperator').replace('{area}', listing.area);
  if (!ship) return base;
  const min = transferMinutes(ship.port, listing.area);
  return min ? `${base} ${t('taxiFromPort').replace('{m}', String(min))}` : base;
}
