export type IslandPlaceKind =
  | 'community' | 'airport' | 'port' | 'dive' | 'gas' | 'pharmacy' | 'health' | 'hotel' | 'restaurant'
  | 'beach' | 'park' | 'store' | 'shop' | 'bank' | 'town' | 'landmark';

export interface IslandPlace {
  id: string;
  name: string;
  kind: IslandPlaceKind;
  /** Nearest village or town (from OpenStreetMap). */
  community: string;
  lat: number;
  lon: number;
}
