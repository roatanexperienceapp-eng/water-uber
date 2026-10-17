import { quoteFare, type FareInput } from '../../supabase/functions/_shared/pricing.ts';
import { nightMode, passCovers } from '../../supabase/functions/_shared/features.ts';
import { demoActivePass, demoUsePassRide } from '@/lib/stay';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { DEMO_MODE } from '@/config';
import { ensureSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { demoBoats } from '@/lib/demoFleet';
import { readJSON, writeJSON } from '@/lib/localStore';
import type { Booking, Listing, LiveBoat, Ride } from '@/types';

/**
 * Data access for the whole app. Screens never talk to Supabase directly; they call these functions.
 * Demo mode (no backend configured) keeps everything on the phone so the app can be reviewed.
 * Live mode: the server computes every price; the client never sends an amount.
 */

const RIDES_KEY = 'demo.rides';
const BOOKINGS_KEY = 'demo.bookings';
const newId = () => Math.random().toString(36).slice(2, 10).toUpperCase();

// ---------- Row mapping (database snake_case → app camelCase) ----------

type Row = Record<string, unknown>;

function toRide(r: Row): Ride {
  return {
    id: String(r.id),
    from: String(r.from_dock),
    to: String(r.to_dock),
    riders: Number(r.riders),
    mode: r.mode as Ride['mode'],
    timing: r.timing as Ride['timing'],
    scheduledFor: (r.scheduled_for as string) ?? undefined,
    hasKids: !!r.has_kids,
    needsTowels: !!r.needs_towels,
    fareUsd: Number(r.fare_usd),
    miles: Number(r.miles),
    status: r.status as Ride['status'],
    createdAt: String(r.created_at),
    pickupAt: (r.pickup_at as string) ?? undefined,
    captainConfirmed: !!r.captain_confirmed_at,
    coveredByPass: !!r.pass_id,
    needsLitBoat: !!r.needs_lit_boat,
    bookingId: (r.booking_id as string) ?? undefined,
    sharedBoatId: (r.shared_boat_id as string) ?? undefined,
    repeatId: (r.repeat_id as string) ?? undefined,
  };
}

function toBooking(r: Row, listingName = ''): Booking {
  return {
    ticketCode: (r.ticket_code as string) ?? undefined,
    shipCallId: (r.ship_call_id as string) ?? undefined,
    checkedIn: !!r.checked_in_at,
    isSplit: Array.isArray(r.booking_splits) ? r.booking_splits.length > 0 : !!r.booking_splits,
    id: String(r.id),
    listingId: String(r.listing_id),
    listingName: listingName || String((r.listings as Row | undefined)?.name ?? r.listing_id),
    date: String(r.trip_date),
    time: String(r.trip_time),
    quantity: Number(r.quantity),
    totalUsd: r.total_usd == null ? undefined : Number(r.total_usd),
    status: r.status as Booking['status'],
    createdAt: String(r.created_at),
  };
}

export { ensureSession } from '@/lib/session';

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  await ensureSession();
  const { data, error } = await supabase!.functions.invoke<T>(name, { body });
  if (error) {
    // Surface the server's error code (e.g. "bad_time") when there is one.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const payload = await ctx.json().catch(() => null);
      if (payload?.code) throw new Error(payload.code);
    }
    throw error;
  }
  return data as T;
}

// ---------- Auth ----------

