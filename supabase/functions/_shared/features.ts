// Rules for the 7 week-stay features. Pure TypeScript, shared by the app (to show quotes and suggestions)
// and by the server (which enforces them). Every business number lives in FEATURE_SETTINGS — change it here only.
import { DOCKS, FLAT_ZONE } from './geo.ts';
import { PRICING } from './pricing.ts';

export interface PassDef {
  id: PassId;
  days: number;
  rides: number | null;
  priceUsd: number;
  riders: number;
}

/** week2…week12 and twoWeek2…twoWeek12: price = per person per week × people × weeks. */
function buildPasses(perPersonPerWeek: number, min: number, max: number): PassDef[] {
  const out: PassDef[] = [];
  for (const days of [7, 14]) {
    for (let n = min; n <= max; n++) {
      out.push({ id: `${days === 7 ? 'week' : 'twoWeek'}${n}` as PassId, days, rides: null, priceUsd: perPersonPerWeek * n * (days / 7), riders: n });
    }
  }
  return out;
}

// =====================================================================================
// Owner settings (the "options to choose from"). Change values here; app and server both follow.
// =====================================================================================
export const FEATURE_SETTINGS = {
  guarantee: {
    /** Captain must confirm this many minutes before pickup, or the ride is reassigned. */
    confirmMinutesBefore: 15,
    /** Credit given to the guest if we miss a guaranteed pickup by more than lateGraceMinutes. */
    missedPickupCreditUsd: 10,
    lateGraceMinutes: 10,
  },
  night: {
    /** Minutes after sunset when night rules start (lit boats only, land-taxi fallback). */
    startsMinutesAfterSunset: 0,
    /** Last water taxi departure (24h clock, local time). After this only land taxis are offered. */
    lastBoatHour: 22,
    /** Extra per rider after dark, in USD. 0 keeps the day price. */
    surchargePerRider: 0,
  },
  shared: {
    /** A shared boat leaves when it has this many riders or when the wait timer ends. */
    seatsToDepart: 3,
    /** Longest a guest waits for a shared boat to fill, in minutes. */
    maxWaitMinutes: 15,
  },
  /**
   * Ride passes (owner prices, Oct 2026): $35 per person per week, any group from 2 to 12; two weeks = double.
   * Unlimited West End ↔ West Bay rides for the whole group. Only flat-zone rides are covered.
   */
  passPricing: { perPersonPerWeek: 35, minGroup: 2, maxGroup: 12 },
  passes: buildPasses(35, 2, 12),
  activity: {
    /** Arrive this many minutes before a tour, dive or dinner starts. */
    arriveEarlyMinutes: 15,
  },
} as const;

/** Current passes are week{n} / twoWeek{n}; the old fixed names stay valid for passes already sold. */
export type PassId = `${'week' | 'twoWeek'}${number}` | 'week' | 'twoWeek' | 'tenPack' | 'family';

// =====================================================================================
// 1. Guaranteed pickup
// =====================================================================================
export type GuaranteeState = 'scheduled' | 'awaiting_confirm' | 'confirmed' | 'reassign' | 'late' | 'missed';

/** What the system should do for a scheduled ride right now. */
export function guaranteeState(input: { pickupAt: Date; now: Date; captainConfirmed: boolean; boarded: boolean }): GuaranteeState {
  const g = FEATURE_SETTINGS.guarantee;
  const msToPickup = input.pickupAt.getTime() - input.now.getTime();
  const confirmBy = g.confirmMinutesBefore * 60_000;
  if (input.boarded) return 'confirmed';
  if (msToPickup > confirmBy) return input.captainConfirmed ? 'confirmed' : 'scheduled';
  if (msToPickup > 0) return input.captainConfirmed ? 'confirmed' : 'reassign';
  // Past the pickup time and nobody aboard yet.
  return -msToPickup > g.lateGraceMinutes * 60_000 ? 'missed' : 'late';
}

// =====================================================================================
// 2. Night rides
// =====================================================================================
/**
 * Approximate sunset in Roatán (local time, UTC-6, no DST) for a given month, in minutes after midnight.
 * Roatán sits at ~16.3°N, so sunset only moves between about 5:20 pm and 6:20 pm through the year.
 */
const SUNSET_BY_MONTH = [17 * 60 + 35, 17 * 60 + 50, 17 * 60 + 58, 18 * 60 + 3, 18 * 60 + 10, 18 * 60 + 18, 18 * 60 + 20, 18 * 60 + 10, 17 * 60 + 52, 17 * 60 + 32, 17 * 60 + 20, 17 * 60 + 22];

/** Minutes after local midnight in Roatán (UTC-6), independent of the phone's own time zone. */
export function roatanMinutes(d: Date): number {
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (utcMin - 6 * 60 + 24 * 60) % (24 * 60);
}
function roatanMonth(d: Date): number {
  return new Date(d.getTime() - 6 * 3600_000).getUTCMonth();
}

