// POST /functions/v1/create-booking
// Instant listings (partner + fixed price): server computes the total, status awaiting_payment.
// Request listings: status requested; the concierge team confirms price/availability, then sets quoted.
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json, readBody } from '../_shared/http.ts';

interface Body {
  listingId: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "09:00"
  quantity: number;
  note?: string;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<Body>(req);
    if (!b?.listingId) return fail(400, 'bad_body', 'listingId is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '')) return fail(400, 'bad_date', 'date must be YYYY-MM-DD');
    const today = new Date().toISOString().slice(0, 10);
    if (b.date < today) return fail(400, 'past_date', 'Pick a date from today on');
    if (!/^\d{1,2}:\d{2}$/.test(b.time ?? '')) return fail(400, 'bad_time', 'time must be HH:MM');
    if (!Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > 60) return fail(400, 'bad_quantity', 'quantity must be 1–60');

    const { data: listing, error: lerr } = await ctx.supabaseAdmin
      .from('listings')
      .select('id, booking, price_usd, unit, active, operator_id, operators(is_partner)')
      .eq('id', b.listingId)
      .single();
    if (lerr || !listing || !listing.active) return fail(404, 'listing_not_found', 'This listing is not available');
    if (listing.booking === 'info') return fail(400, 'not_bookable', 'This listing is information only');

    // deno-lint-ignore no-explicit-any
    const partner = !!(listing as any).operators?.is_partner;
    const instant = listing.booking === 'instant' && partner && listing.price_usd != null;
    const total = instant ? (listing.unit === 'boat' ? Number(listing.price_usd) : Number(listing.price_usd) * b.quantity) : null;

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
      })
      .select()
      .single();
    if (error) return fail(500, 'insert_failed', error.message);
    return json({ booking: data });
  }),
};
