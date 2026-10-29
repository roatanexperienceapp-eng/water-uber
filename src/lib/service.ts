import { useEffect, useState } from 'react';
import { readJSON, writeJSON } from '@/lib/localStore';

/** Which taxi the Ride tab shows: boats or cars. Remembered on the phone. */
export type Service = 'water' | 'land';

const KEY = 'ride.service';
const listeners = new Set<(s: Service) => void>();

export function getService(): Service {
  return readJSON<Service>(KEY, 'water') === 'land' ? 'land' : 'water';
}

export function setService(s: Service): void {
  writeJSON(KEY, s);
  listeners.forEach((l) => l(s));
}

export function useService(): [Service, (s: Service) => void] {
  const [s, set] = useState<Service>(getService);
  useEffect(() => {
    listeners.add(set);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return [s, setService];
}

/** A drop-off chosen elsewhere in the app (e.g. "Taxi here" on a gas station), picked up by the land taxi screen. */
const DROP_KEY = 'land.pendingDropoff';
export function setPendingDropoff(s: { lat: number; lon: number; label: string; placeId?: string }): void {
  writeJSON(DROP_KEY, s);
}
export function takePendingDropoff(): { lat: number; lon: number; label: string; placeId?: string } | null {
  const s = readJSON<{ lat: number; lon: number; label: string; placeId?: string } | null>(DROP_KEY, null);
  if (s) writeJSON(DROP_KEY, null);
  return s;
}
