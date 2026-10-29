import type { VehicleKind } from '../../supabase/functions/_shared/land.ts';
import { ensureSession } from '@/lib/session';
import { readJSON, writeJSON } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';
import type { RideStatus } from '@/types';

/** Driver side of the land taxi (crew app). */
export interface MyVehicle {
  id: string;
  name: string;
  kind: VehicleKind;
  seats: number;
  plate?: string;
  certified: boolean;
}

export interface DriverRide {
  id: string;
  pickupLabel: string;
  pickupLat: number;
  pickupLon: number;
  dropoffLabel: string;
  riders: number;
  vehicle: VehicleKind;
  scheduledFor?: string;
  createdAt: string;
  km: number;
  fareUsd: number;
  status: RideStatus;
  arrivedAt?: string;
  mine: boolean;
}

type Row = Record<string, unknown>;
const DEMO_KEY = 'demo.driverRides';

function demoRides(): DriverRide[] {
  const saved = readJSON<DriverRide[] | null>(DEMO_KEY, null);
  if (saved) return saved;
  const now = Date.now();
  const seed: DriverRide[] = [
    { id: 'dr-1', pickupLabel: 'Roatán Airport (RTB)', pickupLat: 16.3168, pickupLon: -86.523, dropoffLabel: 'West Bay Beach', riders: 2, vehicle: 'car', createdAt: new Date(now - 60_000).toISOString(), km: 11.2, fareUsd: 25, status: 'paid', mine: false },
    { id: 'dr-2', pickupLabel: 'Port of Roatán · Coxen Hole', pickupLat: 16.3141, pickupLon: -86.5466, dropoffLabel: 'West End · Half Moon Bay', riders: 4, vehicle: 'car', scheduledFor: new Date(now + 90 * 60_000).toISOString(), createdAt: new Date(now - 300_000).toISOString(), km: 7.1, fareUsd: 24, status: 'paid', mine: false },
  ];
  writeJSON(DEMO_KEY, seed);
  return seed;
}

export async function myVehicle(): Promise<MyVehicle | null> {
  if (!supabase) return { id: 'demo-car-1', name: 'Toyota Corolla', kind: 'car', seats: 4, plate: 'HBX 1234', certified: true };
  await ensureSession();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from('vehicles').select('id, name, kind, seats, plate, active, verified_at, license_expires').eq('driver_id', u.user.id).maybeSingle();
  if (!data || !data.active) return null;
  const today = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
  return {
    id: String(data.id), name: String(data.name), kind: data.kind as VehicleKind, seats: Number(data.seats), plate: (data.plate as string) ?? undefined,
    certified: !!data.verified_at && !!data.license_expires && String(data.license_expires) >= today,
  };
}

export async function setVehicleOnline(vehicleId: string, online: boolean, at?: { lat: number; lon: number }): Promise<void> {
  if (!supabase) return;
  const row: Row = { vehicle_id: vehicleId, online, updated_at: new Date().toISOString() };
  if (at) Object.assign(row, { lat: at.lat, lon: at.lon });
  const { error } = at
    ? await supabase.from('vehicle_positions').upsert(row)
    : await supabase.from('vehicle_positions').update(row).eq('vehicle_id', vehicleId);
  if (error) throw error;
}

/** Paid rides waiting for a driver, plus my own current ride. */
export async function driverRides(): Promise<DriverRide[]> {
  if (!supabase) return demoRides().filter((r) => !['completed', 'cancelled'].includes(r.status));
  const { data: u } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('land_rides')
    .select('*')
    .in('status', ['paid', 'accepted', 'onboard'])
    .order('created_at', { ascending: true })
    .limit(30);
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: String(r.id), pickupLabel: String(r.pickup_label), pickupLat: Number(r.pickup_lat), pickupLon: Number(r.pickup_lon),
    dropoffLabel: String(r.dropoff_label), riders: Number(r.riders), vehicle: r.vehicle_kind as VehicleKind,
    scheduledFor: (r.scheduled_for as string) ?? undefined, createdAt: String(r.created_at), km: Number(r.km), fareUsd: Number(r.fare_usd),
    status: r.status as RideStatus, arrivedAt: (r.arrived_at as string) ?? undefined, mine: r.driver_id === u.user?.id,
  }));
}

function demoUpdate(id: string, patch: Partial<DriverRide>) {
  writeJSON(DEMO_KEY, demoRides().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export async function acceptLandRide(id: string): Promise<void> {
  if (!supabase) return demoUpdate(id, { status: 'accepted', mine: true });
  const { error } = await supabase.rpc('accept_land_ride', { p_ride_id: id });
  if (error) throw new Error(error.message);
}

export async function arrivedLandRide(id: string): Promise<void> {
  if (!supabase) return demoUpdate(id, { arrivedAt: new Date().toISOString() });
  const { error } = await supabase.rpc('land_ride_arrived', { p_ride_id: id });
  if (error) throw new Error(error.message);
}

export async function advanceLandRide(id: string, status: 'onboard' | 'completed'): Promise<void> {
  if (!supabase) return demoUpdate(id, { status });
  const { error } = await supabase.rpc('advance_land_ride', { p_ride_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

export async function landRideGuest(id: string): Promise<{ name: string; whatsapp?: string } | null> {
  if (!supabase) return { name: 'Maria', whatsapp: '' };
  const { data } = await supabase.rpc('land_ride_guest', { p_ride_id: id });
  const r = (data as Row[] | null)?.[0];
  return r ? { name: String(r.guest_name ?? ''), whatsapp: (r.whatsapp as string) ?? undefined } : null;
}
