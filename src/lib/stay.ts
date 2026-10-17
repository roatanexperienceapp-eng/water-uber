import {
  FEATURE_SETTINGS, passDefinition, passExpiresAt, ridesLeft, sharedDeparture,
  type ActivePass, type OpenSharedBoat, type PassId, type SeaReport,
} from '../../supabase/functions/_shared/features.ts';
import { quoteFare } from '../../supabase/functions/_shared/pricing.ts';
import { supabase } from '@/lib/supabase';
import { readJSON, writeJSON } from '@/lib/localStore';

/**
 * Data access for the week-stay features: passes, shared seats, sea conditions, saved places,
 * repeat rides, ride sharing and pickup credits. Same rule as api.ts: demo mode stays on the phone,
 * live mode goes through Supabase and the server decides prices.
 */

const newId = () => Math.random().toString(36).slice(2, 10).toUpperCase();
type Row = Record<string, unknown>;

// =====================================================================================
// Ride passes
// =====================================================================================
export interface GuestPass extends ActivePass {
  id: string;
  status: 'awaiting_payment' | 'active' | 'cancelled';
  expiresAt: Date;
  ridesLeft: number | null;
}

const PASS_KEY = 'demo.passes';
type StoredPass = { id: string; passId: PassId; startsAt: string; ridesUsed: number; status: GuestPass['status'] };

function toGuestPass(p: StoredPass): GuestPass {
  const base: ActivePass = { passId: p.passId, startsAt: new Date(p.startsAt), ridesUsed: p.ridesUsed };
  return { ...base, id: p.id, status: p.status, expiresAt: passExpiresAt(base), ridesLeft: ridesLeft(base) };
}

export function demoActivePass(): ActivePass | null {
  const now = Date.now();
  const p = readJSON<StoredPass[]>(PASS_KEY, [])
    .map(toGuestPass)
    .find((x) => x.status === 'active' && x.expiresAt.getTime() > now && (x.ridesLeft === null || x.ridesLeft > 0));
  return p ?? null;
}

export function demoUsePassRide(): void {
  const active = demoActivePass() as GuestPass | null;
  if (!active) return;
  writeJSON(PASS_KEY, readJSON<StoredPass[]>(PASS_KEY, []).map((p) => (p.id === active.id ? { ...p, ridesUsed: p.ridesUsed + 1 } : p)));
}

export async function demoActivatePass(id: string): Promise<{ paymentId: string; amountUsd: number }> {
  const list = readJSON<StoredPass[]>(PASS_KEY, []);
  writeJSON(PASS_KEY, list.map((p) => (p.id === id ? { ...p, status: 'active' as const } : p)));
  const p = list.find((x) => x.id === id);
  return { paymentId: `DEMO-${id}`, amountUsd: p ? passDefinition(p.passId).priceUsd : 0 };
}

export async function myPasses(): Promise<GuestPass[]> {
  if (!supabase) return readJSON<StoredPass[]>(PASS_KEY, []).map(toGuestPass);
  const { data, error } = await supabase.from('guest_passes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Row) =>
    toGuestPass({ id: String(r.id), passId: r.pass_type as PassId, startsAt: String(r.starts_at), ridesUsed: Number(r.rides_used), status: r.status as GuestPass['status'] }),
  );
}

export async function currentPass(): Promise<GuestPass | null> {
  const now = Date.now();
  return (await myPasses()).find((p) => p.status === 'active' && p.expiresAt.getTime() > now && (p.ridesLeft === null || p.ridesLeft > 0)) ?? null;
}

/** Creates the pass awaiting payment. Pay it with startPayment({ passId }). */
export async function buyPass(passId: PassId): Promise<{ id: string; priceUsd: number }> {
  const def = passDefinition(passId);
  if (!supabase) {
    const id = newId();
    writeJSON(PASS_KEY, [{ id, passId, startsAt: new Date().toISOString(), ridesUsed: 0, status: 'awaiting_payment' }, ...readJSON<StoredPass[]>(PASS_KEY, [])]);
    return { id, priceUsd: def.priceUsd };
  }
  const { data, error } = await supabase.functions.invoke<{ pass: Row }>('create-pass', { body: { passType: passId } });
  if (error || !data) throw error ?? new Error('create-pass failed');
  return { id: String(data.pass.id), priceUsd: Number(data.pass.price_usd) };
}

