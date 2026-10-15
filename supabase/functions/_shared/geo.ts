// Shared by the mobile app and Supabase edge functions. Pure TypeScript: no React Native or Deno imports.
// Coordinates are [longitude, latitude] (WGS84). Docks were snapped to an OpenStreetMap-derived coastline;
// confirm each one on the water before launch.

export type LngLat = [number, number];

export interface Dock {
  id: string;
  name: string;
  lon: number;
  lat: number;
}

export const DOCKS: Dock[] = [
  {
    "id": "hmb",
    "name": "Half Moon Bay",
    "lon": -86.59533,
    "lat": 16.30999
  },
  {
    "id": "we",
    "name": "West End dock (Splash Inn)",
    "lon": -86.59602,
    "lat": 16.3033
  },
  {
    "id": "inf",
    "name": "West Bay · Infinity Bay",
    "lon": -86.59788,
    "lat": 16.28445
  },
  {
    "id": "ban",
    "name": "West Bay · Bananarama",
    "lon": -86.59915,
    "lat": 16.27996
  },
  {
    "id": "fos",
    "name": "West Bay · south end",
    "lon": -86.60049,
    "lat": 16.27523
  },
  {
    "id": "sandyD",
    "name": "Sandy Bay · Anthony's Key",
    "lon": -86.56592,
    "lat": 16.334
  },
  {
    "id": "coxenD",
    "name": "Coxen Hole · town dock",
    "lon": -86.53721,
    "lat": 16.31439
  },
  {
    "id": "portD",
    "name": "Isla Tropicale cruise port",
    "lon": -86.50005,
    "lat": 16.32635
  }
];

/** Offshore waypoints that keep boat routes in the water around the West End point and the south tip. */
export const WAYPOINTS: Record<string, LngLat> = {
  "weOff": [
    -86.59808,
    16.30329
  ],
  "wbOff": [
    -86.59987,
    16.28498
  ],
  "blue": [
    -86.58729,
    16.31604
  ],
  "sandy": [
    -86.5713,
    16.3347
  ],
  "fishW": [
    -86.66,
    16.29
  ],
  "fishW2": [
    -86.68,
    16.32
  ],
  "fishN": [
    -86.6,
    16.37
  ],
  "fishN2": [
    -86.55,
    16.39
  ],
  "south": [
    -86.57522,
    16.27634
  ],
  "coxen": [
    -86.53642,
    16.30884
  ],
  "tip": [
    -86.60737,
    16.26876
  ],
  "nwOff": [
    -86.5975,
    16.3135
  ],
  "nwOff2": [
    -86.592,
    16.3205
  ],
  "sOff": [
    -86.597,
    16.262
  ],
  "sOff2": [
    -86.585,
    16.268
  ],
  "eastOff": [
    -86.51828,
    16.31175
  ],
  "portOff": [
    -86.502,
    16.316
  ]
};

/** Undirected sea-lane graph between docks and waypoints. Every edge was checked to stay off land. */
export const SEA_EDGES: [string, string][] = [["we", "weOff"], ["hmb", "weOff"], ["inf", "wbOff"], ["ban", "wbOff"], ["fos", "wbOff"], ["weOff", "wbOff"], ["weOff", "nwOff"], ["hmb", "nwOff"], ["nwOff", "nwOff2"], ["nwOff2", "blue"], ["blue", "sandy"], ["sandy", "sandyD"], ["fos", "tip"], ["ban", "tip"], ["tip", "sOff"], ["sOff", "sOff2"], ["sOff2", "south"], ["south", "coxen"], ["coxen", "coxenD"], ["coxen", "eastOff"], ["inf", "ban"], ["ban", "fos"], ["eastOff", "portOff"], ["portOff", "portD"]];

/** Docks inside the flat-fare zone (West End ↔ West Bay). */
export const FLAT_ZONE: readonly string[] = ["hmb", "we", "inf", "ban", "fos"];

export const KM_PER_MILE = 1.609344;

export function nodeCoords(id: string): LngLat {
  const dock = DOCKS.find((d) => d.id === id);
  if (dock) return [dock.lon, dock.lat];
  const wp = WAYPOINTS[id];
  if (!wp) throw new Error(`Unknown route node: ${id}`);
  return wp;
}

/** Equirectangular distance in km; accurate to well under 1% at Roatán's scale. */
export function kmBetween(a: LngLat, b: LngLat): number {
  const kx = 111.32 * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  const ky = 110.57;
  return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * ky);
}

export interface SeaRoute {
  nodes: string[];
  km: number;
  miles: number;
  path: LngLat[];
}

/** Shortest route by sea between two docks (Dijkstra over SEA_EDGES). */
export function routeFor(from: string, to: string): SeaRoute {
  if (from === to) {
    const c = nodeCoords(from);
    return { nodes: [from], km: 0, miles: 0, path: [c] };
  }
  const adj = new Map<string, [string, number][]>();
  for (const [a, b] of SEA_EDGES) {
    const w = kmBetween(nodeCoords(a), nodeCoords(b));
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push([b, w]);
    adj.get(b)!.push([a, w]);
  }
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  const queue: [number, string][] = [[0, from]];
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0]);
    const [d, u] = queue.shift()!;
    if (done.has(u)) continue;
    done.add(u);
    if (u === to) break;
    for (const [v, w] of adj.get(u) ?? []) {
      const nd = d + w;
      if (!dist.has(v) || nd < dist.get(v)!) {
        dist.set(v, nd);
        prev.set(v, u);
        queue.push([nd, v]);
      }
    }
  }
  if (!dist.has(to)) throw new Error(`No sea route from ${from} to ${to}`);
  const nodes = [to];
  while (nodes[0] !== from) nodes.unshift(prev.get(nodes[0])!);
  const km = dist.get(to)!;
  return { nodes, km, miles: km / KM_PER_MILE, path: nodes.map(nodeCoords) };
}
