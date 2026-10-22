import { transferMinutes } from '../../supabase/functions/_shared/cruise.ts';
import type { ShipCall } from '../../supabase/functions/_shared/cruise.ts';
import type { Listing } from '@/types';

/**
 * Where the guest meets the guide, in plain words.
 *  - Cruise guest with our van → the port gate at the van time.
 *  - Cruise guest + another business that picks up at the port → the port gate.
 *  - Otherwise the operator's meeting point, plus how long the ride from the port takes.
 * `vanAt` is the van pickup time already formatted for the guest's language.
 */
export function meetingText(listing: Listing, ship: ShipCall | null, t: (k: string) => string, vanAt?: string | null): string {
  if (ship && vanAt) return `${t('vanMeet').replace('{t}', vanAt)} ${t(`meetPort_${ship.port}`)}`;
  if (ship && listing.portPickup && !listing.ours) return t(`meetPort_${ship.port}`);
  const base = listing.meeting ?? t('meetAskOperator').replace('{area}', listing.area);
  if (!ship) return base;
  const min = transferMinutes(ship.port, listing.area);
  return min ? `${base} ${t('taxiFromPort').replace('{m}', String(min))}` : base;
}
