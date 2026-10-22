import { PORTS, roatanInstant, type ShipCall } from '../../supabase/functions/_shared/cruise.ts';
import { DOCKS } from '../../supabase/functions/_shared/geo.ts';
import { meetingPoint } from '../../supabase/functions/_shared/transport.ts';
import type { GettingThereProps } from '@/components/GettingThereCard';
import { LISTINGS } from '@/data/catalogue';
import type { SavedTicket } from '@/lib/tickets';
import type { Ride } from '@/types';

/** Where a ticket holder has to get to: the port gate when our van picks them up, else the meeting point. */
export function ticketTrip(ticket: SavedTicket, ship: ShipCall | null): GettingThereProps {
  const listing = ticket.listingId ? LISTINGS.find((l) => l.id === ticket.listingId) : undefined;
  const port = ticket.vanPickupAt && ship ? PORTS[ship.port] : null;
  const dest = port ? { lat: port.lat, lon: port.lon } : listing ? meetingPoint({ area: listing.area }) : null;
  const dockName = dest && 'dockId' in dest && dest.dockId ? DOCKS.find((d) => d.id === dest.dockId)?.name : undefined;
  return {
    tripId: ticket.bookingId,
    title: ticket.title,
    start: ticket.vanPickupAt ? new Date(ticket.vanPickupAt) : roatanInstant(ticket.date, ticket.time),
    dest,
    destName: port?.name ?? dockName ?? listing?.area ?? ticket.title,
    riders: ticket.quantity,
    vanPickupAt: ticket.vanPickupAt,
  };
}

/** A scheduled water taxi: get to the pickup dock by the pickup time. */
export function rideTrip(ride: Ride): GettingThereProps | null {
  if (!ride.pickupAt || ride.timing !== 'scheduled') return null;
  if (!['paid', 'accepted'].includes(ride.status)) return null;
  const d = DOCKS.find((x) => x.id === ride.from);
  if (!d) return null;
  return {
    tripId: ride.id,
    title: d.name,
    start: new Date(ride.pickupAt),
    // No dockId: never suggest a water taxi to reach a water taxi.
    dest: { lat: d.lat, lon: d.lon },
    destName: d.name,
    riders: ride.riders,
  };
}
