// POST /functions/v1/create-repeat-ride
// { from, to, riders, time: "HH:MM", weekdays: number[], startDate, endDate, usePass?: boolean }
// Saves a daily/weekly pickup. The pickup-watchdog turns it into real rides 24 hours ahead.
import { withSupabase } from 'npm:@supabase/server@1';
import { DOCKS } from '../_shared/geo.ts';
import { PRICING, quoteFare } from '../_shared/pricing.ts';
import { fail, json, readBody } from '../_shared/http.ts';

interface Body {
  from: string;
  to: string;
  riders: number;
  time: string;
  weekdays?: number[];
  startDate: string;
  endDate: string;
  usePass?: boolean;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<Body>(req);
    if (!b) return fail(400, 'bad_json', 'Body must be JSON');
    const ids = new Set(DOCKS.map((d) => d.id));
    if (!ids.has(b.from) || !ids.has(b.to) || b.from === b.to) return fail(400, 'bad_docks', 'Unknown or identical docks');
    if (!Number.isInteger(b.riders) || b.riders < 1 || b.riders > PRICING.maxRiders) return fail(400, 'bad_riders', 'Bad rider count');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time ?? '')) return fail(400, 'bad_time', 'time must be HH:MM');
    const weekdays = (b.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.startDate ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(b.endDate ?? '')) return fail(400, 'bad_dates', 'Dates must be YYYY-MM-DD');
    const uid = ctx.userClaims!.id;

    // Scheduled pickups are private boats plus the reservation fee, same as a single scheduled ride.
    const quote = quoteFare({ from: b.from, to: b.to, riders: b.riders, mode: 'private', timing: 'scheduled' });

    let passId: string | null = null;
    if (b.usePass !== false) {
      const { data } = await ctx.supabaseAdmin
        .from('guest_passes')
        .select('id')
        .eq('guest_id', uid)
        .eq('status', 'active')
        .gte('expires_at', `${b.endDate}T00:00:00-06:00`)
        .limit(1)
        .maybeSingle();
      passId = data?.id ?? null;
    }

    const { data, error } = await ctx.supabaseAdmin
      .from('repeat_rides')
      .insert({
        guest_id: uid,
        from_dock: b.from,
        to_dock: b.to,
        riders: b.riders,
        pickup_time: b.time,
        weekdays,
        start_date: b.startDate,
        end_date: b.endDate,
        fare_usd: quote.total,
        miles: Number(quote.miles.toFixed(2)),
        pass_id: passId,
      })
      .select()
      .single();
    if (error) return fail(400, 'insert_failed', error.message);
    return json({ repeat: data, farePerRide: quote.total, coveredByPass: !!passId });
  }),
};