export async function sendLoginCode(email: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyLoginCode(email: string, token: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function currentUserEmail(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

// ---------- Water taxi rides ----------

export interface RideRequest extends FareInput {
  scheduledFor?: string;
  hasKids: boolean;
  needsTowels: boolean;
  usePass?: boolean;
  bookingId?: string;
}

export async function createRide(req: RideRequest): Promise<Ride> {
  if (!supabase) {
    const q = quoteFare(req);
    const at = req.scheduledFor ? new Date(req.scheduledFor) : new Date();
    if (nightMode(at) === 'boats_closed') throw new Error('boats_closed');
    const pass = req.usePass === false ? null : demoActivePass();
    const cover = passCovers(pass, { from: req.from, to: req.to, riders: req.riders, at });
    const covered = cover.covered;
    if (covered) demoUsePassRide();
    const ride: Ride = {
      id: newId(),
      from: req.from,
      to: req.to,
      riders: req.riders,
      mode: req.timing === 'scheduled' ? 'private' : req.mode,
      timing: req.timing,
      scheduledFor: req.scheduledFor,
      hasKids: req.hasKids,
      needsTowels: req.needsTowels,
      fareUsd: covered ? cover.fareUsd : q.total,
      miles: q.miles,
      status: covered && cover.fareUsd === 0 ? 'paid' : 'awaiting_payment',
      createdAt: new Date().toISOString(),
      pickupAt: at.toISOString(),
      coveredByPass: covered,
      needsLitBoat: nightMode(at) === 'night',
      bookingId: req.bookingId,
    };
    writeJSON(RIDES_KEY, [ride, ...readJSON<Ride[]>(RIDES_KEY, [])]);
    return ride;
  }
  const { ride } = await invoke<{ ride: Row }>('create-ride', {
    from: req.from,
    to: req.to,
    riders: req.riders,
    mode: req.mode,
    timing: req.timing,
    scheduledFor: req.scheduledFor,
    hasKids: req.hasKids,
    needsTowels: req.needsTowels,
    usePass: req.usePass,
    bookingId: req.bookingId,
  });
  return toRide(ride);
}

export async function getRide(id: string): Promise<Ride | undefined> {
  if (!supabase) return readJSON<Ride[]>(RIDES_KEY, []).find((r) => r.id === id);
  const { data } = await supabase.from('rides').select('*').eq('id', id).maybeSingle();
  return data ? toRide(data) : undefined;
}

export async function listMyRides(): Promise<Ride[]> {
  if (!supabase) return readJSON<Ride[]>(RIDES_KEY, []);
  const { data, error } = await supabase.from('rides').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map(toRide);
}

export async function cancelRide(id: string): Promise<void> {
  if (!supabase) {
    writeJSON(RIDES_KEY, readJSON<Ride[]>(RIDES_KEY, []).map((r) => (r.id === id ? { ...r, status: 'cancelled' as const } : r)));
    return;
  }
  const { error } = await supabase.rpc('cancel_ride', { p_ride_id: id });
  if (error) throw error;
}

/** Captain name + WhatsApp. The server only returns it after payment and acceptance. */
export async function rideContact(id: string): Promise<{ name: string; whatsapp: string } | null> {
  if (!supabase) return { name: 'Capt. Marlon (demo)', whatsapp: '' };
  const { data } = await supabase.rpc('ride_contact', { p_ride_id: id });
  const row = (data as Row[] | null)?.[0];
  return row ? { name: String(row.captain_name ?? ''), whatsapp: String(row.whatsapp ?? '') } : null;
}

// ---------- Tours, rentals and other listings ----------

export interface BookingRequest {
  listing: Listing;
  date: string; // YYYY-MM-DD, island date
  time: string; // HH:MM, island time
  quantity: number;
  note?: string;
  /** Cruise guests: the server refuses times that would miss the ship. */
  shipCallId?: string;
  /** Split the price into this many shares paid separately. */
  splitShares?: number;
}

export interface SplitInfo {
  token: string;
  shares: number;
  deadlineAt: string;
}

export async function createBooking(req: BookingRequest): Promise<Booking & { split?: SplitInfo }> {
  const { listing } = req;
  if (!supabase) {
    const instant = listing.booking === 'instant' && listing.priceUsd != null;
    const total = instant ? (listing.unit === 'boat' ? listing.priceUsd! : listing.priceUsd! * req.quantity) : undefined;
    const b: Booking & { split?: SplitInfo } = {
      ticketCode: newId(),
      shipCallId: req.shipCallId,
      id: newId(),
      listingId: listing.id,
      listingName: listing.name,
      date: req.date,
      time: req.time,
      quantity: req.quantity,
      totalUsd: total,
      status: instant ? 'awaiting_payment' : 'requested',
      createdAt: new Date().toISOString(),
    };
    if (req.splitShares && total) {
      b.split = { token: `demo${newId()}${newId()}`.toLowerCase(), shares: req.splitShares, deadlineAt: new Date(Date.now() + 2 * 3600_000).toISOString() };
      writeJSON(SPLITS_KEY, [
        { ...b.split, bookingId: b.id, totalCents: Math.round(total * 100), paid: 0, status: 'open', listingName: listing.name, date: req.date, time: req.time, quantity: req.quantity },
        ...readJSON<DemoSplit[]>(SPLITS_KEY, []),
      ]);
    }
    writeJSON(BOOKINGS_KEY, [b, ...readJSON<Booking[]>(BOOKINGS_KEY, [])]);
    return b;
  }
  const { booking, split } = await invoke<{ booking: Row; split: SplitInfo | null }>('create-booking', {
    listingId: listing.id,
    date: req.date,
    time: req.time,
    quantity: req.quantity,
    note: req.note,
    shipCallId: req.shipCallId,
    splitShares: req.splitShares,
  });
  return { ...toBooking(booking, listing.name), split: split ?? undefined };
}

/** Demo mode stands in for the database trigger that posts "Your ticket is ready". */
function demoTicketReady(b?: Booking) {
  if (!b) return;
  void import('@/lib/inbox').then(({ demoInboxAdd }) =>
    demoInboxAdd({ category: 'update', title: 'Your ticket is ready', body: `${b.listingName} on ${b.date} at ${b.time}. Your ticket works offline: open it from Trips.`, ctaLabel: 'Open ticket', ctaPath: `/ticket/${b.id}`, audience: 'all' }),
  );
}

// ---------- Group split ----------

const SPLITS_KEY = 'demo.splits';
type DemoSplit = SplitInfo & { bookingId: string; totalCents: number; paid: number; status: 'open' | 'complete' | 'expired'; listingName: string; date: string; time: string; quantity: number };

export interface SplitStatus {
  listingName: string;
  date: string;
  time: string;
  quantity: number;
  shares: number;
  paidShares: number;
  shareCents: number;
  totalCents: number;
  deadlineAt: string;
  status: 'open' | 'complete' | 'expired';
}

/** Public: anyone with the link sees progress (no names, no contact details). */
export async function splitStatus(token: string): Promise<SplitStatus | null> {
  if (!supabase) {
    const s = readJSON<DemoSplit[]>(SPLITS_KEY, []).find((x) => x.token === token);
    return s
      ? { listingName: s.listingName, date: s.date, time: s.time, quantity: s.quantity, shares: s.shares, paidShares: s.paid, shareCents: Math.floor(s.totalCents / s.shares), totalCents: s.totalCents, deadlineAt: s.deadlineAt, status: s.status }
      : null;
  }
  const { data, error } = await supabase.rpc('split_status', { p_token: token });
  if (error) throw error;
  const r = (data as Row[] | null)?.[0];
  return r
    ? {
        listingName: String(r.listing_name), date: String(r.trip_date), time: String(r.trip_time), quantity: Number(r.quantity),
        shares: Number(r.shares), paidShares: Number(r.paid_shares), shareCents: Number(r.share_cents), totalCents: Number(r.total_cents),
        deadlineAt: String(r.deadline_at), status: r.status as SplitStatus['status'],
      }
    : null;
}

/** The organizer's split for one of their bookings. */
export async function splitForBooking(bookingId: string): Promise<SplitInfo | null> {
  if (!supabase) return readJSON<DemoSplit[]>(SPLITS_KEY, []).find((x) => x.bookingId === bookingId) ?? null;
  const { data } = await supabase.from('booking_splits').select('token, shares, deadline_at').eq('booking_id', bookingId).maybeSingle();
  return data ? { token: String(data.token), shares: Number(data.shares), deadlineAt: String(data.deadline_at) } : null;
}

export async function listMyBookings(): Promise<Booking[]> {
  if (!supabase) {
    const splitIds = new Set(readJSON<DemoSplit[]>(SPLITS_KEY, []).map((x) => x.bookingId));
    return readJSON<Booking[]>(BOOKINGS_KEY, []).map((b) => ({ ...b, isSplit: splitIds.has(b.id) }));
  }
  const { data, error } = await supabase
    .from('bookings')
    .select('*, listings(name), booking_splits(token)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => toBooking(r));
}

export async function getBooking(id: string): Promise<Booking | undefined> {
  if (!supabase) return readJSON<Booking[]>(BOOKINGS_KEY, []).find((b) => b.id === id);
  const { data } = await supabase.from('bookings').select('*, listings(name)').eq('id', id).maybeSingle();
  return data ? toBooking(data) : undefined;
}

export async function bookingContact(id: string): Promise<{ name: string; whatsapp: string } | null> {
  if (!supabase) return null;
  const { data } = await supabase.rpc('booking_contact', { p_booking_id: id });
  const row = (data as Row[] | null)?.[0];
  return row ? { name: String(row.operator_name ?? ''), whatsapp: String(row.whatsapp ?? '') } : null;
}

// ---------- Payments ----------

export type PayTarget = { rideId: string } | { bookingId: string } | { passId: string } | { donationId: string } | { splitToken: string; shares: 'one' | 'rest' };

/**
 * Starts a payment for a ride or booking. Live mode asks the server to create the payment (the server
 * decides the amount); the processor's sheet is shown by lib/payments.ts. The server marks things paid
 * only from the processor's webhook.
 */
export async function startPayment(target: PayTarget, returnPath = '/trips'): Promise<{ paymentId: string; amountUsd: number; checkoutUrl?: string }> {
  if (!supabase) {
    if ('splitToken' in target) {
      const splits = readJSON<DemoSplit[]>(SPLITS_KEY, []);
      const sp = splits.find((x) => x.token === target.splitToken);
      if (!sp || sp.status !== 'open') throw new Error('split_closed');
      const count = target.shares === 'rest' ? sp.shares - sp.paid : 1;
      if (count < 1) throw new Error('no_shares_left');
      const paid = sp.paid + count;
      writeJSON(SPLITS_KEY, splits.map((x) => (x.token === sp.token ? { ...x, paid, status: paid >= x.shares ? 'complete' : 'open' } : x)));
      if (paid >= sp.shares) {
        writeJSON(BOOKINGS_KEY, readJSON<Booking[]>(BOOKINGS_KEY, []).map((b) => (b.id === sp.bookingId ? { ...b, status: 'paid' as const } : b)));
        demoTicketReady(readJSON<Booking[]>(BOOKINGS_KEY, []).find((b) => b.id === sp.bookingId));
      }
      return { paymentId: `DEMO-${sp.token}-${paid}`, amountUsd: (Math.floor(sp.totalCents / sp.shares) * count) / 100 };
    }
    if ('rideId' in target) {
      const rides = readJSON<Ride[]>(RIDES_KEY, []).map((r) => (r.id === target.rideId ? { ...r, status: 'paid' as const } : r));
      writeJSON(RIDES_KEY, rides);
      return { paymentId: `DEMO-${target.rideId}`, amountUsd: rides.find((r) => r.id === target.rideId)?.fareUsd ?? 0 };
    }
    if ('donationId' in target) {
      const { demoMarkDonationPaid } = await import('@/lib/giving');
      return { paymentId: `DEMO-${target.donationId}`, amountUsd: demoMarkDonationPaid(target.donationId) };
    }
    if ('passId' in target) {
      const { demoActivatePass } = await import('@/lib/stay');
      return demoActivatePass(target.passId);
    }
    const list = readJSON<Booking[]>(BOOKINGS_KEY, []).map((b) => (b.id === target.bookingId ? { ...b, status: 'paid' as const } : b));
    writeJSON(BOOKINGS_KEY, list);
    demoTicketReady(list.find((b) => b.id === target.bookingId));
    // Taxi rides booked with the activity are paid in the same checkout.
    writeJSON(RIDES_KEY, readJSON<Ride[]>(RIDES_KEY, []).map((r) => (r.bookingId === target.bookingId && r.status === 'awaiting_payment' ? { ...r, status: 'paid' as const } : r)));
    return { paymentId: `DEMO-${target.bookingId}`, amountUsd: list.find((b) => b.id === target.bookingId)?.totalUsd ?? 0 };
  }
  return invoke('create-payment', { ...target, returnPath, appReturnUrl: Platform.OS === 'web' ? undefined : Linking.createURL('paid') });
}

/** The server's view of a payment (set only by the processor's signed webhook). */
export async function paymentStatus(paymentId: string): Promise<'pending' | 'succeeded' | 'failed' | 'refunded' | null> {
  if (!supabase) return 'succeeded';
  const { data } = await supabase.from('payments').select('status').eq('id', paymentId).maybeSingle();
  return (data?.status as 'pending') ?? null;
}

// ---------- Live boats ----------

/** Calls onUpdate with every visible boat. Returns an unsubscribe function. */
export function subscribeBoats(onUpdate: (boats: LiveBoat[]) => void): () => void {
  if (!supabase) {
    onUpdate(demoBoats());
    const timer = setInterval(() => onUpdate(demoBoats()), 1000);
    return () => clearInterval(timer);
  }
  const client = supabase;
  let alive = true;
  const load = async () => {
    const { data } = await client.from('live_boats').select('id, name, kind, seats, available, lon, lat');
    if (alive) onUpdate((data ?? []) as LiveBoat[]);
  };
  void load();
  // Re-read on any position change, at most once a second.
  let pending = false;
  const channel = client
    .channel('boat-positions')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'boat_positions' }, () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        void load();
      }, 1000);
    })
    .subscribe();
  // Stale boats drop off the view after 2 minutes even without new events.
  const timer = setInterval(load, 30000);
  return () => {
    alive = false;
    clearInterval(timer);
    void client.removeChannel(channel);
  };
}

