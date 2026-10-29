// POST /functions/v1/create-land-ride
// Creates a land taxi ride with a SERVER-computed fare. The client's price is ignored.
//   { pickup: { placeId } | { lat, lon, label }, dropoff: same, riders, vehicle?, timing, scheduledFor?, note? }
import { withSupabase } from 'npm:@supabase/server@1';
import { LAND_PRICING, LandQuoteError, onIsland, placeById, quoteLand, type LandTiming, type VehicleKind } from '../_shared/land.ts';
import { fail, json, readBody } from '../_shared/http.ts';

interface Spot {
  placeId?: string;
  lat?: number;
  lon?: number;
  label?: string;
}

interface Body {
  pickup: Spot;
  dropoff: Spot;
  riders: number;
  vehicle?: VehicleKind;
  timing: LandTiming;
  scheduledFor?: string;
  note?: string;
}

function resolve(s: Spot | undefined): { lat: number; lon: number; label: string } | null {
  if (!s) return null;
  if (s.placeId) {
    const p = placeById(s.placeId);
    return p ? { lat: p.lat, lon: p.lon, label: p.name } : null;
  }
  if (typeof s.lat !== 'number' || typeof s.lon !== 'number') return null;
  const pt = { lat: s.lat, lon: s.lon };
  if (!onIsland(pt)) return null;
  const label = (typeof s.label === 'string' ? s.label : '').trim().slice(0, 80) || 'Pinned location';
  return { ...pt, label };
}

const ERR: Record<string, string> = {
  off_island: 'Pickup and drop-off must be on Roatán',
  too_many_riders: 'Up to 12 people per van. Book two rides for bigger groups.',
  too_close: 'Pickup and drop-off are the same place',
  too_far: 'That ride is too long to book in the app. Contact us.',
  bad_riders: 'Riders must be 1–12',
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const b = await readBody<Body>(req);
    if (!b) return fail(400, 'bad_json', 'Body must be JSON');
    const from = resolve(b.pickup);
    const to = resolve(b.dropoff);
    if (!from || !to) return fail(400, 'off_island', ERR.off_island);
    if (b.timing !== 'now' && b.timing !== 'scheduled') return fail(400, 'bad_timing', 'timing must be now or scheduled');
    if (b.vehicle && b.vehicle !== 'car' && b.vehicle !== 'van') return fail(400, 'bad_vehicle', 'vehicle must be car or van');

    let scheduledFor: string | null = null;
    if (b.timing === 'scheduled') {
      const at = new Date(b.scheduledFor ?? '');
      const now = Date.now();
      if (Number.isNaN(at.getTime()) || at.getTime() < now + 30 * 60_000 || at.getTime() > now + LAND_PRICING.maxDaysAhead * 86_400_000) {
        return fail(400, 'bad_time', `Book at least 30 minutes and at most ${LAND_PRICING.maxDaysAhead} days ahead`);
      }
      scheduledFor = at.toISOString();
    }

    let q;
    try {
      q = quoteLand({ from, to, riders: b.riders, vehicle: b.vehicle, timing: b.timing });
    } catch (e) {
      const code = e instanceof LandQuoteError ? e.message : 'bad_request';
      return fail(400, code, ERR[code] ?? 'Cannot price this ride');
    }

    const { data, error } = await ctx.supabaseAdmin
      .from('land_rides')
      .insert({
        guest_id: ctx.userClaims!.id,
        pickup_lat: from.lat, pickup_lon: from.lon, pickup_label: from.label,
        dropoff_lat: to.lat, dropoff_lon: to.lon, dropoff_label: to.label,
        riders: b.riders,
        vehicle_kind: q.vehicle,
        timing: b.timing,
        scheduled_for: scheduledFor,
        km: q.km,
        fare_usd: q.totalUsd,
        note: typeof b.note === 'string' ? b.note.slice(0, 300) || null : null,
      })
      .select()
      .single();
    if (error) return fail(500, 'insert_failed', error.message);
    return json({ ride: data, quote: q });
  }),
};
