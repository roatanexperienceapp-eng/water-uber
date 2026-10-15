// POST /functions/v1/create-ride
// Creates a water taxi ride in `awaiting_payment` with a SERVER-computed fare. The client's price is ignored.
import { withSupabase } from 'npm:@supabase/server@1';
import { DOCKS } from '../_shared/geo.ts';
import { PRICING, quoteFare, type RideMode, type RideTiming } from '../_shared/pricing.ts';
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
}

const MAX_DAYS_AHEAD = 60;

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<Body>(req);
    if (!b) return fail(400, 'bad_json', 'Body must be JSON');

    const dockIds = new Set(DOCKS.map((d) => d.id));
    if (!dockIds.has(b.from) || !dockIds.has(b.to) || b.from === b.to) return fail(400, 'bad_docks', 'Unknown or identical docks');
    if (!Number.isInteger(b.riders) || b.riders < 1 || b.riders > PRICING.maxRiders) return fail(400, 'bad_riders', `Riders must be 1–${PRICING.maxRiders}`);
    if (b.mode !== 'shared' && b.mode !== 'private') return fail(400, 'bad_mode', 'mode must be shared or private');
    if (b.timing !== 'now' && b.timing !== 'scheduled') return fail(400, 'bad_timing', 'timing must be now or scheduled');

    let scheduledFor: string | null = null;
    if (b.timing === 'scheduled') {
      const t = Date.parse(b.scheduledFor ?? '');
      const now = Date.now();
      if (Number.isNaN(t) || t < now + 10 * 60_000 || t > now + MAX_DAYS_AHEAD * 86_400_000) {
        return fail(400, 'bad_time', 'Scheduled time must be at least 10 minutes ahead and within 60 days');
      }
      scheduledFor = new Date(t).toISOString();
    }

    // Make sure the dock table matches the code (a dock can be switched off by an admin).
    const { data: active } = await ctx.supabaseAdmin.from('docks').select('id').in('id', [b.from, b.to]).eq('active', true);
    if ((active ?? []).length !== 2) return fail(400, 'dock_inactive', 'One of these docks is not in service');

    const quote = quoteFare({ from: b.from, to: b.to, riders: b.riders, mode: b.mode, timing: b.timing });
    const { data, error } = await ctx.supabaseAdmin
      .from('rides')
      .insert({
        guest_id: ctx.userClaims!.id,
        from_dock: b.from,
        to_dock: b.to,
        riders: b.riders,
        mode: b.timing === 'scheduled' ? 'private' : b.mode,
        timing: b.timing,
        scheduled_for: scheduledFor,
        has_kids: !!b.hasKids,
        needs_towels: !!b.needsTowels,
        miles: Number(quote.miles.toFixed(2)),
        fare_usd: quote.total,
        status: 'awaiting_payment',
      })
      .select()
      .single();
    if (error) return fail(500, 'insert_failed', error.message);
    return json({ ride: data, quote });
  }),
};
