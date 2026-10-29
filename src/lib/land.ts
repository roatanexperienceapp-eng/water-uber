import { LAND_PLACES, quoteLand, type LandQuote, type LandTiming, type LiveVehicle, type Point, type VehicleKind } from '../../supabase/functions/_shared/land.ts';
import { ensureSession } from '@/lib/session';
import { readJSON, writeJSON } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';
import type { RideStatus } from '@/types';

/** A place the guest picks, or their own location. */
export interface Spot extends Point {
  label: string;
  placeId?: string;
}

export interface LandRide {
  id: string;
  pickup: Spot;
  dropoff: Spot;
  riders: number;
  vehicle: VehicleKind;
  timing: LandTiming;
  scheduledFor?: string;
  km: number;
  fareUsd: number;
  status: RideStatus;
  createdAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  pickedUpAt?: string;
  completedAt?: string;
}

export interface LandDriver {
  name: string;
  whatsapp?: string;
  vehicleName: string;
  vehicleKind: VehicleKind;
  plate?: string;
  color?: string;
  lat?: number;
  lon?: number;
  positionAt?: string;
}

type Row = Record<string, unknown>;

function toRide(r: Row): LandRide {
  return {
    id: String(r.id),
    pickup: { lat: Number(r.pickup_lat), lon: Number(r.pickup_lon), label: String(r.pickup_label) },
    dropoff: { lat: Number(r.dropoff_lat), lon: Number(r.dropoff_lon), label: String(r.dropoff_label) },
    riders: Number(r.riders),
    vehicle: r.vehicle_kind as VehicleKind,
    timing: r.timing as LandTiming,
    scheduledFor: (r.scheduled_for as string) ?? undefined,
    km: Number(r.km),
    fareUsd: Number(r.fare_usd),
    status: r.status as RideStatus,
    createdAt: String(r.created_at),
    acceptedAt: (r.accepted_at as string) ?? undefined,
    arrivedAt: (r.arrived_at as string) ?? undefined,
    pickedUpAt: (r.picked_up_at as string) ?? undefined,
    completedAt: (r.completed_at as string) ?? undefined,
  };
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  await ensureSession();
  const { data, error } = await supabase!.functions.invoke<T>(name, { body });
  if (error) {
    // Surface the server's error code (e.g. "off_island") so screens can translate it.
    const ctx = (error as { context?: Response }).context;
    const j = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error((j as { code?: string } | null)?.code ?? error.message);
  }
  return data as T;
}

// ---------------------------------------------------------------------------------------------
// Demo mode: cars drive around West End / West Bay / Coxen Hole, and a booked ride plays out by itself.