// =====================================================================================
// Shared seats
// =====================================================================================
/** Shared boats filling up on this route right now. Demo mode simulates a steady stream. */
export async function openSharedBoats(from: string, to: string): Promise<OpenSharedBoat[]> {
  if (!supabase) {
    const now = Date.now();
    // A boat opens every 8 minutes per route in demo, with 1–2 seats already taken.
    const slot = Math.floor(now / (8 * 60_000));
    const seed = (slot + from.length * 7 + to.length * 3) % 5;
    if (seed === 0) return [];
    const departsAt = new Date((slot + 1) * 8 * 60_000 + seed * 60_000);
    return [{ id: `demo-${slot}-${from}-${to}`, from, to, departsAt, seatsTaken: 1 + (seed % 2), seatsTotal: 8 }];
  }
  const { data, error } = await supabase
    .from('shared_boats')
    .select('id, from_dock, to_dock, departs_at, seats_taken, seats_total')
    .eq('from_dock', from)
    .eq('to_dock', to)
    .eq('status', 'open')
    .gte('departs_at', new Date().toISOString())
    .order('departs_at');
  if (error) throw error;
  return (data ?? []).map((r: Row) => ({
    id: String(r.id), from: String(r.from_dock), to: String(r.to_dock), departsAt: new Date(String(r.departs_at)),
    seatsTaken: Number(r.seats_taken), seatsTotal: Number(r.seats_total),
  }));
}

/** When a new shared boat would leave if this guest opens one. */
export function newSharedBoatDeparture(riders: number): Date {
  return sharedDeparture(new Date(), riders).departsAt;
}

// =====================================================================================
// Sea conditions
// =====================================================================================
export async function seaReports(): Promise<SeaReport[]> {
  if (!supabase) {
    // Demo: calm on the west side; the north side gets choppy in the afternoon trade winds.
    const now = new Date();
    const roatanHour = (now.getUTCHours() - 6 + 24) % 24;
    return [
      { area: 'west', state: 'calm', reportedAt: new Date(now.getTime() - 20 * 60_000) },
      { area: 'north', state: roatanHour >= 12 && roatanHour < 18 ? 'choppy' : 'calm', reportedAt: new Date(now.getTime() - 45 * 60_000) },
      { area: 'south', state: 'calm', reportedAt: new Date(now.getTime() - 70 * 60_000) },
    ];
  }
  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data, error } = await supabase.from('sea_reports').select('area, state, reported_at').gte('reported_at', since).order('reported_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Row) => ({ area: r.area as SeaReport['area'], state: r.state as SeaReport['state'], reportedAt: new Date(String(r.reported_at)) }));
}

export async function reportSea(area: SeaReport['area'], state: SeaReport['state']): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('report_sea', { p_area: area, p_state: state });
  if (error) throw new Error(error.message);
}

// =====================================================================================
// Saved places
// =====================================================================================
export interface SavedPlace {
  id: string;
  label: string;
  dockId: string;
  icon: 'home' | 'dive' | 'food' | 'star';
}
const PLACES_KEY = 'demo.places';

export async function savedPlaces(): Promise<SavedPlace[]> {
  if (!supabase) return readJSON<SavedPlace[]>(PLACES_KEY, []);
  const { data, error } = await supabase.from('saved_places').select('id, label, dock_id, icon').order('created_at');
  if (error) throw error;
  return (data ?? []).map((r: Row) => ({ id: String(r.id), label: String(r.label), dockId: String(r.dock_id), icon: r.icon as SavedPlace['icon'] }));
}

export async function savePlace(p: Omit<SavedPlace, 'id'>): Promise<void> {
  if (!supabase) {
    const list = readJSON<SavedPlace[]>(PLACES_KEY, []).filter((x) => x.label !== p.label);
    writeJSON(PLACES_KEY, [...list, { ...p, id: newId() }]);
    return;
  }
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('saved_places').upsert({ guest_id: u.user?.id, label: p.label, dock_id: p.dockId, icon: p.icon }, { onConflict: 'guest_id,label' });
  if (error) throw error;
}

