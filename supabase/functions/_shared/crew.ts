// The owner's captains. Seeds the database (scripts/generate-seed.mjs) and the app's demo mode.
// Edit the list here, then run: node scripts/generate-seed.mjs
//
// "Certified" in the live app is NOT taken from this file: the database only shows the badge once the
// office has entered the captain's licence number + expiry and marked it verified (table public.crew).
export type CrewRole = 'taxi' | 'fishing' | 'snorkel';

export interface CrewMember {
  id: string;
  name: string;
  roles: CrewRole[];
}

export const CREW: CrewMember[] = [
 { "id": "fletcher", "name": "Captain Fletcher", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "jordan", "name": "Captain Jordan", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "patrick", "name": "Captain Patrick", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "big-john", "name": "Captain Big John", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "gordo", "name": "Gordo", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "david", "name": "David", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "justin", "name": "Justin", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "quinn", "name": "Captain Quinn", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "darcy", "name": "Captain Darcy", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "carter", "name": "Captain Carter", "roles": ["taxi", "fishing", "snorkel"] }
];

/** Stable pick for demo mode (same ride → same captain). */
export function crewFor(key: string, role: CrewRole = 'taxi'): CrewMember {
  const pool = CREW.filter((c) => c.roles.includes(role));
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}
