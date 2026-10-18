// POST /functions/v1/create-payment
//   { rideId } | { bookingId } | { passId } | { splitToken, shares?: 'one' | 'rest' }
// Creates (or reuses) a pending payment for a SERVER-computed amount and returns the processor's hosted
// checkout URL. The app opens that page; the signed webhook is the only thing that marks anything paid.
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json, readBody } from '../_shared/http.ts';
import { getProvider, toCents } from '../_shared/payments.ts';

interface Body {
  rideId?: string;
  bookingId?: string;
  passId?: string;
  donationId?: string;
  bundleId?: string;
  splitToken?: string;
  shares?: 'one' | 'rest';
  /** App path to land on after the checkout page (web), e.g. "/confirmation?kind=ride&id=…". */
  returnPath?: string;
  /** Native app only: the deep link the checkout page hands back to (e.g. "islandride://paid"). */
  appReturnUrl?: string;
}

/** Only our own app schemes (and Expo Go's during development). */
function safeAppUrl(u: unknown): string | null {
  return typeof u === 'string' && /^(islandride|islandride-captain|exp|exps):\/\/[^\s]{0,200}$/.test(u) ? u : null;
}

/** Only same-site paths, never an outside URL (prevents open redirects). */
function safePath(p: unknown, fallback: string): string {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && !p.includes('\\') && p.length < 300 ? p : fallback;
}