export async function deletePlace(id: string): Promise<void> {
  if (!supabase) {
    writeJSON(PLACES_KEY, readJSON<SavedPlace[]>(PLACES_KEY, []).filter((x) => x.id !== id));
    return;
  }
  const { error } = await supabase.from('saved_places').delete().eq('id', id);
  if (error) throw error;
}

// =====================================================================================
// Repeat rides
// =====================================================================================
export interface RepeatRide {
  id: string;
  from: string;
  to: string;
  riders: number;
  time: string;
  weekdays: number[];
  startDate: string;
  endDate: string;
  active: boolean;
  farePerRide: number;
  coveredByPass: boolean;
}
const REPEAT_KEY = 'demo.repeat';

export async function createRepeatRide(r: Omit<RepeatRide, 'id' | 'active' | 'farePerRide' | 'coveredByPass'>): Promise<RepeatRide> {
  if (!supabase) {
    const q = quoteFare({ from: r.from, to: r.to, riders: r.riders, mode: 'private', timing: 'scheduled' });
    const item: RepeatRide = { ...r, id: newId(), active: true, farePerRide: q.total, coveredByPass: !!demoActivePass() };
    writeJSON(REPEAT_KEY, [item, ...readJSON<RepeatRide[]>(REPEAT_KEY, [])]);
    return item;
  }
  const { data, error } = await supabase.functions.invoke<{ repeat: Row; farePerRide: number; coveredByPass: boolean }>('create-repeat-ride', {
    body: { from: r.from, to: r.to, riders: r.riders, time: r.time, weekdays: r.weekdays, startDate: r.startDate, endDate: r.endDate },
  });
  if (error || !data) throw error ?? new Error('create-repeat-ride failed');
  return { ...r, id: String(data.repeat.id), active: true, farePerRide: data.farePerRide, coveredByPass: data.coveredByPass };
}

export async function myRepeatRides(): Promise<RepeatRide[]> {
  if (!supabase) return readJSON<RepeatRide[]>(REPEAT_KEY, []);
  const { data, error } = await supabase.from('repeat_rides').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((x: Row) => ({
    id: String(x.id), from: String(x.from_dock), to: String(x.to_dock), riders: Number(x.riders), time: String(x.pickup_time),
    weekdays: (x.weekdays as number[]) ?? [], startDate: String(x.start_date), endDate: String(x.end_date), active: !!x.active,
    farePerRide: Number(x.fare_usd), coveredByPass: !!x.pass_id,
  }));
}

export async function setRepeatActive(id: string, active: boolean): Promise<void> {
  if (!supabase) {
    writeJSON(REPEAT_KEY, readJSON<RepeatRide[]>(REPEAT_KEY, []).map((x) => (x.id === id ? { ...x, active } : x)));
    return;
  }
  const { error } = await supabase.from('repeat_rides').update({ active }).eq('id', id);
  if (error) throw error;
}

// =====================================================================================
// Share my ride + pickup credits
// =====================================================================================
/** Link family can open without the app. Live mode: a secret token page; demo: placeholder. */
export async function shareRideLink(rideId: string): Promise<string> {
  if (!supabase) return `https://islandride.app/track/demo-${rideId}`;
  const { data, error } = await supabase.rpc('enable_ride_share', { p_ride_id: rideId });
  if (error) throw new Error(error.message);
  // TODO(launch): host a tiny tracking page at this address that calls shared_ride_status(token).
  return `https://islandride.app/track/${data}`;
}

export interface RideCredit {
  id: string;
  amountUsd: number;
  reason: string;
  createdAt: string;
  used: boolean;
}

export async function myCredits(): Promise<RideCredit[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('ride_credits').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Row) => ({ id: String(r.id), amountUsd: Number(r.amount_usd), reason: String(r.reason), createdAt: String(r.created_at), used: !!r.used_at }));
}

export { FEATURE_SETTINGS };
