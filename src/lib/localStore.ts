import 'expo-sqlite/localStorage/install';

/** Tiny JSON store on top of the persistent localStorage that expo-sqlite installs. Used in demo mode. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: demo data simply won't persist.
  }
}
