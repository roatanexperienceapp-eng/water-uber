// POST /functions/v1/pickup-watchdog  (called every minute by the scheduler, with the secret key)
// Reassigns unconfirmed rides, credits missed guaranteed pickups, creates tomorrow's repeat rides.
import { withSupabase } from 'npm:@supabase/server@1';
import { FEATURE_SETTINGS } from '../_shared/features.ts';
import { fail, json } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'secret' }, async (_req, ctx) => {
    const g = FEATURE_SETTINGS.guarantee;
    const { data, error } = await ctx.supabaseAdmin.rpc('run_pickup_watchdog', {
      p_credit_usd: g.missedPickupCreditUsd,
      p_confirm_minutes: g.confirmMinutesBefore,
      p_grace_minutes: g.lateGraceMinutes,
    });
    if (error) return fail(500, 'watchdog_failed', error.message);
    return json({ ok: true, result: data });
  }),
};
