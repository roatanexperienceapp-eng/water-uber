// "5 min ago" in 7 languages, without Intl.RelativeTimeFormat (missing on iPhones' Hermes engine).
const AGO: Record<string, [now: string, min: string, hour: string, day: string]> = {
  en: ['just now', '{n} min ago', '{n} h ago', '{n} d ago'],
  es: ['ahora', 'hace {n} min', 'hace {n} h', 'hace {n} d'],
  fr: ["à l'instant", 'il y a {n} min', 'il y a {n} h', 'il y a {n} j'],
  de: ['gerade eben', 'vor {n} Min.', 'vor {n} Std.', 'vor {n} T.'],
  pt: ['agora', 'há {n} min', 'há {n} h', 'há {n} d'],
  it: ['ora', '{n} min fa', '{n} h fa', '{n} g fa'],
  zh: ['刚刚', '{n}分钟前', '{n}小时前', '{n}天前'],
};

export function ago(iso: string, lang: string, now = Date.now()): string {
  const w = AGO[lang] ?? AGO.en;
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return w[0];
  if (m < 60) return w[1].replace('{n}', String(m));
  if (m < 48 * 60) return w[2].replace('{n}', String(Math.round(m / 60)));
  return w[3].replace('{n}', String(Math.round(m / 1440)));
}
