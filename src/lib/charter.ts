const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** True when the captain updated "what's biting" in the last 7 days, so the card never shows stale fishing news. */
export function bitingIsFresh(updated?: string, now = Date.now()): boolean {
  if (!updated) return false;
  const t = Date.parse(updated);
  return Number.isFinite(t) && now - t >= 0 && now - t <= WEEK_MS;
}