export function sunsetMinutes(d: Date): number {
  return SUNSET_BY_MONTH[roatanMonth(d)];
}

export type NightMode = 'day' | 'night' | 'boats_closed';

export function nightMode(d: Date): NightMode {
  const m = roatanMinutes(d);
  const sunrise = 5 * 60 + 30;
  const start = sunsetMinutes(d) + FEATURE_SETTINGS.night.startsMinutesAfterSunset;
  if (m >= FEATURE_SETTINGS.night.lastBoatHour * 60 || m < sunrise) return 'boats_closed';
  if (m >= start) return 'night';
  return 'day';
}

// =====================================================================================
// 3. Shared seats
// =====================================================================================
export interface OpenSharedBoat {
  id: string;
  from: string;
  to: string;
  departsAt: Date;
  seatsTaken: number;
  seatsTotal: number;
}

/** Shared boats the guest can join: same docks, leaving within the wait window, enough room. */
export function joinableBoats(boats: OpenSharedBoat[], req: { from: string; to: string; riders: number; now: Date }): OpenSharedBoat[] {
  const maxMs = FEATURE_SETTINGS.shared.maxWaitMinutes * 60_000;
  return boats
    .filter(
      (b) =>
        b.from === req.from &&
        b.to === req.to &&
        b.seatsTotal - b.seatsTaken >= req.riders &&
        b.departsAt.getTime() >= req.now.getTime() &&
        b.departsAt.getTime() - req.now.getTime() <= maxMs,
    )
    .sort((a, b) => a.departsAt.getTime() - b.departsAt.getTime());
}

/** When a newly opened shared boat should leave: when full, or at the end of the wait timer. */
export function sharedDeparture(openedAt: Date, seatsTaken: number): { departsAt: Date; leavesNow: boolean } {
  const leavesNow = seatsTaken >= FEATURE_SETTINGS.shared.seatsToDepart;
  return { departsAt: leavesNow ? openedAt : new Date(openedAt.getTime() + FEATURE_SETTINGS.shared.maxWaitMinutes * 60_000), leavesNow };
}

// =====================================================================================
// 4. Ride passes
// =====================================================================================
export interface ActivePass {
  passId: PassId;
  startsAt: Date;
  ridesUsed: number;
}

/** Lengths on sale, for the pass picker. Any group size from passPricing.minGroup to maxGroup. */
export const PASS_LENGTHS = [7, 14] as const;
export const PASS_GROUP_SIZES = Array.from(
  { length: FEATURE_SETTINGS.passPricing.maxGroup - FEATURE_SETTINGS.passPricing.minGroup + 1 },
  (_, i) => FEATURE_SETTINGS.passPricing.minGroup + i,
);

/** The pass for a group size and length (7 or 14 days). */
export function passFor(riders: number, days: number) {
  return FEATURE_SETTINGS.passes.find((p) => p.riders === riders && p.days === days);
}

/** The pass size for a group: clamped to what's on sale (1 person → the 2-person pass). */
export function passSizeFor(groupSize: number): number {
  const { minGroup, maxGroup } = FEATURE_SETTINGS.passPricing;
  return Math.min(maxGroup, Math.max(minGroup, Math.round(groupSize) || minGroup));
}

