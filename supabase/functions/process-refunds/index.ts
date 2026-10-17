// POST /functions/v1/process-refunds  (called every 5 minutes by the scheduler, with the secret key)
// Sends queued refunds to the processor: cancelled rides, expired group bookings, payments for things
// that were no longer payable. Each refund uses an idempotency key, so a retry never refunds twice.
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json } from '../_shared/http.ts';
import { getProvider } from '../_shared/payments.ts';

const MAX_ATTEMPTS = 5;

export default {
  fetch: withSupabase({ auth: 'secret' }, async (_req, ctx) => {
    const provider = getProvider(Deno.env);
    if (!provider) return json({ ok: true, skipped: 'payments_not_configured' });
    const db = ctx.supabaseAdmin;
    const { data: due, error } = await db
      .from('payments')
      .select('id, provider_ref, paid_amount_cents, amount_cents, refund_attempts')
      .not('refund_requested_at', 'is', null)
      .is('refunded_at', null)
      .eq('status', 'succeeded')
      .eq('provider', provider.name)
      .lt('refund_attempts', MAX_ATTEMPTS)
      .limit(25);
    if (error) return fail(500, 'query_failed', error.message);

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const p of due ?? []) {
      try {
        const { refundRef } = await provider.refund(String(p.provider_ref), Number(p.paid_amount_cents ?? p.amount_cents), `refund-${p.id}`);
        await db.rpc('mark_payment_refunded', { p_payment_id: p.id, p_refund_ref: refundRef });
        results.push({ id: p.id, ok: true });
      } catch (e) {
        await db.rpc('record_refund_error', { p_payment_id: p.id, p_error: String(e) });
        results.push({ id: p.id, ok: false, error: String(e) });
      }
    }
    return json({ ok: true, processed: results.length, results });
  }),
};
