// POST /functions/v1/create-payment  { rideId } | { bookingId }
// Creates a pending payment row for the server-side amount and returns what the app needs to show the
// processor's payment sheet. The processor itself is an OPEN DECISION (docs/DECISIONS.md).
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json, readBody } from '../_shared/http.ts';

interface Body {
  rideId?: string;
  bookingId?: string;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<Body>(req);
    if (!b || !!b.rideId === !!b.bookingId) return fail(400, 'bad_body', 'Send exactly one of rideId or bookingId');
    const uid = ctx.userClaims!.id;

    let amount: number | null = null;
    if (b.rideId) {
      const { data } = await ctx.supabaseAdmin.from('rides').select('guest_id, status, fare_usd').eq('id', b.rideId).single();
      if (!data || data.guest_id !== uid) return fail(404, 'not_found', 'Ride not found');
      if (data.status !== 'awaiting_payment') return fail(409, 'not_payable', 'This ride is not awaiting payment');
      amount = Number(data.fare_usd);
    } else {
      const { data } = await ctx.supabaseAdmin.from('bookings').select('guest_id, status, total_usd').eq('id', b.bookingId!).single();
      if (!data || data.guest_id !== uid) return fail(404, 'not_found', 'Booking not found');
      if (!['awaiting_payment', 'quoted'].includes(data.status) || data.total_usd == null) {
        return fail(409, 'not_payable', 'This booking has no confirmed price yet');
      }
      amount = Number(data.total_usd);
    }

    const provider = Deno.env.get('PAYMENT_PROVIDER') ?? 'unconfigured';
    const { data: payment, error } = await ctx.supabaseAdmin
      .from('payments')
      .insert({ guest_id: uid, ride_id: b.rideId ?? null, booking_id: b.bookingId ?? null, amount_usd: amount, provider })
      .select()
      .single();
    if (error) return fail(500, 'insert_failed', error.message);

    if (provider === 'unconfigured') {
      return fail(501, 'payments_not_configured', 'Choose a payment processor and implement it here (see docs/DECISIONS.md)');
    }
    // TODO(payments): create the processor's payment intent/session for `amount` (in cents) with
    // metadata { payment_id: payment.id } and return its client secret / checkout token.
    return json({ paymentId: payment.id, amountUsd: amount });
  }),
};
