// Shared by the mobile app and Supabase edge functions. Pure TypeScript: no React Native or Deno imports.
// Coordinates are [longitude, latitude] (WGS84). Docks were snapped to an OpenStreetMap-derived coastline.
// Docks marked approx: true were placed from the map by name: confirm each with a GPS reading on the pier before launch.

export type LngLat = [number, number];

export type DockArea = 'West End' | 'West Bay' | 'Sandy Bay' | 'Coxen Hole' | 'French Harbour' | 'East End';

export interface Dock {
  id: string;
  name: string;
  lon: number;
  lat: number;
  /** Neighbourhood, used to group the dock picker. */
  area: DockArea;
  /** Which stretch of sea the dock's routes run along (sea-condition reports). */
  sea: 'west' | 'north' | 'south';
  /** Placed from the coastline map, not yet confirmed with a GPS reading on the pier. Fares outside the flat zone depend on it. */
  approx: boolean;
}

export const DOCKS: Dock[] = [
  {
    "id": "lasRocas",
    "name": "Las Rocas pier",
    "lon": -86.59009,
    "lat": 16.3135,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "xbal",
    "name": "Xbalanque pier",
    "lon": -86.59026,
    "lat": 16.312,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "hmb",
    "name": "Half Moon Bay pier",
    "lon": -86.59533,
    "lat": 16.30999,
    "approx": false,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "coco",
    "name": "Coconut Tree pier",
    "lon": -86.5961,
    "lat": 16.3085,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "beachHouse",
    "name": "Beach House pier",
    "lon": -86.59609,
    "lat": 16.3075,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "woodys",
    "name": "Woody's pier",
    "lon": -86.59609,
    "lat": 16.3066,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "cafePalo",
    "name": "Café de Palo pier",
    "lon": -86.59608,
    "lat": 16.3058,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "harrys",
    "name": "Happy Harry's pier",
    "lon": -86.59608,
    "lat": 16.305,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "blueEl",
    "name": "Blue Elephant pier",
    "lon": -86.59607,
    "lat": 16.3042,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "we",
    "name": "Water taxi pier (Splash Inn)",
    "lon": -86.59602,
    "lat": 16.3033,
    "approx": false,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "ibagari",
    "name": "Ibagari pier",
    "lon": -86.59606,
    "lat": 16.3022,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "tesoro",
    "name": "Caribbean Tesoro pier",
    "lon": -86.59606,
    "lat": 16.3011,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "turtle",
    "name": "Turtle Beach pier",
    "lon": -86.59605,
    "lat": 16.3,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "luna",
    "name": "Luna Beach pier",
    "lon": -86.59604,
    "lat": 16.299,
    "approx": true,
    "area": "West End",
    "sea": "west"
  },
  {
    "id": "paradise",
    "name": "Paradise Beach",
    "lon": -86.59676,
    "lat": 16.2885,
    "approx": true,
    "area": "West Bay",
    "sea": "west"
  },
  {
    "id": "henry",
    "name": "Henry Morgan beach",
    "lon": -86.5973,
    "lat": 16.2866,
    "approx": true,
    "area": "West Bay",
    "sea": "west"
  },
  {
    "id": "inf",
    "name": "Infinity Bay pier",
    "lon": -86.59788,
    "lat": 16.28445,
    "approx": false,
    "area": "West Bay",
    "sea": "west"
  },
  {
    "id": "arg",
    "name": "Argentinian Grill beach",
    "lon": -86.59855,
    "lat": 16.2822,
    "approx": true,
    "area": "West Bay",
    "sea": "west"
  },
  {
    "id": "ban",
    "name": "Bananarama beach",
    "lon": -86.59915,
    "lat": 16.27996,
    "approx": false,
    "area": "West Bay",
    "sea": "west"
  },
  {
    "id": "beacher",
    "name": "Beacher",
    "lon": -86.59987,
    "lat": 16.2775,
    "approx": true,
    "area": "West Bay",
    "sea": "west"
  },
  {
    "id": "fos",
    "name": "Foster's pier",
    "lon": -86.60049,
    "lat": 16.27523,
    "approx": false,
    "area": "West Bay",
    "sea": "west"
  },
  {
    "id": "tranquil",
    "name": "Tranquil Seas pier",
    "lon": -86.578,
    "lat": 16.32438,
    "approx": true,
    "area": "Sandy Bay",
    "sea": "north"
  },
  {
    "id": "blueBahia",
    "name": "Blue Bahia pier",
    "lon": -86.5725,
    "lat": 16.32866,
    "approx": true,
    "area": "Sandy Bay",
    "sea": "north"
  },
  {
    "id": "sandyD",
    "name": "Anthony's Key pier",
    "lon": -86.56592,
    "lat": 16.334,
    "approx": false,
    "area": "Sandy Bay",
    "sea": "north"
  },
  {
    "id": "coxenD",
    "name": "Coxen Hole · town dock",
    "lon": -86.53721,
    "lat": 16.31439,
    "approx": false,
    "area": "Coxen Hole",
    "sea": "south"
  },
  {
    "id": "portD",
    "name": "Isla Tropicale cruise port",
    "lon": -86.50005,
    "lat": 16.32635,
    "approx": false,
    "area": "Coxen Hole",
    "sea": "south"
  },
  {
    "id": "pristine",
    "name": "Pristine Bay pier",
    "lon": -86.425,
    "lat": 16.35834,
    "approx": true,
    "area": "French Harbour",
    "sea": "south"
  },
  {
    "id": "palmetto",
    "name": "Palmetto Bay pier",
    "lon": -86.38,
    "lat": 16.41142,
    "approx": true,
    "area": "East End",
    "sea": "north"
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
  ],
  "nE1": [
    -86.53,
    16.3635
  ],
  "nE2": [
    -86.47,
    16.3859
  ],
  "nE3": [
    -86.41,
    16.4075
  ],
  "nE4": [
    -86.38,
    16.4227
  ],
  "sE1": [
    -86.47,
    16.3337
  ],
  "sE2": [
    -86.43,
    16.3499
  ],
  "sE0": [
    -86.49,
    16.3127
  ]
};

