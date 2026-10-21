// Reading a bank's "Zelle deposit" email. Pure functions so they can be tested.
//
// Trust rules (all must pass, otherwise the payment stays for a person to check):
//   1. Gmail verified the email really came from one of the bank domains we allow (DKIM pass).
//   2. The email contains exactly one of our codes (RWT-XXXXXXXX), i.e. the guest typed it in the memo.
//   3. The email contains exactly one dollar amount.
// The database then checks the code belongs to a pending Zelle payment and the amount is not short.

export interface ZelleDeposit {
  code: string;
  amountUsd: number;
}

export type ParseResult = { ok: true; deposit: ZelleDeposit } | { ok: false; reason: 'no_code' | 'many_codes' | 'no_amount' | 'many_amounts' };

const CODE_RE = /\bRWT[-\s]?([0-9A-F]{8})\b/gi;
// $1,010.00 · $95 · USD 95.00 · 95.00 USD
const AMOUNT_RES = [/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)(?![0-9])/g, /\bUSD\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)\b/gi, /\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\s?USD\b/gi];

export function parseZelleEmail(text: string): ParseResult {
  const body = String(text ?? '').slice(0, 20000);
  const codes = new Set<string>();
  for (const m of body.matchAll(CODE_RE)) codes.add(`RWT-${m[1].toUpperCase()}`);
  if (codes.size === 0) return { ok: false, reason: 'no_code' };
  if (codes.size > 1) return { ok: false, reason: 'many_codes' };

  const amounts = new Set<number>();
  for (const re of AMOUNT_RES) {
    for (const m of body.matchAll(re)) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) amounts.add(Math.round(n * 100));
    }
  }
  if (amounts.size === 0) return { ok: false, reason: 'no_amount' };
  if (amounts.size > 1) return { ok: false, reason: 'many_amounts' };

  return { ok: true, deposit: { code: [...codes][0], amountUsd: [...amounts][0] / 100 } };
}

/** True when one of the DKIM-verified sender domains is (or is a subdomain of) an allowed bank domain. */
export function senderAllowed(verifiedDomains: string[], allowed: string[]): boolean {
  const ok = allowed.map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (!ok.length) return false;
  return verifiedDomains.some((v) => {
    const d = String(v).trim().toLowerCase();
    return ok.some((a) => d === a || d.endsWith(`.${a}`));
  });
}

/** Constant-time string comparison for the shared secret. */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
