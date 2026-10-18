// POST /functions/v1/create-pass  { passType: 'week2' … 'week12' | 'twoWeek2' … 'twoWeek12', startsAt?: ISO }
// Creates a ride pass in awaiting_payment. It becomes active only when the payment webhook confirms payment.
import { withSupabase } from 'npm:@supabase/server@1';
import { FEATURE_SETTINGS, passDefinition, type PassId } from '../_shared/features.ts';
import { fail, json, readBody } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<{ passType: PassId; startsAt?: string }>(req);
    if (!b || !FEATURE_SETTINGS.passes.some((p) => p.id === b.passType)) return fail(400, 'bad_pass', 'Unknown pass type');
    const def = passDefinition(b.passType);
    const now = Date.now();
    const start = b.startsAt ? Date.parse(b.startsAt) : now;
    if (Number.isNaN(start) || start < now - 60_000 || start > now + 60 * 86_400_000) return fail(400, 'bad_start', 'Start must be between now and 60 days ahead');
    const { data, error } = await ctx.supabaseAdmin
      .from('guest_passes')
      .insert({
        guest_id: ctx.userClaims!.id,
        pass_type: def.id,
        riders: def.riders,
        price_usd: def.priceUsd,
        starts_at: new Date(start).toISOString(),
        expires_at: new Date(start + def.days * 86_400_000).toISOString(),
        rides_total: def.rides,
        status: 'awaiting_payment',
      })
      .select()
      .single();
    if (error) return fail(500, 'insert_failed', error.message);
    return json({ pass: data });
  }),
};
