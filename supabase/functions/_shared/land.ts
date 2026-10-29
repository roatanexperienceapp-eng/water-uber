// Land taxi: island places, fares and ETAs. Pure TypeScript shared by the app and the server.
// Fares are per vehicle (not per person), computed here on the server; the app only shows them.
// OWNER: every number in LAND_PRICING is yours to change.
import { DOCKS, kmBetween } from './geo.ts';
import { PORTS } from './cruise.ts';

export type VehicleKind = 'car' | 'van';
export type LandTiming = 'now' | 'scheduled';

export const LAND_PRICING = {
  car: { seats: 4, baseUsd: 8, perKmUsd: 1.5, minUsd: 10 },
  van: { seats: 12, baseUsd: 20, perKmUsd: 2.5, minUsd: 30 },
  /** Roads wind: road distance ≈ straight line × this. */
  roadFactor: 1.35,
  /** Average island driving speed, km/h. */
  speedKmh: 30,
  /** Booking ahead adds this per ride. */
  scheduledFeeUsd: 5,
  /** Longest ride we sell (km by road). */
  maxRoadKm: 70,
  maxDaysAhead: 30,
} as const;

export interface Point {
  lat: number;
  lon: number;
}

/** Roatán (and the bridge to Santa Helena); anything outside is refused. */
export const ISLAND_BOUNDS = { minLat: 16.24, maxLat: 16.52, minLon: -86.65, maxLon: -86.18 } as const;

export function onIsland(p: Point): boolean {
  return (
    Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
    p.lat >= ISLAND_BOUNDS.minLat && p.lat <= ISLAND_BOUNDS.maxLat &&
    p.lon >= ISLAND_BOUNDS.minLon && p.lon <= ISLAND_BOUNDS.maxLon
  );
}

export type PlaceKind = 'airport' | 'port' | 'beach' | 'town' | 'park' | 'health' | 'shop';

export interface LandPlace extends Point {
  id: string;
  name: string;
  area: string;
  kind: PlaceKind;
  /** Coordinates are approximate (good enough to quote; the driver confirms by WhatsApp). */
  approx?: boolean;
}

const dock = (id: string) => DOCKS.find((d) => d.id === id)!;

/** Where guests usually go. OWNER: add hotels, restaurants and your rentals here. */
export const LAND_PLACES: LandPlace[] = [
  { id: 'airport', name: 'Roatán Airport (RTB)', area: 'Coxen Hole', kind: 'airport', lat: 16.3168, lon: -86.523 },
  { id: 'portCoxen', name: PORTS.coxen.name, area: 'Coxen Hole', kind: 'port', lat: PORTS.coxen.lat, lon: PORTS.coxen.lon },
  { id: 'portMahogany', name: PORTS.mahogany.name, area: 'Mahogany Bay', kind: 'port', lat: PORTS.mahogany.lat, lon: PORTS.mahogany.lon },
  { id: 'westEnd', name: 'West End · Half Moon Bay', area: 'West End', kind: 'town', lat: dock('hmb').lat, lon: dock('hmb').lon + 0.0008 },
  { id: 'westEndDock', name: 'West End · water taxi dock', area: 'West End', kind: 'town', lat: dock('we').lat, lon: dock('we').lon + 0.0006 },
  { id: 'westBay', name: 'West Bay Beach', area: 'West Bay', kind: 'beach', lat: dock('inf').lat, lon: dock('inf').lon + 0.0012 },
  { id: 'westBayMall', name: 'West Bay Mall', area: 'West Bay', kind: 'shop', lat: 16.2866, lon: -86.5955, approx: true },
  { id: 'sandyBay', name: "Sandy Bay · Anthony's Key", area: 'Sandy Bay', kind: 'town', lat: dock('sandyD').lat, lon: dock('sandyD').lon + 0.001 },
  { id: 'gumbalimba', name: 'Gumbalimba Park', area: 'West Bay', kind: 'park', lat: 16.2935, lon: -86.5905, approx: true },
  { id: 'coxenTown', name: 'Coxen Hole town', area: 'Coxen Hole', kind: 'town', lat: dock('coxenD').lat, lon: dock('coxenD').lon },
  { id: 'frenchHarbour', name: 'French Harbour', area: 'French Harbour', kind: 'town', lat: 16.3545, lon: -86.4655, approx: true },
  { id: 'cemesa', name: 'Hospital Cemesa', area: 'French Harbour', kind: 'health', lat: 16.3536, lon: -86.4705, approx: true },
  { id: 'pristineBay', name: 'Pristine Bay', area: 'French Harbour', kind: 'beach', lat: dock('pristine').lat, lon: dock('pristine').lon },
  { id: 'puntaGorda', name: 'Punta Gorda', area: 'Punta Gorda', kind: 'town', lat: 16.4045, lon: -86.3905, approx: true },
  { id: 'oakRidge', name: 'Oak Ridge', area: 'Oak Ridge', kind: 'town', lat: 16.3915, lon: -86.3585, approx: true },
  { id: 'campBay', name: 'Camp Bay Beach', area: 'Camp Bay', kind: 'beach', lat: 16.4385, lon: -86.2915, approx: true },
];

