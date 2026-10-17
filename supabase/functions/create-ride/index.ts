// POST /functions/v1/create-ride
// Creates a water taxi ride with a SERVER-computed fare. The client's price is ignored.
// Week-stay features applied here: ride passes, night rules, shared seats, activity links.
import { withSupabase } from 'npm:@supabase/server@1';
import { DOCKS } from '../_shared/geo.ts';
import { PRICING, quoteFare, type RideMode, type RideTiming } from '../_shared/pricing.ts';
import { FEATURE_SETTINGS, nightMode, passCovers, type PassId } from '../_shared/features.ts';
import { fail, json, readBody } from '../_shared/http.ts';

interface Body {
  from: string;
  to: string;
  riders: number;
  mode: RideMode;
  timing: RideTiming;
  scheduledFor?: string;
  hasKids?: boolean;
  needsTowels?: boolean;
  /** Use the guest's active pass if it covers this ride. Default true. */
  usePass?: boolean;
  /** Link the ride to a booked activity (tour, dive, dinner). */
  bookingId?: string;
}

const MAX_DAYS_AHEAD = 60;

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<Body>(req);
    if (!b) return fail(400, 'bad_json', 'Body must be JSON');
    const uid = ctx.userClaims!.id;

    const dockIds = new Set(DOCKS.map((d) => d.id));
    if (!dockIds.has(b.from) || !dockIds.has(b.to) || b.from === b.to) return fail(400, 'bad_docks', 'Unknown or identical docks');
    if (!Number.isInteger(b.riders) || b.riders < 1 || b.riders > PRICING.maxRiders) return fail(400, 'bad_riders', `Riders must be 1–${PRICING.maxRiders}`);
    if (b.mode !== 'shared' && b.mode !== 'private') return fail(400, 'bad_mode', 'mode must be shared or private');
    if (b.timing !== 'now' && b.timing !== 'scheduled') return fail(400, 'bad_timing', 'timing must be now or scheduled');

    const now = new Date();
    let pickupAt = now;
    if (b.timing === 'scheduled') {
      const t = Date.parse(b.scheduledFor ?? '');
      if (Number.isNaN(t) || t < now.getTime() + 10 * 60_000 || t > now.getTime() + MAX_DAYS_AHEAD * 86_400_000) {
        return fail(400, 'bad_time', 'Scheduled time must be at least 10 minutes ahead and within 60 days');
      }
      pickupAt = new Date(t);
    }

    // Night rules: no boats after the last departure; after sunset only boats with running lights.
    const night = nightMode(pickupAt);
    if (night === 'boats_closed') return fail(409, 'boats_closed', 'No water taxis at this hour. Book a land taxi instead.');

    const { data: active } = await ctx.supabaseAdmin.from('docks').select('id').in('id', [b.from, b.to]).eq('active', true);
    if ((active ?? []).length !== 2) return fail(400, 'dock_inactive', 'One of these docks is not in service');

    if (b.bookingId) {
      const { data: bk } = await ctx.supabaseAdmin.from('bookings').select('guest_id').eq('id', b.bookingId).maybeSingle();
      if (!bk || bk.guest_id !== uid) return fail(400, 'bad_booking', 'That booking is not yours');
    }

    const mode: RideMode = b.timing === 'scheduled' ? 'private' : b.mode;
    const quote = quoteFare({ from: b.from, to: b.to, riders: b.riders, mode, timing: b.timing });
    const nightSurcharge = night === 'night' ? FEATURE_SETTINGS.night.surchargePerRider * b.riders : 0;
    let fare = quote.total + nightSurcharge;

    // Ride pass: if the guest has an active pass that covers this ride, it's free and already paid.
    let passId: string | null = null;
    if (b.usePass !== false) {
      const { data: passes } = await ctx.supabaseAdmin
        .from('guest_passes')
        .select('id, pass_type, starts_at, rides_used')
        .eq('guest_id', uid)
        .eq('status', 'active')
        .gt('expires_at', now.toISOString())
        .order('expires_at', { ascending: true });
      for (const p of passes ?? []) {
        const covers = passCovers(
          { passId: p.pass_type as PassId, startsAt: new Date(p.starts_at), ridesUsed: p.rides_used },
          { from: b.from, to: b.to, riders: b.riders, at: pickupAt },
        );
        if (!covers.covered) continue;
        const { data: used } = await ctx.supabaseAdmin.rpc('consume_pass_ride', { p_pass_id: p.id, p_guest: uid, p_at: pickupAt.toISOString() });
        if (used) {
          passId = p.id;
          // The pass pays for its riders; extra riders pay the flat per-rider fare.
          fare = covers.fareUsd;
          break;
        }
      }
    }

    // Shared seats: join a boat already filling up on this route, or open one.
    let sharedBoatId: string | null = null;
    if (mode === 'shared' && b.timing === 'now') {
      const { data: sid, error: serr } = await ctx.supabaseAdmin.rpc('take_shared_seats', {
        p_from: b.from,
        p_to: b.to,
        p_riders: b.riders,
        p_wait_minutes: FEATURE_SETTINGS.shared.maxWaitMinutes,
        p_depart_at: FEATURE_SETTINGS.shared.seatsToDepart,
      });
      if (serr) return fail(500, 'shared_failed', serr.message);
      sharedBoatId = sid as string;
    }

    const { data, error } = await ctx.supabaseAdmin
      .from('rides')
      .insert({
        guest_id: uid,
        from_dock: b.from,
        to_dock: b.to,
        riders: b.riders,
        mode,
        timing: b.timing,
        scheduled_for: b.timing === 'scheduled' ? pickupAt.toISOString() : null,
        pickup_at: pickupAt.toISOString(),
        has_kids: !!b.hasKids,
        needs_towels: !!b.needsTowels,
        needs_lit_boat: night === 'night',
        miles: Number(quote.miles.toFixed(2)),
        fare_usd: fare,
        status: passId && fare === 0 ? 'paid' : 'awaiting_payment',
        paid_at: passId && fare === 0 ? now.toISOString() : null,
        pass_id: passId,
        shared_boat_id: sharedBoatId,
        booking_id: b.bookingId ?? null,
      })
      .select()
      .single();
    if (error) return fail(500, 'insert_failed', error.message);
    return json({ ride: data, quote: { ...quote, total: fare }, coveredByPass: !!passId, night });
  }),
};
