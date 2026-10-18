import { FEATURE_SETTINGS } from '../../supabase/functions/_shared/features.ts';

/** "1-week pass · 4 people". Falls back to the old fixed names for passes sold before group pricing. */
export function passName(t: (k: string) => string, id: string): string {
  const def = FEATURE_SETTINGS.passes.find((p) => p.id === id);
  if (!def) return t(`pass_${id}`);
  return t('passNameFmt')
    .replace('{w}', def.days === 14 ? t('twoWeeks') : t('oneWeek'))
    .replace('{n}', String(def.riders));
}
