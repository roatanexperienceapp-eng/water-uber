// Community rules shared by the app (demo mode, instant feedback) and documented for the database,
// which enforces the real thing (supabase/migrations/20261025000000_community.sql).

/** Same words as public.community_blocklist (seed). The database is the authority; this only gives instant feedback. */
export const BLOCKED_WORDS = ['fuck', 'fucking', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'puta', 'puto', 'pendejo', 'maricon', 'marica', 'verga', 'mierda', 'culero', 'hijueputa', 'cocaine', 'coca', 'escort'];

export function hasBlockedWord(text: string): boolean {
  const t = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t));
}

export const RESERVED_NAME = /(water ?uber|admin|moderator|official|staff|support team)/i;

export const REPORT_REASONS = ['spam', 'abuse', 'nudity', 'violence', 'scam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Suggested spots for sightings (guests can type their own). */
export const SIGHTING_SPOTS = ['Blue Channel', 'Spooky Channel', 'Half Moon Bay', 'West Bay reef', 'West End Wall', 'Hole in the Wall', 'El Aquario', 'Turtle Crossing', "Mandy's Eel Garden", 'El Aguila wreck', 'Gibson Bight', 'Sandy Bay'];

/** Common Roatán reef life, for quick tagging. */
export const COMMON_SPECIES = ['Hawksbill turtle', 'Green turtle', 'Spotted eagle ray', 'Southern stingray', 'Nurse shark', 'Green moray', 'Queen angelfish', 'Stoplight parrotfish', 'Blue tang', 'Lionfish', 'Octopus', 'Seahorse'];

export const LIMITS = { body: 1000, name: [2, 30] as const, videoSeconds: 30, videoBytes: 30 * 1024 * 1024 };
