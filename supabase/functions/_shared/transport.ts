// Getting guests to their tour, ride or meeting point. Pure TypeScript shared by the app and the server.
//   - Cruise guests: our van from the port gate to the tour and back, timed to the ship.
//   - On the day: how far the guest is, how long each way takes, when to leave, and the best way.
// Business numbers live in VAN_SETTINGS / MOVE_SETTINGS. OWNER: adjust from experience.
import { DOCKS, FLAT_ZONE, kmBetween, type LngLat } from './geo.ts';
import { activityMinutes, CRUISE_SETTINGS, transferMinutes, type ShipCall } from './cruise.ts';
import { dockForArea } from './features.ts';
import { quoteFare } from './pricing.ts';

export const VAN_SETTINGS = {
  /** Cruise port → tour → cruise port, per person. */
  roundTripPerPerson: 25,
  seatsPerVan: 12,
  /** The van waits this long at the port gate for guests coming off the ship. OWNER: set by the owner. */
  waitMinutes: 45,
  /** Drop guests at the meeting point this long before the start. */
  arriveEarlyMinutes: 15,
} as const;

export const MOVE_SETTINGS = {
  walkKmh: 4.5,
  /** Paths are longer than a straight line. */
  walkFactor: 1.3,
  roadKmh: 30,
  roadFactor: 1.4,
  /** Time for the van to reach a guest who calls for it. */
  vanDispatchMinutes: 15,
  /** Suggest walking up to this far. */
  walkMaxKm: 1.5,
  /** Guests within this distance of a dock can walk to the water taxi. */
  dockWalkMaxKm: 0.6,
  /** Wait for a water taxi called "now". */
  taxiWaitMinutes: 8,
  /** Be at the meeting point this long before the start. */
  bufferMinutes: 15,
} as const;

export interface Point {
  lat: number;
  lon: number;
}

const ll = (p: Point): LngLat => [p.lon, p.lat];
export const distanceKm = (a: Point, b: Point) => kmBetween(ll(a), ll(b));

export function vansFor(people: number): number {
  return Math.max(1, Math.ceil(people / VAN_SETTINGS.seatsPerVan));
}

export function vanPriceUsd(people: number): number {
  return VAN_SETTINGS.roundTripPerPerson * Math.max(1, Math.floor(people));
}

/** Where guests meet for a listing: its meeting spot, else its own coordinates, else the dock for its area. */
export function meetingPoint(l: {
  meetingLat?: number | null;
  meetingLon?: number | null;
  lat?: number | null;
  lon?: number | null;
  area: string;
}): (Point & { dockId?: string }) | null {
  if (l.meetingLat != null && l.meetingLon != null) return { lat: l.meetingLat, lon: l.meetingLon };
  if (l.lat != null && l.lon != null) return { lat: l.lat, lon: l.lon };
  const dockId = dockForArea(l.area);
  const d = dockId ? DOCKS.find((x) => x.id === dockId) : undefined;
  return d ? { lat: d.lat, lon: d.lon, dockId: d.id } : null;
}

/** The van leaves the port gate at the end of its wait. */
export function vanLeavesAt(pickupAt: Date): Date {
  return new Date(pickupAt.getTime() + VAN_SETTINGS.waitMinutes * 60_000);
}

export interface VanPlan {
  /** Van is at the port gate from this time (waits VAN_SETTINGS.waitMinutes). */
  pickupAt: Date;
  /** Van leaves the port gate at the latest. */
  leavesAt: Date;
  /** Guests at the meeting point (worst case: van left at the end of its wait). */
  arriveAt: Date;
  /** Even leaving at the end of its wait, the van gets guests there before the start. False: pick a later time. */
  onTime: boolean;
  /** Van leaves the meeting point after the activity. */
  returnPickupAt: Date;
  /** Guests back at the port gate. */
  backAtPort: Date;
  transferMinutes: number;
  vans: number;
}