export function placeById(id: string | null | undefined): LandPlace | undefined {
  return LAND_PLACES.find((p) => p.id === id);
}

export function vehicleFor(riders: number): VehicleKind | null {
  if (riders <= LAND_PRICING.car.seats) return 'car';
  if (riders <= LAND_PRICING.van.seats) return 'van';
  return null;
}

export interface LandQuote {
  vehicle: VehicleKind;
  /** Road distance, km (one decimal). */
  km: number;
  minutes: number;
  fareUsd: number;
  scheduledFeeUsd: number;
  totalUsd: number;
}

export class LandQuoteError extends Error {}

export function roadKm(a: Point, b: Point): number {
  return Math.round(kmBetween([a.lon, a.lat], [b.lon, b.lat]) * LAND_PRICING.roadFactor * 10) / 10;
}

export function driveMinutes(km: number): number {
  return Math.max(3, Math.ceil((km / LAND_PRICING.speedKmh) * 60));
}

/** Price for one vehicle. Throws LandQuoteError when the ride can't be sold. */
export function quoteLand(q: { from: Point; to: Point; riders: number; vehicle?: VehicleKind; timing: LandTiming }): LandQuote {
  if (!onIsland(q.from) || !onIsland(q.to)) throw new LandQuoteError('off_island');
  if (!Number.isInteger(q.riders) || q.riders < 1) throw new LandQuoteError('bad_riders');
  const need = vehicleFor(q.riders);
  if (!need) throw new LandQuoteError('too_many_riders');
  const vehicle = q.vehicle === 'van' || need === 'van' ? 'van' : 'car';
  const km = roadKm(q.from, q.to);
  if (km < 0.3) throw new LandQuoteError('too_close');
  if (km > LAND_PRICING.maxRoadKm) throw new LandQuoteError('too_far');
  const p = LAND_PRICING[vehicle];
  const fareUsd = Math.max(p.minUsd, Math.ceil(p.baseUsd + p.perKmUsd * km));
  const scheduledFeeUsd = q.timing === 'scheduled' ? LAND_PRICING.scheduledFeeUsd : 0;
  return { vehicle, km, minutes: driveMinutes(km), fareUsd, scheduledFeeUsd, totalUsd: fareUsd + scheduledFeeUsd };
}

export interface LiveVehicle extends Point {
  id: string;
  kind: VehicleKind;
  seats: number;
  available: boolean;
}

/** Minutes until the nearest free vehicle that fits the group can reach the pickup, or null. */
export function pickupEta(vehicles: LiveVehicle[], pickup: Point, vehicle: VehicleKind): number | null {
  let best: number | null = null;
  for (const v of vehicles) {
    if (!v.available) continue;
    if (vehicle === 'van' && v.kind !== 'van') continue;
    const m = driveMinutes(roadKm(v, pickup));
    if (best === null || m < best) best = m;
  }
  return best;
}