const REUSE_MINUTES = 25; // reuse an open checkout instead of creating a second one for the same thing

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<Body>(req);
    if (!b || [b.rideId, b.bookingId, b.passId, b.donationId, b.bundleId, b.splitToken].filter(Boolean).length !== 1) {
      return fail(400, 'bad_body', 'Send exactly one of rideId, bookingId, passId, donationId, bundleId or splitToken');
    }
    const uid = ctx.userClaims!.id;
    const db = ctx.supabaseAdmin;

    let provider;
    try {
      provider = getProvider(Deno.env);
    } catch (e) {
      return fail(500, 'payments_misconfigured', String(e));
    }
    if (!provider) return fail(501, 'payments_not_configured', 'Set PAYMENT_PROVIDER and its keys (docs/PAYMENTS.md)');

    // ---- Work out what is being paid and how much (server-side only) ----
    let payment: Record<string, unknown> | null = null;
    let description = 'Water Uber';
    let returnPath = safePath(b.returnPath, '/trips');
    let coversRides: string[] = [];

    if (b.splitToken) {
      const { data: split } = await db.from('booking_splits').select('id, organizer_id, booking_id').eq('token', b.splitToken).maybeSingle();
      if (!split) return fail(404, 'not_found', 'Group booking not found');
      // Only the organizer can pay "the rest"; anyone with the link can pay one share.
      const count = b.shares === 'rest' ? (split.organizer_id === uid ? null : -1) : 1;
      if (count === -1) return fail(403, 'not_organizer', 'Only the organizer can pay the rest');
      const { data, error } = await db.rpc('reserve_split_share', { p_token: b.splitToken, p_guest: uid, p_count: count, p_provider: provider.name });
      if (error) return fail(409, error.message.includes('no_shares_left') ? 'no_shares_left' : 'split_closed', error.message);
      payment = data as Record<string, unknown>;
      description = 'Group booking share';
      returnPath = safePath(b.returnPath, `/split/${b.splitToken}`);
    } else {
      let amount: number;
      if (b.rideId) {
        const { data } = await db.from('rides').select('guest_id, status, fare_usd').eq('id', b.rideId).single();
        if (!data || data.guest_id !== uid) return fail(404, 'not_found', 'Ride not found');
        if (data.status !== 'awaiting_payment') return fail(409, 'not_payable', 'This ride is not awaiting payment');
        amount = Number(data.fare_usd);
        description = 'Water taxi ride';
      } else if (b.passId) {
        const { data } = await db.from('guest_passes').select('guest_id, status, price_usd').eq('id', b.passId).single();
        if (!data || data.guest_id !== uid) return fail(404, 'not_found', 'Pass not found');
        if (data.status !== 'awaiting_payment') return fail(409, 'not_payable', 'This pass is not awaiting payment');
        amount = Number(data.price_usd);
        description = 'Water taxi ride pass';
      } else if (b.bundleId) {
        const { data } = await db.from('bundles').select('guest_id, status, total_cents').eq('id', b.bundleId).single();
        if (!data || data.guest_id !== uid) return fail(404, 'not_found', 'Package not found');
        if (data.status !== 'awaiting_payment') return fail(409, 'not_payable', 'This package is already paid');
        amount = data.total_cents / 100;
        description = 'Water taxi pass + tours package';
      } else if (b.donationId) {
        const { data } = await db.from('donations').select('donor_id, status, amount_usd').eq('id', b.donationId).single();
        if (!data || data.donor_id !== uid) return fail(404, 'not_found', 'Donation not found');
        if (data.status !== 'awaiting_payment') return fail(409, 'not_payable', 'This donation is already paid');
        amount = Number(data.amount_usd);
        const { data: g } = await db.from('giving_settings').select('charity_name').eq('id', 1).single();
        description = `Donation to ${g?.charity_name ?? 'Roatán kids'}`;
      } else {
        const { data } = await db.from('bookings').select('guest_id, status, total_usd, listings(name)').eq('id', b.bookingId!).single();
        if (!data || data.guest_id !== uid) return fail(404, 'not_found', 'Booking not found');
        const { data: split } = await db.from('booking_splits').select('id').eq('booking_id', b.bookingId!).maybeSingle();
        if (split) return fail(409, 'is_split', 'This booking is split; pay through the group link');
        if (!['awaiting_payment', 'quoted'].includes(data.status) || data.total_usd == null) {
          return fail(409, 'not_payable', 'This booking has no confirmed price yet');
        }
        amount = Number(data.total_usd);
        // Taxi rides booked with this activity are paid in the same checkout.
        const { data: rides } = await db.from('rides').select('id, fare_usd').eq('booking_id', b.bookingId!).eq('guest_id', uid).eq('status', 'awaiting_payment');
        coversRides = (rides ?? []).map((r) => String(r.id));
        amount += (rides ?? []).reduce((sum, r) => sum + Number(r.fare_usd), 0);
        // deno-lint-ignore no-explicit-any
        description = String((data as any).listings?.name ?? 'Booking');
      }
      if (toCents(amount) < 50) return fail(409, 'amount_too_small', 'Nothing to pay'); // processors reject < $0.50
      // Donations may only be paid on the website (Apple: no in-app charity payments unless approved nonprofit).
      if (b.donationId && b.appReturnUrl) return fail(409, 'donate_on_web', 'Donations are completed on the website');

      const target = b.rideId ? { ride_id: b.rideId } : b.passId ? { pass_id: b.passId } : b.donationId ? { donation_id: b.donationId } : b.bundleId ? { bundle_id: b.bundleId } : { booking_id: b.bookingId };
      const [col, val] = Object.entries(target)[0];
      const { data: open } = await db
        .from('payments')
        .select('*')
        .eq(col, val)
        .eq('guest_id', uid)
        .eq('status', 'pending')
        .gt('created_at', new Date(Date.now() - REUSE_MINUTES * 60_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (open && Number(open.amount_usd) === amount && String(open.covers_ride_ids ?? []) === String(coversRides) && open.checkout_url && new Date(String(open.checkout_expires_at)) > new Date()) {
        return json({ paymentId: open.id, amountUsd: amount, checkoutUrl: open.checkout_url });
      }
      const { data, error } = await db.from('payments').insert({ guest_id: uid, ...target, amount_usd: amount, provider: provider.name, covers_ride_ids: coversRides }).select().single();
      if (error) return fail(500, 'insert_failed', error.message);
      payment = data;
    }

    // ---- Hosted checkout page ----
    if (payment!.checkout_url && new Date(String(payment!.checkout_expires_at)) > new Date()) {
      return json({ paymentId: payment!.id, amountUsd: Number(payment!.amount_usd), checkoutUrl: payment!.checkout_url });
    }
    const web = Deno.env.get('PUBLIC_WEB_URL') ?? 'https://wateruber.app';
    const appUrl = safeAppUrl(b.appReturnUrl);
    const back = `payment=${payment!.id}&back=${encodeURIComponent(returnPath)}${appUrl ? `&app=${encodeURIComponent(appUrl)}` : ''}`;
    const { data: user } = await db.auth.admin.getUserById(uid);
    try {
      const session = await provider.createCheckout({
        paymentId: String(payment!.id),
        amountCents: toCents(Number(payment!.amount_usd)),
        currency: 'usd',
        description,
        successUrl: `${web}/paid?${back}`,
        cancelUrl: `${web}/paid?${back}&cancelled=1`,
        customerEmail: user?.user?.email || undefined,
      });
      await db.from('payments').update({
        checkout_session_id: session.providerSessionId,
        checkout_url: session.checkoutUrl,
        checkout_expires_at: session.expiresAt.toISOString(),
      }).eq('id', payment!.id);
      return json({ paymentId: payment!.id, amountUsd: Number(payment!.amount_usd), checkoutUrl: session.checkoutUrl });
    } catch (e) {
      await db.rpc('mark_payment_failed', { p_payment_id: payment!.id });
      return fail(502, 'processor_error', String(e));
    }
  }),
};
