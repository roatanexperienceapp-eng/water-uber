// POST /functions/v1/create-booking
// Instant listings (partner + fixed price): server computes the total, status awaiting_payment.
// Request listings: status requested; the concierge team confirms price/availability, then sets quoted.
import { activityTotalUsd } from '../_shared/tours.ts';
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json, readBody } from '../_shared/http.ts';
import { VAN_SETTINGS, vanPlan, vanPriceUsd } from '../_shared/transport.ts';
import { CRUISE_SETTINGS, fitsPortTime, roatanDate, roatanInstant, splitDeadline, type PortId } from '../_shared/cruise.ts';

interface Body {
  listingId: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "09:00"
  quantity: number;
  note?: string;
  /** The guest's cruise ship today. The server refuses times that would make them miss it. */
  shipCallId?: string;
  /** Split the price into this many equal shares paid separately (2–12). Instant bookings only. */
  splitShares?: number;
  /** Cruise guests: add our van from the port gate to the tour and back ($25 per person). */
  van?: boolean;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<Body>(req);
    if (!b?.listingId) return fail(400, 'bad_body', 'listingId is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '')) return fail(400, 'bad_date', 'date must be YYYY-MM-DD');
    const today = roatanDate(new Date()); // island date, not UTC (UTC rolls over at 6 pm in Roatán)
    if (b.date < today) return fail(400, 'past_date', 'Pick a date from today on');
    if (!/^\d{1,2}:\d{2}$/.test(b.time ?? '')) return fail(400, 'bad_time', 'time must be HH:MM');
    if (!Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > 60) return fail(400, 'bad_quantity', 'quantity must be 1–60');

    const { data: listing, error: lerr } = await ctx.supabaseAdmin
      .from('listings')
      .select('id, portal_key, area, duration_minutes, booking, price_usd, unit, active, operator_id, operators(is_partner)')
      .eq('id', b.listingId)
      .single();
    if (lerr || !listing || !listing.active) return fail(404, 'listing_not_found', 'This listing is not available');
    if (listing.booking === 'info') return fail(400, 'not_bookable', 'This listing is information only');

    // deno-lint-ignore no-explicit-any
    const partner = !!(listing as any).operators?.is_partner;
    const instant = listing.booking === 'instant' && partner && listing.price_usd != null;
    let total = instant ? activityTotalUsd(Number(listing.price_usd), listing.unit, b.quantity) : null;

    const start = roatanInstant(b.date, b.time);
    if (start.getTime() < Date.now()) return fail(400, 'past_time', 'That time has passed');

    // Cruise guests: never sell a time that gets them back after the ship's deadline.
    let shipCallId: string | null = null;
    let van: { van_seats: number; van_usd: number; van_pickup_at: string; van_return_at: string } | null = null;
    if (b.van && !b.shipCallId) return fail(400, 'van_needs_ship', 'The port van is for cruise guests. Pick your ship first.');
    if (b.shipCallId) {
      const { data: call } = await ctx.supabaseAdmin.from('ship_calls').select('*').eq('id', b.shipCallId).maybeSingle();
      if (!call) return fail(400, 'bad_ship', 'Unknown ship call');
      if (call.call_date !== b.date) return fail(409, 'misses_ship', 'Your ship is only in port on ' + call.call_date);
      const fit = fitsPortTime(
        { id: call.id, date: call.call_date, ship: call.ship_name, port: call.port as PortId, arriveAt: new Date(call.arrive_at), allAboardAt: new Date(call.all_aboard_at) },
        { area: listing.area, portal: listing.portal_key, start, durationMinutes: listing.duration_minutes },
      );
      if (!fit.fits && fit.reason !== 'unknown_area') {
        return fail(409, 'misses_ship', `This time gets you back after ${CRUISE_SETTINGS.backAtPortMinutesBefore} min before all-aboard`);
      }
      shipCallId = call.id;
      if (b.van) {
        if (!instant || total === null) return fail(409, 'van_not_available', 'The port van can only be added to tours with a fixed price');
        const plan = vanPlan(
          { id: call.id, date: call.call_date, ship: call.ship_name, port: call.port as PortId, arriveAt: new Date(call.arrive_at), allAboardAt: new Date(call.all_aboard_at) },
          { area: listing.area, portal: listing.portal_key, start, durationMinutes: listing.duration_minutes, people: b.quantity },
        );
        if (!plan) return fail(409, 'van_not_available', 'Our van does not go to this area yet');
        if (!plan.onTime) return fail(409, 'van_too_early', `The van waits ${VAN_SETTINGS.waitMinutes} min at the port gate. Pick a later start time.`);
        if (plan.leavesAt.getTime() < Date.now() + 10 * 60_000) return fail(409, 'van_too_soon', 'Too late to book the van for this time');
        const vanUsd = vanPriceUsd(b.quantity);
        van = { van_seats: b.quantity, van_usd: vanUsd, van_pickup_at: plan.pickupAt.toISOString(), van_return_at: plan.returnPickupAt.toISOString() };
        total += vanUsd;
      }
    }

    let deadline: Date | null = null;
    if (b.splitShares != null) {
      if (!Number.isInteger(b.splitShares) || b.splitShares < 2 || b.splitShares > CRUISE_SETTINGS.splitMaxShares) {
        return fail(400, 'bad_split', `Split into 2–${CRUISE_SETTINGS.splitMaxShares} shares`);
      }
      if (!instant) return fail(409, 'not_splittable', 'Only fixed-price bookings can be split');
      deadline = splitDeadline(new Date(), start);
      if (!deadline) return fail(409, 'too_late_to_split', 'Too close to the start time to split. Pay in full instead.');
    }

    const { data, error } = await ctx.supabaseAdmin
      .from('bookings')
      .insert({
        guest_id: ctx.userClaims!.id,
        listing_id: listing.id,
        trip_date: b.date,
        trip_time: b.time,
        quantity: b.quantity,
        total_usd: total,
        status: instant ? 'awaiting_payment' : 'requested',
        guest_note: b.note?.slice(0, 500) ?? null,
        ship_call_id: shipCallId,
        ...(van ?? {}),
      })
      .select()
      .single();
    if (error) return fail(500, 'insert_failed', error.message);

    let split = null;
    if (deadline) {
      const { data: s, error: serr } = await ctx.supabaseAdmin.rpc('create_split', {
        p_booking_id: data.id,
        p_organizer: ctx.userClaims!.id,
        p_shares: b.splitShares,
        p_deadline: deadline.toISOString(),
      });
      if (serr) return fail(500, 'split_failed', serr.message);
      split = { token: s.token, shares: s.shares, deadlineAt: s.deadline_at };
    }
    return json({ booking: data, split });
  }),
};
