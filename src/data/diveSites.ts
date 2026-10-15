// Dive sites shown on the map. Two positions come from published GPS (Hole in the Wall, El Aquario); El Aguila is
// corrected from a published position; the rest are estimated from descriptions. Verify with the Marine Park.
export type DiveKind = 'wall' | 'reef' | 'channel' | 'wreck';
export interface DiveSite { name: string; kind: DiveKind; lon: number; lat: number }

export const DIVE_SITES: DiveSite[] = [
 {
  "name": "West End Wall",
  "kind": "wall",
  "lon": -86.6045,
  "lat": 16.293
 },
 {
  "name": "Half Moon Bay Wall",
  "kind": "wall",
  "lon": -86.597,
  "lat": 16.3105
 },
 {
  "name": "Blue Channel",
  "kind": "channel",
  "lon": -86.6,
  "lat": 16.3075
 },
 {
  "name": "Hole in the Wall",
  "kind": "wall",
  "lon": -86.59185,
  "lat": 16.31373
 },
 {
  "name": "El Aquario",
  "kind": "reef",
  "lon": -86.59828,
  "lat": 16.30248
 },
 {
  "name": "Turtle Crossing",
  "kind": "reef",
  "lon": -86.603,
  "lat": 16.297
 },
 {
  "name": "Mandy's Eel Garden",
  "kind": "reef",
  "lon": -86.6045,
  "lat": 16.281
 },
 {
  "name": "Lighthouse",
  "kind": "reef",
  "lon": -86.588,
  "lat": 16.318
 },
 {
  "name": "Spooky Channel",
  "kind": "channel",
  "lon": -86.585,
  "lat": 16.322
 },
 {
  "name": "Four Sponges",
  "kind": "reef",
  "lon": -86.56949,
  "lat": 16.3332
 },
 {
  "name": "El Aguila wreck",
  "kind": "wreck",
  "lon": -86.5794,
  "lat": 16.32758
 },
 {
  "name": "Gibson Bight",
  "kind": "wall",
  "lon": -86.55748,
  "lat": 16.34084
 }
];
