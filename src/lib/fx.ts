import { useCallback, useEffect, useState } from 'react';
import { readJSON, writeJSON } from '@/lib/localStore';

/**
 * Lempira exchange rates, read from the internet and kept on the phone for when there's no signal.
 * Mid-market rates (what banks trade at), not what a shop or exchange counter on the island pays.
 * Primary source: ExchangeRate-API open access (free; their terms require the "Rates by" credit we show).
 * Backup: the open-source currency-api on jsDelivr. Both update about once a day.
 */
export const CURRENCIES = [
  { code: 'USD', flag: '🇺🇸', symbol: '$' },
  { code: 'CAD', flag: '🇨🇦', symbol: 'C$' },
  { code: 'EUR', flag: '🇪🇺', symbol: '€' },
  { code: 'GBP', flag: '🇬🇧', symbol: '£' },
  { code: 'MXN', flag: '🇲🇽', symbol: 'MX$' },
  { code: 'GTQ', flag: '🇬🇹', symbol: 'Q' },
  { code: 'AUD', flag: '🇦🇺', symbol: 'A$' },
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export interface FxRates {
  /** Lempiras for 1 unit of each currency. */
  hnlPer: Record<CurrencyCode, number>;
  /** When the source last published these rates (ISO). */
  publishedAt: string;
  /** When this phone fetched them (ISO). */
  fetchedAt: string;
  source: 'exchangerate-api' | 'currency-api';
}

const CACHE_KEY = 'fx.rates';
const PICK_KEY = 'fx.mine';
const REFRESH_MS = 6 * 3600_000;
const PRIMARY = 'https://open.er-api.com/v6/latest/USD';
const BACKUP = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

/**
 * Turns "units per 1 USD" into "lempiras per 1 unit". Returns null if anything looks wrong
 * (missing currency, or a lempira rate outside a sane range), so a bad feed never reaches guests.
 */
export function toHnlPer(perUsd: Record<string, number>): Record<CurrencyCode, number> | null {
  const hnl = perUsd.HNL;
  if (!(hnl > 10 && hnl < 100)) return null;
  const out = {} as Record<CurrencyCode, number>;
  for (const c of CURRENCIES) {
    const r = c.code === 'USD' ? 1 : perUsd[c.code];
    if (!(r > 0)) return null;
    out[c.code] = hnl / r;
  }
  return out;
}

async function getJSON(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`fx_http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRates(): Promise<FxRates> {
  const now = new Date().toISOString();
  try {
    const j = (await getJSON(PRIMARY)) as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
    const hnlPer = j.result === 'success' && j.rates ? toHnlPer(j.rates) : null;
    if (hnlPer) return { hnlPer, publishedAt: new Date((j.time_last_update_unix ?? 0) * 1000).toISOString(), fetchedAt: now, source: 'exchangerate-api' };
  } catch {
    // fall through to the backup
  }
  const j = (await getJSON(BACKUP)) as { date?: string; usd?: Record<string, number> };
  const upper = Object.fromEntries(Object.entries(j.usd ?? {}).map(([k, v]) => [k.toUpperCase(), v]));
  const hnlPer = toHnlPer(upper);
  if (!hnlPer) throw new Error('fx_bad_data');
  return { hnlPer, publishedAt: j.date ? `${j.date}T00:00:00Z` : now, fetchedAt: now, source: 'currency-api' };
}

const isStale = (r: FxRates | null) => !r || Date.now() - Date.parse(r.fetchedAt) > REFRESH_MS;

export function useFx(): { rates: FxRates | null; loading: boolean; failed: boolean; refresh: () => void } {
  const [rates, setRates] = useState<FxRates | null>(() => readJSON<FxRates | null>(CACHE_KEY, null));
  const [loading, setLoading] = useState(() => isStale(readJSON<FxRates | null>(CACHE_KEY, null)));
  const [failed, setFailed] = useState(false);
  // Only sets state once the network answers (never synchronously inside the effect).
  const load = useCallback(() => {
    fetchRates()
      .then((r) => {
        writeJSON(CACHE_KEY, r);
        setRates(r);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (isStale(readJSON<FxRates | null>(CACHE_KEY, null))) load();
  }, [load]);
  const refresh = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);
  return { rates, loading, failed, refresh };
}

export function myCurrency(): CurrencyCode {
  const c = readJSON<string>(PICK_KEY, 'USD');
  return (CURRENCIES.some((x) => x.code === c) ? c : 'USD') as CurrencyCode;
}
export function setMyCurrency(c: CurrencyCode): void {
  writeJSON(PICK_KEY, c);
}

/** "L 26.87" under 100, "L 2,687" above. Formatted by hand: no Intl, which iPhones only partly support. */
export function lempiras(n: number): string {
  return `L ${groupThousands(n.toFixed(n < 100 ? 2 : 0))}`;
}

export function money(n: number, symbol: string): string {
  return `${symbol}${groupThousands(n.toFixed(2))}`;
}

function groupThousands(s: string): string {
  const [int, dec] = s.split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? `.${dec}` : '');
}
