import { localeFor } from '@/i18n';

export const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function clock(d: Date, lang: string) {
  return d.toLocaleTimeString(localeFor(lang), { hour: 'numeric', minute: '2-digit' });
}

/** Formats +50499734601 as +504 9973-4601. */
export function phone(p: string) {
  const m = p.match(/^\+504(\d{4})(\d{4})$/);
  return m ? `+504 ${m[1]}-${m[2]}` : p;
}
