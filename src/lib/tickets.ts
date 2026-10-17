import { readJSON, writeJSON } from '@/lib/localStore';

/**
 * Tickets saved on the phone so they open with no signal or data roaming (cruise guests usually have
 * neither ashore). Saved whenever a paid booking is shown; nothing secret is stored besides the ticket
 * code the guest shows the guide.
 */
export interface SavedTicket {
  bookingId: string;
  title: string;
  date: string; // island date
  time: string; // island time
  quantity: number;
  ticketCode: string;
  meetText: string;
  contactName?: string;
  whatsapp?: string;
  shipName?: string;
  allAboardAt?: string;
  backAtPortBy?: string;
  savedAt: string;
}

const KEY = 'tickets.v1';

export function savedTickets(): SavedTicket[] {
  return readJSON<SavedTicket[]>(KEY, []).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export function savedTicket(bookingId: string): SavedTicket | undefined {
  return readJSON<SavedTicket[]>(KEY, []).find((x) => x.bookingId === bookingId);
}

export function saveTicket(t: Omit<SavedTicket, 'savedAt'>): void {
  const others = readJSON<SavedTicket[]>(KEY, []).filter((x) => x.bookingId !== t.bookingId);
  // Keep the phone tidy: drop tickets more than 3 days old.
  const cutoff = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  writeJSON(KEY, [...others.filter((x) => x.date >= cutoff), { ...t, savedAt: new Date().toISOString() }]);
}

/** QR payload: versioned so the scanner can evolve. */
export const ticketQrValue = (code: string) => `WU1:${code}`;
