import { useSyncExternalStore } from 'react';
import {
  crowdFor, CRUISE_SETTINGS, fitsPortTime, PORTS, roatanDate, roatanInstant, startWindow,
  type CrowdLevel, type PortId, type ShipCall,
} from '../../supabase/functions/_shared/cruise.ts';
import { localeFor } from '@/i18n';
import { readJSON, writeJSON } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';

export { crowdFor, CRUISE_SETTINGS, fitsPortTime, PORTS, roatanDate, roatanInstant, startWindow };
export type { CrowdLevel, PortId, ShipCall };

/** All cruise times are shown in island time, whatever clock the guest's phone or ship uses. */
export const ISLAND_TZ = 'America/Tegucigalpa';

export function islandClock(d: Date, lang: string): string {
  return d.toLocaleTimeString(localeFor(lang), { hour: 'numeric', minute: '2-digit', timeZone: ISLAND_TZ });
}

export function islandDay(d: Date, lang: string): string {
  return d.toLocaleDateString(localeFor(lang), { weekday: 'short', month: 'short', day: 'numeric', timeZone: ISLAND_TZ });
}

/** "3h 12m" until a moment; null once it has passed. */
export function countdown(to: Date, now = new Date()): { text: string; minutes: number } | null {
  const m = Math.floor((to.getTime() - now.getTime()) / 60_000);
  if (m < 0) return null;
  return { text: m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`, minutes: m };
}

// =====================================================================================
// Ship schedule
// =====================================================================================
type Row = Record<string, unknown>;
const toCall = (r: Row): ShipCall => ({
  id: String(r.id),
  date: String(r.call_date),
  ship: String(r.ship_name),
  line: (r.cruise_line as string) ?? undefined,
  port: r.port as PortId,
  arriveAt: new Date(String(r.arrive_at)),
  allAboardAt: new Date(String(r.all_aboard_at)),
  passengers: r.passengers == null ? undefined : Number(r.passengers),
});

/**
 * Demo schedule: a realistic weekly pattern (Mahogany Bay for Carnival, Coxen Hole for the others).
 * Names are generic on purpose. The live app reads the `ship_calls` table, which you fill from the port's
 * published schedule (docs/CRUISE.md).
 */
function demoCalls(from: string, days: number): ShipCall[] {
  const out: ShipCall[] = [];
  const start = roatanInstant(from, '12:00');
  for (let i = 0; i < days; i++) {
    const date = roatanDate(new Date(start.getTime() + i * 86_400_000));
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const add = (ship: string, line: string, port: PortId, arrive: string, aboard: string, passengers: number) =>
      out.push({ id: `demo-${date}-${out.length}`, date, ship, line, port, arriveAt: roatanInstant(date, arrive), allAboardAt: roatanInstant(date, aboard), passengers });
    if (dow !== 0) add('Carnival ship (demo)', 'Carnival', 'mahogany', '07:00', '16:30', 4000);
    if ([2, 3, 4].includes(dow)) add('Royal Caribbean ship (demo)', 'Royal Caribbean', 'coxen', '08:00', '17:00', 5500);
    if ([3, 5].includes(dow)) add('Norwegian ship (demo)', 'Norwegian', 'coxen', '11:00', '19:00', 3800);
  }
  return out;
}

export async function shipCalls(fromDate: string, days = 3): Promise<ShipCall[]> {
  if (!supabase) return demoCalls(fromDate, days);
  const to = roatanDate(new Date(roatanInstant(fromDate, '12:00').getTime() + (days - 1) * 86_400_000));
  const { data, error } = await supabase.from('ship_calls').select('*').gte('call_date', fromDate).lte('call_date', to).order('arrive_at');
  if (error) throw error;
  return (data ?? []).map(toCall);
}

export async function shipCall(id: string): Promise<ShipCall | null> {
  if (!supabase) {
    const date = id.split('-').slice(1, 4).join('-');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null; // bad or old QR link
    return demoCalls(date, 1).find((c) => c.id === id) ?? null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null; // not a ship call id: don't ask the database
  const { data } = await supabase.from('ship_calls').select('*').eq('id', id).maybeSingle();
  return data ? toCall(data) : null;
}

// =====================================================================================
// "My ship": the guest's chosen call, shared by every screen (like the language setting)
// =====================================================================================
const SHIP_KEY = 'cruise.myShip';
type Stored = Omit<ShipCall, 'arriveAt' | 'allAboardAt'> & { arriveAt: string; allAboardAt: string };
const listeners = new Set<() => void>();
let cached: ShipCall | null | undefined;

function load(): ShipCall | null {
  const s = readJSON<Stored | null>(SHIP_KEY, null);
  if (!s) return null;
  const call: ShipCall = { ...s, arriveAt: new Date(s.arriveAt), allAboardAt: new Date(s.allAboardAt) };
  // Forget the ship the day after it sails.
  return call.allAboardAt.getTime() + 6 * 3600_000 < Date.now() ? null : call;
}

export function getMyShip(): ShipCall | null {
  if (cached === undefined) cached = load();
  return cached;
}

export function setMyShip(call: ShipCall | null): void {
  cached = call;
  writeJSON(SHIP_KEY, call ? { ...call, arriveAt: call.arriveAt.toISOString(), allAboardAt: call.allAboardAt.toISOString() } : null);
  listeners.forEach((l) => l());
}

export function useMyShip(): ShipCall | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getMyShip,
    getMyShip,
  );
}

// =====================================================================================
// Listing fit for the badges
// =====================================================================================
export type ListingFit = 'fits' | 'no' | 'unknown';

/** Whether a listing can still be done today and get the guest back in time (from `now`, not from docking). */
export function listingFit(call: ShipCall | null, l: { area: string; portal: string; booking: string; durationMinutes?: number }, now = new Date()): ListingFit | null {
  if (!call || l.booking === 'info' || ['hotel', 'car', 'rx', 'med', 'merch'].includes(l.portal)) return null;
  const pseudo = fitsPortTime(call, { area: l.area, portal: l.portal, start: call.arriveAt, durationMinutes: l.durationMinutes });
  if (!pseudo.fits && pseudo.reason === 'unknown_area') return 'unknown';
  return cruiseStartTimes(call, l, now).length > 0 ? 'fits' : 'no';
}

/** Start times (every 30 min, island time "HH:MM") that bring the guest back in time. */
export function cruiseStartTimes(call: ShipCall, l: { area: string; portal: string; durationMinutes?: number }, now = new Date()): string[] {
  const w = startWindow(call, { area: l.area, portal: l.portal, durationMinutes: l.durationMinutes });
  if (!w) return [];
  const out: string[] = [];
  const first = Math.ceil(Math.max(w.earliest.getTime(), now.getTime() + 30 * 60_000) / (30 * 60_000)) * 30 * 60_000;
  for (let t = first; t <= w.latest.getTime(); t += 30 * 60_000) {
    const d = new Date(t - 6 * 3600_000);
    out.push(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`);
  }
  return out;
}
