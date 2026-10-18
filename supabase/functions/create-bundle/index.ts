// POST /functions/v1/create-bundle
//   { passType: 'week3', startsAt?: ISO, tours: [{ listingId, date: 'YYYY-MM-DD', time: 'HH:MM' }] }
// Creates a package: the water taxi pass + the guest's tours, priced on the SERVER with the package discount.
// Everything is awaiting payment; one payment (create-payment { bundleId }) confirms it all.
import { activityTotalUsd } from '../_shared/tours.ts';
import { withSupabase } from 'npm:@supabase/server@1';
import { FEATURE_SETTINGS, passDefinition, type PassId } from '../_shared/features.ts';
import { bundleQuote, bundleTour, type BundleTourPrice } from '../_shared/bundle.ts';
import { roatanDate, roatanInstant } from '../_shared/cruise.ts';
import { fail, json, readBody } from '../_shared/http.ts';

interface Body {
  passType: PassId;
  startsAt?: string;
  tours: { listingId: string; date: string; time: string }[];
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<Body>(req);
    if (!b || !FEATURE_SETTINGS.passes.some((p) => p.id === b.passType)) return fail(400, 'bad_pass', 'Unknown pass type');
    if (!Array.isArray(b.tours) || b.tours.length < 1 || b.tours.length > 2) return fail(400, 'bad_tours', 'Add one or two tours');
    const pass = passDefinition(b.passType);
    const now = Date.now();
    const start = b.startsAt ? Date.parse(b.startsAt) : now;
    if (Number.isNaN(start) || start < now - 60_000 || start > now + 60 * 86_400_000) return fail(400, 'bad_start', 'Start must be between now and 60 days ahead');
    const end = start + pass.days * 86_400_000;
    const db = ctx.supabaseAdmin;
    const uid = ctx.userClaims!.id;

    // Price each tour from the database (never from the app) and check its date fits inside the pass.
    const priced: BundleTourPrice[] = [];
    for (const t of b.tours) {
      const rule = bundleTour(t.listingId);
      if (!rule) return fail(400, 'not_in_packages', 'This tour is not part of packages');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !/^\d{2}:\d{2}$/.test(t.time)) return fail(400, 'bad_time', 'Pick a date and time');
      const at = roatanInstant(t.date, t.time).getTime();
      if (at < now + 60 * 60_000 || at < start || at >= end) return fail(409, 'outside_pass', 'Each tour must be during your pass');
      const { data: l } = await db.from('listings').select('id, active, booking, price_usd, unit').eq('id', t.listingId).single();
      if (!l?.active || l.booking !== 'instant' || l.price_usd == null) return fail(409, 'tour_unavailable', 'This tour has no fixed price yet');
      priced.push({ listingId: l.id, kind: rule.kind, priceUsd: Number(l.price_usd), unit: l.unit });
    }

    let quote;
    try {
      quote = bundleQuote(pass.priceUsd, pass.riders, priced);
    } catch (e) {
      return fail(400, String((e as Error).message), 'Package rules not met');
    }

    const { data: gp, error: perr } = await db
      .from('guest_passes')
      .insert({
        guest_id: uid, pass_type: pass.id, riders: pass.riders, price_usd: pass.priceUsd,
        starts_at: new Date(start).toISOString(), expires_at: new Date(end).toISOString(), rides_total: null, status: 'awaiting_payment',
      })
      .select('id')
      .single();
    if (perr) return fail(500, 'pass_failed', perr.message);

    const { data: bundle, error: berr } = await db
      .from('bundles')
      .insert({
        guest_id: uid, pass_id: gp.id, group_size: pass.riders, subtotal_cents: quote.subtotalCents, discount_pct: quote.discountPct,
        discount_cents: quote.discountCents, total_cents: quote.totalCents, pass_share_cents: quote.passShareCents, tours_share_cents: quote.toursShareCents,
      })
      .select()
      .single();
    if (berr) return fail(500, 'bundle_failed', berr.message);

    const rows = b.tours.map((t, i) => ({
      guest_id: uid, listing_id: t.listingId, trip_date: t.date, trip_time: t.time, quantity: pass.riders,
      total_usd: activityTotalUsd(priced[i].priceUsd, priced[i].unit, pass.riders),
      status: 'awaiting_payment', bundle_id: bundle.id,
    }));
    const { error: kerr } = await db.from('bookings').insert(rows);
    if (kerr) return fail(500, 'booking_failed', kerr.message);

    return json({ bundle, quote, today: roatanDate(new Date()) });
  }),
};