/** The van schedule for a cruise guest's activity, or null if we don't know the drive time to that area. */
export function vanPlan(call: ShipCall, a: { area: string; portal: string; start: Date; durationMinutes?: number | null; people: number }): VanPlan | null {
  const transfer = transferMinutes(call.port, a.area);
  if (transfer === null) return null;
  const offShip = call.arriveAt.getTime() + CRUISE_SETTINGS.disembarkMinutes * 60_000;
  // The van must be able to wait its full time and still drop guests early at the tour.
  const ideal = a.start.getTime() - (transfer + VAN_SETTINGS.arriveEarlyMinutes + VAN_SETTINGS.waitMinutes) * 60_000;
  const pickupAt = new Date(Math.max(offShip, ideal));
  const leavesAt = vanLeavesAt(pickupAt);
  const arriveAt = new Date(leavesAt.getTime() + transfer * 60_000);
  const onTime = arriveAt.getTime() <= a.start.getTime() - VAN_SETTINGS.arriveEarlyMinutes * 60_000;
  const returnPickupAt = new Date(a.start.getTime() + activityMinutes(a.portal, a.durationMinutes) * 60_000);
  const backAtPort = new Date(returnPickupAt.getTime() + transfer * 60_000);
  return { pickupAt, leavesAt, arriveAt, onTime, returnPickupAt, backAtPort, transferMinutes: transfer, vans: vansFor(a.people) };
}

export type MoveMode = 'walk' | 'taxi' | 'van';

export interface MoveOption {
  mode: MoveMode;
  minutes: number;
  /** Water taxi only: the dock to walk to, the fare for the group. */
  fromDock?: string;
  toDock?: string;
  fareUsd?: number;
}

export interface GettingThere {
  km: number;
  /** Already there (within 150 m). */
  arrived: boolean;
  options: MoveOption[];
  best: MoveOption | null;
}

export function nearestDock(p: Point, only?: readonly string[]): { id: string; km: number } | null {
  let best: { id: string; km: number } | null = null;
  for (const d of DOCKS) {
    if (only && !only.includes(d.id)) continue;
    const km = distanceKm(p, d);
    if (!best || km < best.km) best = { id: d.id, km };
  }
  return best;
}

const walkMinutes = (km: number) => Math.ceil(((km * MOVE_SETTINGS.walkFactor) / MOVE_SETTINGS.walkKmh) * 60);
const roadMinutes = (km: number) => Math.ceil(((km * MOVE_SETTINGS.roadFactor) / MOVE_SETTINGS.roadKmh) * 60);

/** Ways to get from where the guest is to the meeting point, fastest first. */
export function gettingThere(from: Point, to: Point & { dockId?: string }, riders: number): GettingThere {
  const km = distanceKm(from, to);
  if (km <= 0.15) return { km, arrived: true, options: [], best: null };
  const options: MoveOption[] = [];
  if (km <= MOVE_SETTINGS.walkMaxKm) options.push({ mode: 'walk', minutes: walkMinutes(km) });

  // Water taxi: only when the guest is near a dock and the meeting point is a dock.
  const startDock = nearestDock(from);
  if (to.dockId && startDock && startDock.km <= MOVE_SETTINGS.dockWalkMaxKm && startDock.id !== to.dockId) {
    try {
      const q = quoteFare({ from: startDock.id, to: to.dockId, riders: Math.max(1, riders), mode: 'private', timing: 'now' });
      options.push({
        mode: 'taxi',
        minutes: walkMinutes(startDock.km) + MOVE_SETTINGS.taxiWaitMinutes + q.rideMinutes,
        fromDock: startDock.id,
        toDock: to.dockId,
        fareUsd: q.total,
      });
    } catch {
      // no sea route between those docks
    }
  }

  // Our van: anywhere on the island by road.
  if (km > 0.8) options.push({ mode: 'van', minutes: MOVE_SETTINGS.vanDispatchMinutes + roadMinutes(km) });

  options.sort((a, b) => a.minutes - b.minutes);
  // A short walk beats waiting for a vehicle even if the vehicle is a little faster.
  const walk = options.find((o) => o.mode === 'walk');
  const best = walk && walk.minutes <= 15 ? walk : options[0] ?? null;
  return { km, arrived: false, options, best };
}

export type Timing = 'early' | 'leave_now' | 'late';

/** When to leave, and whether the guest is still on time. */
export function timingFor(now: Date, start: Date, minutes: number): { leaveBy: Date; status: Timing; minutesLate: number } {
  const leaveBy = new Date(start.getTime() - (minutes + MOVE_SETTINGS.bufferMinutes) * 60_000);
  const arrive = now.getTime() + minutes * 60_000;
  const minutesLate = Math.max(0, Math.ceil((arrive - start.getTime()) / 60_000));
  if (minutesLate > 0) return { leaveBy, status: 'late', minutesLate };
  if (now.getTime() >= leaveBy.getTime() - 5 * 60_000) return { leaveBy, status: 'leave_now', minutesLate: 0 };
  return { leaveBy, status: 'early', minutesLate: 0 };
}

/** Docks guests can take the $5 water taxi between (for suggestions). */
export const FLAT_DOCKS = FLAT_ZONE;