// ---------- Captain ----------

export async function myBoat(): Promise<{ id: string; name: string; seats: number } | null> {
  if (!supabase) return { id: 'demo-boat', name: 'Demo boat', seats: 8 };
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;
  const { data } = await supabase.from('boats').select('id, name, seats').eq('captain_id', user.user.id).eq('active', true).limit(1).maybeSingle();
  return data ?? null;
}

export async function setOnline(boatId: string, online: boolean, pos?: { lon: number; lat: number }): Promise<void> {
  if (!supabase) return;
  const row: Row = { boat_id: boatId, online, updated_at: new Date().toISOString() };
  if (pos) Object.assign(row, pos);
  const { error } = pos
    ? await supabase.from('boat_positions').upsert(row)
    : await supabase.from('boat_positions').update({ online }).eq('boat_id', boatId);
  if (error) throw error;
}

export async function openRides(): Promise<Ride[]> {
  if (!supabase) return readJSON<Ride[]>(RIDES_KEY, []).filter((r) => ['paid', 'accepted', 'onboard'].includes(r.status)).reverse();
  const { data, error } = await supabase
    .from('rides')
    .select('*')
    .in('status', ['paid', 'accepted', 'onboard'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toRide);
}

function demoUpdateRide(id: string, patch: Partial<Ride>) {
  writeJSON(RIDES_KEY, readJSON<Ride[]>(RIDES_KEY, []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export async function acceptRide(id: string): Promise<void> {
  if (!supabase) {
    // Same rule as the server: accepting within the confirm window counts as confirming.
    const r = readJSON<Ride[]>(RIDES_KEY, []).find((x) => x.id === id);
    const soon = !r?.pickupAt || Date.parse(r.pickupAt) - Date.now() <= 15 * 60_000;
    return demoUpdateRide(id, { status: 'accepted', captainConfirmed: soon });
  }
  const { error } = await supabase.rpc('accept_ride', { p_ride_id: id });
  if (error) throw new Error(error.message);
}

/** Guaranteed pickup: the captain taps "On my way" before the confirm deadline. */
export async function confirmRide(id: string): Promise<void> {
  if (!supabase) return demoUpdateRide(id, { captainConfirmed: true });
  const { error } = await supabase.rpc('confirm_ride', { p_ride_id: id });
  if (error) throw new Error(error.message);
}

export async function advanceRide(id: string, status: 'onboard' | 'completed'): Promise<void> {
  if (!supabase) return demoUpdateRide(id, { status });
  const { error } = await supabase.rpc('advance_ride', { p_ride_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

// ---------- AI assistant ----------

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function askAssistant(turns: ChatTurn[], language: string): Promise<string> {
  if (!supabase) throw new Error('assistant_offline');
  const { text } = await invoke<{ text: string }>('assistant', { turns, language });
  return text;
}

export const isDemo = DEMO_MODE;