export function passDefinition(id: PassId) {
  const p = FEATURE_SETTINGS.passes.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown pass ${id}`);
  return p;
}

export function passExpiresAt(pass: ActivePass): Date {
  return new Date(pass.startsAt.getTime() + passDefinition(pass.passId).days * 86_400_000);
}

export function ridesLeft(pass: ActivePass): number | null {
  const def = passDefinition(pass.passId);
  return def.rides == null ? null : Math.max(0, def.rides - pass.ridesUsed);
}

export interface PassCover {
  covered: boolean;
  reason?: 'no_pass' | 'expired' | 'used_up' | 'outside_zone';
  /** Riders beyond the pass's rider count. They pay the flat per-rider fare. */
  extraRiders: number;
  /** What the guest still pays when the pass applies. */
  fareUsd: number;
}

/**
 * Whether a pass pays for this ride. Passes cover flat-zone rides only. The pass pays for up to its own
 * rider count; anyone extra (a friend tagging along) pays the flat fare per rider.
 */
export function passCovers(pass: ActivePass | null | undefined, ride: { from: string; to: string; riders: number; at: Date }): PassCover {
  const no = (reason: PassCover['reason']): PassCover => ({ covered: false, reason, extraRiders: 0, fareUsd: 0 });
  if (!pass) return no('no_pass');
  if (ride.at.getTime() > passExpiresAt(pass).getTime() || ride.at.getTime() < pass.startsAt.getTime()) return no('expired');
  const left = ridesLeft(pass);
  if (left !== null && left <= 0) return no('used_up');
  if (!(FLAT_ZONE.includes(ride.from) && FLAT_ZONE.includes(ride.to))) return no('outside_zone');
  const extraRiders = Math.max(0, ride.riders - passDefinition(pass.passId).riders);
  return { covered: true, extraRiders, fareUsd: extraRiders * PRICING.flatPerRider };
}

/** Value per ride vs paying the flat fare each way, to show the guest whether a pass is worth it. */
export function passBreakEvenRides(id: PassId, farePerRide: number = PRICING.flatPerRider): number {
  const def = passDefinition(id);
  return Math.ceil(def.priceUsd / (farePerRide * def.riders));
}

// =====================================================================================
// 5. Repeat rides and saved places
// =====================================================================================
export interface RepeatRule {
  /** Local Roatán time, "HH:MM". */
  time: string;
  /** 0 = Sunday … 6 = Saturday. Empty = every day. */
  weekdays: number[];
  /** Inclusive local dates "YYYY-MM-DD". */
  startDate: string;
  endDate: string;
}

/** The next `count` pickups for a repeat rule, as real Date instants (Roatán is UTC-6 year round). */
export function nextOccurrences(rule: RepeatRule, after: Date, count: number): Date[] {
  const [hh, mm] = rule.time.split(':').map(Number);
  const out: Date[] = [];
  const [y, mo, d] = rule.startDate.split('-').map(Number);
  const end = Date.parse(`${rule.endDate}T23:59:59-06:00`);
  for (let i = 0; out.length < count && i < 400; i++) {
    const at = new Date(Date.UTC(y, mo - 1, d + i, hh + 6, mm));
    if (at.getTime() > end) break;
    const weekday = new Date(at.getTime() - 6 * 3600_000).getUTCDay();
    if (rule.weekdays.length && !rule.weekdays.includes(weekday)) continue;
    if (at.getTime() > after.getTime()) out.push(at);
  }
  return out;
}

// =====================================================================================
// 6. Sea conditions
// =====================================================================================
export type SeaState = 'calm' | 'choppy' | 'rough';
export type SeaArea = 'west' | 'north' | 'south';

export interface SeaReport {
  area: SeaArea;
  state: SeaState;
  reportedAt: Date;
}

/** Which stretch of coast a dock's route mostly runs along. */
export const DOCK_AREA: Record<string, SeaArea> = Object.fromEntries(DOCKS.map((d) => [d.id, d.sea]));

const REPORT_TTL_MS = 3 * 3600_000;

/** Worst current condition along a route, ignoring reports older than 3 hours. */
export function routeCondition(reports: SeaReport[], from: string, to: string, now: Date): { state: SeaState | 'unknown'; areas: SeaArea[] } {
  const areas = [...new Set([DOCK_AREA[from], DOCK_AREA[to]].filter(Boolean))] as SeaArea[];
  // Trips between different coasts pass the island's west tip, so include the west.
  if (areas.length > 1 && !areas.includes('west')) areas.push('west');
  const rank = { calm: 0, choppy: 1, rough: 2 } as const;
  let worst: SeaState | 'unknown' = 'unknown';
  for (const a of areas) {
    const latest = reports
      .filter((r) => r.area === a && now.getTime() - r.reportedAt.getTime() <= REPORT_TTL_MS)
      .sort((x, y) => y.reportedAt.getTime() - x.reportedAt.getTime())[0];
    if (!latest) continue;
    if (worst === 'unknown' || rank[latest.state] > rank[worst]) worst = latest.state;
  }
  return { state: worst, areas };
}

/** Advice key for the app: choppy suggests a calmer option, rough stops boats on that route. */
export function conditionAdvice(state: SeaState | 'unknown'): 'none' | 'expect_spray' | 'land_taxi' {
  if (state === 'rough') return 'land_taxi';
  if (state === 'choppy') return 'expect_spray';
  return 'none';
}

// =====================================================================================
// 7. Boats booked with an activity
// =====================================================================================
/** Pickup time so the guest arrives `arriveEarlyMinutes` before the activity, given the ride length. */
export function pickupForActivity(activityStart: Date, rideMinutes: number): Date {
  return new Date(activityStart.getTime() - (rideMinutes + FEATURE_SETTINGS.activity.arriveEarlyMinutes) * 60_000);
}

/** Typical length of an activity, used to suggest the ride back. */
export const ACTIVITY_HOURS: Record<string, number> = {
  fish: 4, snork: 2.5, nsnork: 1.5, horse: 2, jetcar: 0.5, dive: 3.5, jet: 1, para: 1, land: 4, zip: 3, park: 2.5, food: 2, hotel: 0, car: 0, merch: 1, rx: 0, med: 0,
};

/** Where the guest needs to get to for an activity, by the listing's area. Null when no dock is near. */
export function dockForArea(area: string): string | null {
  const a = area.toLowerCase();
  if (a.includes('half moon')) return 'hmb';
  if (a.includes('west end')) return 'we';
  if (a.includes('west bay')) return 'inf';
  if (a.includes('sandy bay') || a.includes("anthony")) return 'sandyD';
  if (a.includes('coxen')) return 'coxenD';
  return null;
}
