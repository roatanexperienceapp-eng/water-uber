// POST /functions/v1/payment-webhook  (called by the payment processor, never by the app)
// The ONLY place anything becomes paid. The processor's signature is verified before reading the body,
// and the amount it charged must match the amount we asked for.
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json } from '../_shared/http.ts';
import { getProvider } from '../_shared/payments.ts';

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const provider = getProvider(Deno.env);
    if (!provider) return fail(501, 'payments_not_configured', 'PAYMENT_PROVIDER is not set');

    const raw = await req.text();
    let event;
    try {
      event = await provider.parseWebhook(raw, req.headers);
    } catch (e) {
      // 400 tells the processor not to retry a forged or stale request.
      return fail(400, 'bad_signature', String(e));
    }

    const db = ctx.supabaseAdmin;
    switch (event.kind) {
      case 'succeeded': {
        const { data, error } = await db.rpc('mark_payment_succeeded', {
          p_payment_id: event.paymentId,
          p_provider_ref: event.providerRef,
          p_amount_cents: event.amountCents,
        });
        // 500 makes the processor retry later; the RPC is idempotent.
        if (error) return fail(500, 'update_failed', error.message);
        return json({ received: true, result: data });
      }
      case 'failed': {
        const { error } = await db.rpc('mark_payment_failed', { p_payment_id: event.paymentId });
        if (error) return fail(500, 'update_failed', error.message);
        return json({ received: true });
      }
      case 'refunded': {
        // Refunds issued from the processor dashboard also land here.
        const { data: pay } = await db.from('payments').select('id').eq('provider', provider.name).eq('provider_ref', event.providerRef).maybeSingle();
        if (pay) await db.rpc('mark_payment_refunded', { p_payment_id: pay.id, p_refund_ref: event.refundRef });
        return json({ received: true });
      }
      default:
        return json({ received: true, ignored: event.type });
    }
  }),
};
