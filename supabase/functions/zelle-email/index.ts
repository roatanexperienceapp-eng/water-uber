// POST /functions/v1/zelle-email   (called only by our Gmail script, never by the app)
// Confirms a Zelle payment from the bank's deposit email. See docs/PAYMENTS.md → "Zelle: automatic".
//   Header  x-zelle-secret: <ZELLE_HOOK_SECRET>
//   Body    { text: string, verifiedDomains: string[], messageId: string, dryRun?: boolean }
// dryRun: report what WOULD happen (used by the script's test button) without confirming anything.
// Anything that doesn't pass every check is left pending for a person (and the reason is returned).
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json, readBody } from '../_shared/http.ts';
import { parseZelleEmail, sameSecret, senderAllowed } from '../_shared/zelleEmail.ts';

interface Body {
  text?: string;
  verifiedDomains?: string[];
  messageId?: string;
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
    if (!parsed.ok) return json({ confirmed: false, reason: parsed.reason });

    const bankRef = `email:${String(b.messageId).slice(0, 120)}`;
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
