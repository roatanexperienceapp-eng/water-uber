import type { LiveBoat } from '@/types';
import type { DiveSite } from '@/data/diveSites';

export interface MapDock {
  id: string;
  name: string;
  lon: number;
  lat: number;
  selected: boolean;
}

export interface LiveMapProps {
  center: { latitude: number; longitude: number };
  /** Radius shown, in miles (7 for the island view, 2 for the West End ↔ West Bay view). */
  rangeMiles: number;
  boats: LiveBoat[];
  docks: MapDock[];
  route: [number, number][];
  diveSites: DiveSite[];
  satellite: boolean;
  onBoatPress: (boat: LiveBoat) => void;
  onDivePress: (site: DiveSite) => void;
  /** Land taxi: cars and vans on the road. */
  cars?: MapCar[];
  /** Land taxi: pickup and drop-off pins. */
  pins?: MapPin[];
}

export interface MapCar {
  id: string;
  kind: 'car' | 'van';
  available: boolean;
  lat: number;
  lon: number;
  /** The guest's own driver: drawn bigger. */
  mine?: boolean;
}

export interface MapPin {
  id: string;
  kind: 'pickup' | 'dropoff';
  lat: number;
  lon: number;
}
