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

// pier-*: water taxi captains on the West End pier board, in board order (#2 Leticia ... #22 Leonel). Water taxi only.
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
 { "id": "carter", "name": "Captain Carter", "roles": ["taxi", "fishing", "snorkel"] },
 { "id": "pier-leticia", "name": "Captain Leticia", "roles": ["taxi"] },
 { "id": "pier-mariel", "name": "Captain Mariel", "roles": ["taxi"] },
 { "id": "pier-joel", "name": "Captain Joel", "roles": ["taxi"] },
 { "id": "pier-lando", "name": "Captain Lando", "roles": ["taxi"] },
 { "id": "pier-allan", "name": "Captain Allan", "roles": ["taxi"] },
 { "id": "pier-ariel", "name": "Captain Ariel", "roles": ["taxi"] },
 { "id": "pier-sompopo", "name": "Captain Sompopo", "roles": ["taxi"] },
 { "id": "pier-jose", "name": "Captain Jose", "roles": ["taxi"] },
 { "id": "pier-oscar", "name": "Captain Oscar", "roles": ["taxi"] },
 { "id": "pier-joelito", "name": "Captain Joelito", "roles": ["taxi"] },
 { "id": "pier-yanel", "name": "Captain Yanel", "roles": ["taxi"] },
 { "id": "pier-wilson", "name": "Captain Wilson", "roles": ["taxi"] },
 { "id": "pier-leonel", "name": "Captain Leonel", "roles": ["taxi"] }
];

/** Stable pick for demo mode (same ride → same captain). */
export function crewFor(key: string, role: CrewRole = 'taxi'): CrewMember {
  const pool = CREW.filter((c) => c.roles.includes(role));
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}
