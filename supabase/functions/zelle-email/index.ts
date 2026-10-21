// POST /functions/v1/zelle-email   (called only by our Gmail script, never by the app)
// Confirms a Zelle payment from the bank's deposit email. See docs/PAYMENTS.md → "Zelle: automatic".
//   Header  x-zelle-secret: <ZELLE_HOOK_SECRET>
//   Body    { text: string, verifiedDomains: string[], messageId: string, dryRun?: boolean }
// dryRun: report what WOULD happen (used by the script's test button) without confirming anything.
// Anything that doesn't pass every check is left pending for a person (and the reason is returned).
// Match: the RWT code in the memo; or, with no code, ONE pending booking with exactly that amount in the hour before.
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json, readBody } from '../_shared/http.ts';
import { isIncoming, parseZelleEmail, sameSecret, senderAllowed } from '../_shared/zelleEmail.ts';

interface Body {
  text?: string;
  verifiedDomains?: string[];
  messageId?: string;
  /** When Gmail received the email (ISO). Needed for the backup match by amount. */
  receivedAt?: string;
  dryRun?: boolean;
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const secret = Deno.env.get('ZELLE_HOOK_SECRET') ?? '';
    if (!sameSecret(req.headers.get('x-zelle-secret') ?? '', secret)) return fail(401, 'bad_secret', 'Not allowed');

    const b = await readBody<Body>(req);
    if (!b?.text || !Array.isArray(b.verifiedDomains) || !b.messageId) return fail(400, 'bad_body', 'Send text, verifiedDomains and messageId');

    const allowed = (Deno.env.get('ZELLE_SENDER_DOMAINS') ?? '').split(',');
    const sender = senderAllowed(b.verifiedDomains, allowed);
    const parsed = parseZelleEmail(b.text);
    if (b.dryRun) {
      return json({ dryRun: true, senderAllowed: sender, verifiedDomains: b.verifiedDomains.slice(0, 5), parsed: parsed.ok ? parsed.deposit : parsed.reason });
    }
    if (!sender) return json({ confirmed: false, reason: 'sender_not_verified' });
    const bankRef = `email:${String(b.messageId).slice(0, 120)}`;

    // Backup: no code in the memo, but exactly one amount → match a single pending booking with that exact amount.
    const at = b.receivedAt ? Date.parse(b.receivedAt) : NaN;
    if (!parsed.ok && parsed.reason === 'no_code' && parsed.amountUsd && Number.isFinite(at) && isIncoming(b.text)) {
      const { data, error } = await ctx.supabaseAdmin.rpc('confirm_zelle_by_amount', {
        p_received_usd: parsed.amountUsd,
        p_bank_ref: bankRef,
        p_received_at: new Date(at).toISOString(),
      });
      if (error) {
        const reason = /ambiguous/.test(error.message) ? 'same_amount_twice' : /no_match/.test(error.message) ? 'no_matching_booking' : 'error';
        return json({ confirmed: false, reason, amountUsd: parsed.amountUsd, matchedBy: 'amount' });
      }
      return json({ confirmed: data === 'ok', result: data, amountUsd: parsed.amountUsd, matchedBy: 'amount' });
    }
    if (!parsed.ok) return json({ confirmed: false, reason: parsed.reason });

    const { data, error } = await ctx.supabaseAdmin.rpc('confirm_zelle', {
      p_code: parsed.deposit.code,
      p_received_usd: parsed.deposit.amountUsd,
      p_bank_ref: bankRef,
    });
    if (error) {
      const reason = /amount_short/.test(error.message) ? 'amount_short' : /no_pending/.test(error.message) ? 'no_pending_payment' : 'error';
      return json({ confirmed: false, reason, code: parsed.deposit.code });
    }
    return json({ confirmed: data === 'ok', result: data, code: parsed.deposit.code, amountUsd: parsed.deposit.amountUsd });
  }),
};