/** Undirected sea-lane graph between docks and waypoints. Every edge was checked to stay off land. */
export const SEA_EDGES: [string, string][] = [["we", "weOff"], ["hmb", "weOff"], ["inf", "wbOff"], ["ban", "wbOff"], ["fos", "wbOff"], ["weOff", "wbOff"], ["weOff", "nwOff"], ["hmb", "nwOff"], ["nwOff", "nwOff2"], ["nwOff2", "blue"], ["blue", "sandy"], ["sandy", "sandyD"], ["fos", "tip"], ["ban", "tip"], ["tip", "sOff"], ["sOff", "sOff2"], ["sOff2", "south"], ["south", "coxen"], ["coxen", "coxenD"], ["coxen", "eastOff"], ["inf", "ban"], ["ban", "fos"], ["eastOff", "portOff"], ["portOff", "portD"], ["lasRocas", "xbal"], ["hmb", "coco"], ["coco", "beachHouse"], ["beachHouse", "woodys"], ["woodys", "cafePalo"], ["cafePalo", "harrys"], ["harrys", "blueEl"], ["blueEl", "we"], ["we", "ibagari"], ["ibagari", "tesoro"], ["tesoro", "turtle"], ["turtle", "luna"], ["paradise", "henry"], ["henry", "inf"], ["inf", "arg"], ["arg", "ban"], ["ban", "beacher"], ["beacher", "fos"], ["luna", "weOff"], ["luna", "wbOff"], ["paradise", "wbOff"], ["lasRocas", "nwOff"], ["xbal", "nwOff"], ["tranquil", "blueBahia"], ["blueBahia", "sandy"], ["blueBahia", "sandyD"], ["sandy", "nE1"], ["nE1", "nE2"], ["nE2", "nE3"], ["nE3", "nE4"], ["nE4", "palmetto"], ["sE1", "sE2"], ["sE2", "pristine"], ["tranquil", "nwOff2"], ["tranquil", "sandy"], ["portOff", "sE0"], ["sE0", "sE1"]];

/** Docks inside the flat-fare zone (West End ↔ West Bay). */
export const FLAT_ZONE: readonly string[] = ["lasRocas", "xbal", "hmb", "coco", "beachHouse", "woodys", "cafePalo", "harrys", "blueEl", "we", "ibagari", "tesoro", "turtle", "luna", "paradise", "henry", "inf", "arg", "ban", "beacher", "fos"];

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
