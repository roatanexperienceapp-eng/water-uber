// Rules for cruise-ship visitors. Pure TypeScript shared by the app (badges, time pickers) and the server
// (which refuses bookings that would make a guest miss the ship). Business numbers live in CRUISE_SETTINGS.
import { ACTIVITY_HOURS } from './features.ts';

export const CRUISE_SETTINGS = {
  /** Guests must be back at the port gate this many minutes before all-aboard. */
  backAtPortMinutesBefore: 60,
  /** Time from the ship docking until guests are off the ship and at the gate. */
  disembarkMinutes: 30,
  /** Assumed passengers when a ship's count is unknown. */
  defaultPassengers: 3500,
  /** Crowd thresholds: total cruise passengers ashore. */
  crowd: { busy: 4000, veryBusy: 8000, packed: 12000 },
  /** Splitting a booking: the group has until this long before the activity to pay every share. */
  splitPayBeforeMinutes: 60,
  splitMaxHours: 24,
  splitMaxShares: 12,
} as const;

export type PortId = 'mahogany' | 'coxen';

export interface Port {
  id: PortId;
  name: string;
  /** Where our guests meet their guide when the operator picks up at the port. */
  meetText: string;
  lat: number;
  lon: number;
}

export const PORTS: Record<PortId, Port> = {
  mahogany: {
    id: 'mahogany',
    name: 'Mahogany Bay (Isla Tropicale)',
    meetText: 'Walk out of the port gate to the tour and taxi area. Your guide holds an orange Roatán Water Taxi sign.',
    lat: 16.3519,
    lon: -86.4932,
  },
  coxen: {
    id: 'coxen',
    name: 'Port of Roatán · Coxen Hole',
    meetText: 'Exit the Town Center gate to the tour pickup lot. Your guide holds an orange Roatán Water Taxi sign.',
    lat: 16.3141,
    lon: -86.5466,
  },
};

/**
 * Road minutes from each port gate to an area, one way, normal traffic. OWNER: adjust from experience.
 * Unknown areas return null, and the app says "ask the operator" instead of guessing.
 */
const TRANSFER_MINUTES: Record<PortId, Record<string, number>> = {
  coxen: { 'coxen hole': 5, 'west end': 25, 'half moon': 25, 'west bay': 30, 'sandy bay': 15, 'french harbour': 20, 'french harbor': 20, 'mahogany': 20, 'punta gorda': 45, 'oak ridge': 45, 'camp bay': 60 },
  mahogany: { 'coxen hole': 20, 'west end': 40, 'half moon': 40, 'west bay': 45, 'sandy bay': 30, 'french harbour': 10, 'french harbor': 10, 'mahogany': 5, 'punta gorda': 30, 'oak ridge': 30, 'camp bay': 45 },
};

export function transferMinutes(port: PortId, area: string): number | null {
  const a = area.toLowerCase();
  for (const [key, min] of Object.entries(TRANSFER_MINUTES[port])) if (a.includes(key)) return min;
  return null;
}

export interface ShipCall {
  id: string;
  date: string; // YYYY-MM-DD, Roatán local
  ship: string;
  line?: string;
  port: PortId;
  arriveAt: Date;
  allAboardAt: Date;
  passengers?: number;
}

/** Activity length in minutes: the listing's own value if set, else the typical length for its portal. */
export function activityMinutes(portal: string, override?: number | null): number {
  if (override && override > 0) return override;
  return Math.round((ACTIVITY_HOURS[portal] ?? 2) * 60);
}

export type FitResult =
  | { fits: true; backAtPort: Date; mustReturnBy: Date; spareMinutes: number }
  | { fits: false; reason: 'too_early' | 'too_late' | 'unknown_area'; backAtPort?: Date; mustReturnBy: Date };

/** Whether an activity starting at `start` gets the guest back to the port in time for all-aboard. */
export function fitsPortTime(call: ShipCall, a: { area: string; portal: string; start: Date; durationMinutes?: number | null }): FitResult {
  const s = CRUISE_SETTINGS;
  const mustReturnBy = new Date(call.allAboardAt.getTime() - s.backAtPortMinutesBefore * 60_000);
  const transfer = transferMinutes(call.port, a.area);
  if (transfer === null) return { fits: false, reason: 'unknown_area', mustReturnBy };
  const earliestStart = call.arriveAt.getTime() + (s.disembarkMinutes + transfer) * 60_000;
  if (a.start.getTime() < earliestStart) return { fits: false, reason: 'too_early', mustReturnBy };
  const backAtPort = new Date(a.start.getTime() + (activityMinutes(a.portal, a.durationMinutes) + transfer) * 60_000);
  const spare = Math.floor((mustReturnBy.getTime() - backAtPort.getTime()) / 60_000);
  if (spare < 0) return { fits: false, reason: 'too_late', backAtPort, mustReturnBy };
  return { fits: true, backAtPort, mustReturnBy, spareMinutes: spare };
}

/** The window of start times that work for this ship: [earliest, latest], or null if nothing fits. */
export function startWindow(call: ShipCall, a: { area: string; portal: string; durationMinutes?: number | null }): { earliest: Date; latest: Date } | null {
  const s = CRUISE_SETTINGS;
  const transfer = transferMinutes(call.port, a.area);
  if (transfer === null) return null;
  const earliest = new Date(call.arriveAt.getTime() + (s.disembarkMinutes + transfer) * 60_000);
  const latest = new Date(call.allAboardAt.getTime() - (s.backAtPortMinutesBefore + transfer + activityMinutes(a.portal, a.durationMinutes)) * 60_000);
  return latest.getTime() >= earliest.getTime() ? { earliest, latest } : null;
}

export type CrowdLevel = 'quiet' | 'busy' | 'very_busy' | 'packed';

/** How crowded the island's beaches are on a date, from the ships in port. */
export function crowdFor(calls: ShipCall[], date: string): { level: CrowdLevel; ships: number; passengers: number } {
  const today = calls.filter((c) => c.date === date);
  const passengers = today.reduce((sum, c) => sum + (c.passengers ?? CRUISE_SETTINGS.defaultPassengers), 0);
  const t = CRUISE_SETTINGS.crowd;
  const level: CrowdLevel = passengers >= t.packed ? 'packed' : passengers >= t.veryBusy ? 'very_busy' : passengers >= t.busy ? 'busy' : 'quiet';
  return { level, ships: today.length, passengers };
}

/** Roatán local date (UTC-6, no DST) for an instant. */
export function roatanDate(d: Date): string {
  return new Date(d.getTime() - 6 * 3600_000).toISOString().slice(0, 10);
}

/** Instant for a Roatán local date + "HH:MM". */
export function roatanInstant(date: string, time: string): Date {
  return new Date(`${date}T${time.length === 4 ? '0' + time : time}:00-06:00`);
}

/** Deadline for a split booking: everyone must have paid by then. Null if it's too late to split. */
export function splitDeadline(now: Date, activityStart: Date): Date | null {
  const s = CRUISE_SETTINGS;
  const deadline = Math.min(now.getTime() + s.splitMaxHours * 3600_000, activityStart.getTime() - s.splitPayBeforeMinutes * 60_000);
  return deadline - now.getTime() >= 15 * 60_000 ? new Date(deadline) : null;
}
