import type Ionicons from '@expo/vector-icons/Ionicons';
import { localeFor } from '@/i18n';
import type { SavedPlace } from '@/lib/stay';

/** Small display helpers shared by the week-stay screens. */
export const PLACE_ICONS: Record<SavedPlace['icon'], keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  dive: 'water',
  food: 'restaurant',
  star: 'star',
};

export const SEA_COLOR = { calm: '#22C55E', choppy: '#F59E0B', rough: '#D92D20', unknown: '#9CA3AF' } as const;

/** Monday first, the way most guests read a week. 0 = Sunday. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/** "10 PM" / "22:00" for an hour of the day, in the guest's language. */
export function hourLabel(hour: number, lang: string): string {
  return new Date(Date.UTC(2026, 0, 1, hour)).toLocaleTimeString(localeFor(lang), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

export function shortDate(d: Date, lang: string): string {
  return d.toLocaleDateString(localeFor(lang), { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Local YYYY-MM-DD for a Date. */
export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function hhmm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