const DEMO_KEY = 'demo.landRides';
const DEMO_CARS: { id: string; kind: VehicleKind; seats: number; path: Point[] }[] = [
  { id: 'demo-car-1', kind: 'car', seats: 4, path: [{ lat: 16.3168, lon: -86.523 }, { lat: 16.3141, lon: -86.5466 }, { lat: 16.3103, lon: -86.5945 }] },
  { id: 'demo-car-2', kind: 'car', seats: 4, path: [{ lat: 16.2852, lon: -86.5955 }, { lat: 16.2935, lon: -86.5905 }, { lat: 16.3036, lon: -86.5952 }] },
  { id: 'demo-van-1', kind: 'van', seats: 12, path: [{ lat: 16.334, lon: -86.5649 }, { lat: 16.3141, lon: -86.5466 }, { lat: 16.3519, lon: -86.4932 }] },
  { id: 'demo-car-3', kind: 'car', seats: 4, path: [{ lat: 16.3545, lon: -86.4655 }, { lat: 16.3519, lon: -86.4932 }, { lat: 16.3168, lon: -86.523 }] },
];
const lerp = (a: Point, b: Point, t: number): Point => ({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
function along(path: Point[], t: number): Point {
  const x = (t % 1) * (path.length - 1) * 2;
  const leg = Math.floor(x) % ((path.length - 1) * 2);
  const back = leg >= path.length - 1;
  const i = back ? (path.length - 1) * 2 - leg : leg;
  const j = back ? i - 1 : i + 1;
  return lerp(path[i], path[j], x - Math.floor(x));
}

// Timeline of a demo ride after payment (seconds).
const DEMO_T = { accept: 6, arrive: 45, onboard: 60, complete: 150 };
type DemoRide = LandRide & { paidAt?: string };
const demoRides = () => readJSON<DemoRide[]>(DEMO_KEY, []);
function demoState(r: DemoRide): DemoRide {
  if (!r.paidAt || r.status === 'cancelled' || r.status === 'awaiting_payment') return r;
  const s = (Date.now() - Date.parse(r.paidAt)) / 1000;
  const at = (sec: number) => new Date(Date.parse(r.paidAt!) + sec * 1000).toISOString();
  if (s < DEMO_T.accept) return { ...r, status: 'paid' };
  const out: DemoRide = { ...r, status: 'accepted', acceptedAt: at(DEMO_T.accept) };
  if (s >= DEMO_T.arrive) out.arrivedAt = at(DEMO_T.arrive);
  if (s >= DEMO_T.onboard) Object.assign(out, { status: 'onboard', pickedUpAt: at(DEMO_T.onboard) });
  if (s >= DEMO_T.complete) Object.assign(out, { status: 'completed', completedAt: at(DEMO_T.complete) });
  return out;
}

export function demoPayLandRide(id: string): number {
  const list = demoRides().map((r) => (r.id === id ? { ...r, status: 'paid' as const, paidAt: new Date().toISOString() } : r));
  writeJSON(DEMO_KEY, list);
  return list.find((r) => r.id === id)?.fareUsd ?? 0;
}

function demoDriver(r: DemoRide): LandDriver | null {
  if (!r.paidAt || !['accepted', 'onboard', 'completed'].includes(r.status)) return null;
  const s = (Date.now() - Date.parse(r.paidAt)) / 1000;
  // Starts ~2 km away, drives to the pickup, then to the drop-off.
  const start = { lat: r.pickup.lat + 0.012, lon: r.pickup.lon + 0.012 };
  let pos: Point;
  if (s < DEMO_T.arrive) pos = lerp(start, r.pickup, Math.min(1, (s - DEMO_T.accept) / (DEMO_T.arrive - DEMO_T.accept)));
  else if (s < DEMO_T.onboard) pos = r.pickup;
  else pos = lerp(r.pickup, r.dropoff, Math.min(1, (s - DEMO_T.onboard) / (DEMO_T.complete - DEMO_T.onboard)));
  const live = r.status !== 'completed';
  return {
    name: 'Kevin', whatsapp: '', vehicleName: r.vehicle === 'van' ? 'Toyota Hiace' : 'Toyota Corolla', vehicleKind: r.vehicle,
    plate: r.vehicle === 'van' ? 'HBV 2207' : 'HBX 1234', color: 'White',
    lat: live ? pos.lat : undefined, lon: live ? pos.lon : undefined, positionAt: live ? new Date().toISOString() : undefined,
  };
}

// ---------------------------------------------------------------------------------------------

/** Free and busy cars near the island, refreshed every few seconds. Returns an unsubscribe function. */
export function subscribeVehicles(onUpdate: (v: LiveVehicle[]) => void): () => void {
  if (!supabase) {
    const tick = () => {
      const t = Date.now() / 240_000;
      onUpdate(DEMO_CARS.map((c, i) => ({ id: c.id, kind: c.kind, seats: c.seats, available: i !== 3, ...along(c.path, t + i * 0.27) })));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }
  const client = supabase;
  let alive = true;
  const load = async () => {
    const { data } = await client.rpc('live_vehicles');
    if (alive) onUpdate(((data as Row[] | null) ?? []).map((r) => ({ id: String(r.id), kind: r.kind as VehicleKind, seats: Number(r.seats), available: !!r.available, lat: Number(r.lat), lon: Number(r.lon) })));
  };
  void load();
  const id = setInterval(load, 8000);
  return () => {
    alive = false;
    clearInterval(id);
  };
}

export interface LandRequest {
  pickup: Spot;
  dropoff: Spot;
  riders: number;
  vehicle: VehicleKind;
  timing: LandTiming;
  scheduledFor?: string;
  note?: string;
}

const spotBody = (s: Spot) => (s.placeId ? { placeId: s.placeId } : { lat: s.lat, lon: s.lon, label: s.label });

export async function createLandRide(req: LandRequest): Promise<LandRide> {
  if (!supabase) {
    const q: LandQuote = quoteLand({ from: req.pickup, to: req.dropoff, riders: req.riders, vehicle: req.vehicle, timing: req.timing });
    const ride: DemoRide = {
      id: `land-${Math.random().toString(36).slice(2, 10)}`,
      pickup: req.pickup, dropoff: req.dropoff, riders: req.riders, vehicle: q.vehicle, timing: req.timing,
      scheduledFor: req.scheduledFor, km: q.km, fareUsd: q.totalUsd, status: 'awaiting_payment', createdAt: new Date().toISOString(),
    };
    writeJSON(DEMO_KEY, [ride, ...demoRides()]);
    return ride;
  }
  const { ride } = await invoke<{ ride: Row }>('create-land-ride', {
    pickup: spotBody(req.pickup), dropoff: spotBody(req.dropoff), riders: req.riders, vehicle: req.vehicle,
    timing: req.timing, scheduledFor: req.scheduledFor, note: req.note,
  });
  return toRide(ride);
}

export async function getLandRide(id: string): Promise<LandRide | null> {
  if (!supabase) {
    const r = demoRides().find((x) => x.id === id);
    return r ? demoState(r) : null;
  }
  const { data } = await supabase.from('land_rides').select('*').eq('id', id).maybeSingle();
  return data ? toRide(data as Row) : null;
}

export async function myLandRides(): Promise<LandRide[]> {
  if (!supabase) return demoRides().map(demoState);
  await ensureSession();
  const { data } = await supabase.from('land_rides').select('*').order('created_at', { ascending: false }).limit(30);
  return ((data as Row[] | null) ?? []).map(toRide);
}

export async function cancelLandRide(id: string): Promise<void> {
  if (!supabase) {
    writeJSON(DEMO_KEY, demoRides().map((r) => (r.id === id && ['awaiting_payment', 'paid', 'accepted'].includes(demoState(r).status) ? { ...r, status: 'cancelled' as const, paidAt: undefined } : r)));
    return;
  }
  const { error } = await supabase.rpc('cancel_land_ride', { p_ride_id: id });
  if (error) throw error;
}

export async function landRideDriver(id: string): Promise<LandDriver | null> {
  if (!supabase) {
    const r = demoRides().find((x) => x.id === id);
    return r ? demoDriver(demoState(r)) : null;
  }
  const { data } = await supabase.rpc('land_ride_driver', { p_ride_id: id });
  const r = (data as Row[] | null)?.[0];
  if (!r) return null;
  return {
    name: String(r.driver_name ?? ''), whatsapp: (r.whatsapp as string) ?? undefined, vehicleName: String(r.vehicle_name ?? ''),
    vehicleKind: r.vehicle_kind as VehicleKind, plate: (r.plate as string) ?? undefined, color: (r.color as string) ?? undefined,
    lat: r.lat == null ? undefined : Number(r.lat), lon: r.lon == null ? undefined : Number(r.lon), positionAt: (r.position_at as string) ?? undefined,
  };
}

export { LAND_PLACES };
