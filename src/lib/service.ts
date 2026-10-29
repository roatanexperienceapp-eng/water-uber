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
