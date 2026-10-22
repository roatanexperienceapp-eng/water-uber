export type LangCode = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'zh';

export interface Portal {
  key: string;
  icon: string;
  names: Partial<Record<LangCode, string>> & { en: string };
  /** 'book' portals sell trips; 'info' portals (pharmacies, hospitals) only show call + directions. */
  kind: 'book' | 'info';
}

export type BookingMode = 'instant' | 'request' | 'info';
export type PriceUnit = 'person' | 'boat' | 'day' | 'ski';

export interface Listing {
  id: string;
  portal: string;
  name: string;
  area: string;
  description: string;
  priceText?: string;
  priceUsd?: number;
  priceIsFrom?: boolean;
  unit?: PriceUnit;
  rating?: number;
  reviews?: number;
  phone?: string;
  coords?: [number, number];
  tag?: string;
  ours?: boolean;
  booking: BookingMode;
  /** Where to meet the guide (falls back to the port gate for cruise guests on port-pickup tours). */
  meeting?: string;
  /** The operator collects cruise guests at the port gate. */
  portPickup?: boolean;
  /** Activity length; defaults to the typical length for the portal. */
  durationMinutes?: number;
}

export type BoatKind = 'taxi' | 'tour' | 'fish';

export interface LiveBoat {
  id: string;
  name: string;
  kind: BoatKind;
  seats: number;
  available: boolean;
  lon: number;
  lat: number;
}

/** Mirrors public.ride_status in the database. */
export type RideStatus = 'awaiting_payment' | 'paid' | 'accepted' | 'onboard' | 'completed' | 'cancelled';

export interface Ride {
  id: string;
  from: string;
  to: string;
  riders: number;
  mode: 'shared' | 'private';
  timing: 'now' | 'scheduled';
  scheduledFor?: string;
  hasKids: boolean;
  needsTowels: boolean;
  fareUsd: number;
  miles: number;
  status: RideStatus;
  createdAt: string;
  captainName?: string;
  captainWhatsApp?: string;
  /** When the boat should be at the dock. */
  pickupAt?: string;
  /** Captain confirmed he is on the way (guaranteed pickup). */
  captainConfirmed?: boolean;
  /** Paid by a ride pass. */
  coveredByPass?: boolean;
  /** Night ride: only boats with running lights. */
  needsLitBoat?: boolean;
  /** Linked tour/dive/dinner booking. */
  bookingId?: string;
  /** Shared boat this rider joined. */
  sharedBoatId?: string;
  /** Part of a repeat ride. */
  repeatId?: string;
}

export interface Booking {
  id: string;
  listingId: string;
  listingName: string;
  date: string;
  time: string;
  quantity: number;
  totalUsd?: number;
  /** Mirrors public.booking_status in the database. */
  status: 'requested' | 'quoted' | 'awaiting_payment' | 'paid' | 'cancelled' | 'completed';
  createdAt: string;
  operatorWhatsApp?: string;
  /** Shown as a QR on the ticket; the operator scans it to check the group in. */
  ticketCode?: string;
  shipCallId?: string;
  checkedIn?: boolean;
  /** Paid in shares by a group (pay through the group link, not the single Pay button). */
  isSplit?: boolean;
  /** Cruise guests: our van from the port gate and back (seats, price, island-clock instants). */
  vanSeats?: number;
  vanUsd?: number;
  vanPickupAt?: string;
  vanReturnAt?: string;
}
