// POST /functions/v1/payment-webhook  (called by the payment processor, never by the app)
// The ONLY place a ride or booking becomes `paid`. Verify the processor's signature before trusting anything.
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const secret = Deno.env.get('PAYMENT_WEBHOOK_SECRET');
    if (!secret) return fail(501, 'payments_not_configured', 'PAYMENT_WEBHOOK_SECRET is not set');

    const raw = await req.text();
    // TODO(payments): verify the processor signature header against `raw` using `secret` with the
    // processor's official SDK or documented HMAC scheme. Reject (400) if it does not match.
    const verified = false;
    if (!verified) return fail(400, 'bad_signature', 'Signature verification not implemented');

    // TODO(payments): parse `raw`, and on a "payment succeeded" event read metadata.payment_id and the
    // processor's charge id, then:
    const paymentId = '';
    const providerRef = '';
    const { error } = await ctx.supabaseAdmin.rpc('mark_payment_succeeded', { p_payment_id: paymentId, p_provider_ref: providerRef });
    if (error) return fail(500, 'update_failed', error.message);
    return json({ received: true });
  }),
};
