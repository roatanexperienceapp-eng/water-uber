import { DOCKS, kmBetween, nodeCoords, routeFor, type LngLat } from '../../supabase/functions/_shared/geo.ts';
import type { BoatKind, LiveBoat } from '@/types';

/** Simulated boats for demo mode and design reviews. Real positions come from captains' phones. */
interface SimBoat {
  id: string;
  name: string;
  kind: BoatKind;
  seats: number;
  available: boolean;
  path: LngLat[];
  kmh: number;
  phase: number;
}

const legs = (from: string, to: string) => routeFor(from, to).path;
const off = (id: string) => nodeCoords(id);

const SIM: SimBoat[] = [
  { id: 'taxi-03', name: 'Water taxi 03', kind: 'taxi', seats: 8, available: true, path: legs('we', 'inf'), kmh: 24, phase: 0 },
  { id: 'taxi-07', name: 'Water taxi 07', kind: 'taxi', seats: 8, available: false, path: legs('hmb', 'ban'), kmh: 22, phase: 0.35 },
  { id: 'taxi-12', name: 'Water taxi 12', kind: 'taxi', seats: 6, available: true, path: legs('we', 'fos'), kmh: 26, phase: 0.6 },
  { id: 'family-02', name: 'Family boat 02', kind: 'taxi', seats: 12, available: true, path: legs('ban', 'we'), kmh: 20, phase: 0.8 },
  { id: 'snorkel-1', name: 'Snorkel boat · Blue Channel', kind: 'tour', seats: 10, available: false, path: [...legs('inf', 'we'), off('nwOff'), off('nwOff2'), off('blue')], kmh: 18, phase: 0.4 },
  { id: 'reef-tour', name: 'Sandy Bay reef tour', kind: 'tour', seats: 10, available: false, path: legs('we', 'sandyD'), kmh: 18, phase: 0.7 },
  { id: 'sport-1', name: 'Sportfisher · offshore', kind: 'fish', seats: 6, available: false, path: [...legs('we', 'we'), off('weOff'), off('fishW'), off('fishW2')], kmh: 30, phase: 0.25 },
  { id: 'shuttle', name: 'Island shuttle', kind: 'taxi', seats: 10, available: true, path: legs('fos', 'coxenD'), kmh: 28, phase: 0.9 },
];

const SPEEDUP = 10;
const PAUSE_S = 40;

function pathKm(p: LngLat[]) {
  let km = 0;
  for (let i = 1; i < p.length; i++) km += kmBetween(p[i - 1], p[i]);
  return km;
}

function positionAt(b: SimBoat, tSec: number): LngLat {
  const total = pathKm(b.path);
  if (b.path.length < 2 || total === 0) return b.path[0];
  const run = ((total / b.kmh) * 3600) / SPEEDUP;
  const cycle = 2 * run + 2 * PAUSE_S;
  const u = (((tSec / cycle) + b.phase) % 1) * cycle;
  let f: number;
  if (u < PAUSE_S) f = 0;
  else if (u < PAUSE_S + run) f = (u - PAUSE_S) / run;
  else if (u < 2 * PAUSE_S + run) f = 1;
  else f = 1 - (u - 2 * PAUSE_S - run) / run;
  let d = f * total;
  for (let i = 1; i < b.path.length; i++) {
    const seg = kmBetween(b.path[i - 1], b.path[i]);
    if (d <= seg || i === b.path.length - 1) {
      const r = seg === 0 ? 0 : Math.min(1, d / seg);
      const [ax, ay] = b.path[i - 1];
      const [bx, by] = b.path[i];
      return [ax + (bx - ax) * r, ay + (by - ay) * r];
    }
    d -= seg;
  }
  return b.path[b.path.length - 1];
}

export function demoBoats(now = Date.now()): LiveBoat[] {
  const t = now / 1000;
  return SIM.map((b) => {
    const [lon, lat] = positionAt(b, t);
    return { id: b.id, name: b.name, kind: b.kind, seats: b.seats, available: b.available, lon, lat };
  });
}

export { DOCKS };
