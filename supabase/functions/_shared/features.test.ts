// Run: deno test supabase/functions/_shared/
import { deepStrictEqual as eq, ok } from 'node:assert';
import {
  conditionAdvice, dockForArea, FEATURE_SETTINGS, guaranteeState, joinableBoats, nextOccurrences, nightMode,
  PASS_GROUP_SIZES, passBreakEvenRides, passCovers, passFor, passSizeFor, pickupForActivity, ridesLeft, routeCondition, sharedDeparture,
} from './features.ts';

const T = (iso: string) => new Date(iso);

Deno.test('guarantee: needs confirmation 15 min before, then reassigns, then credits', () => {
  const pickupAt = T('2026-11-02T15:00:00Z');
  eq(guaranteeState({ pickupAt, now: T('2026-11-02T14:30:00Z'), captainConfirmed: false, boarded: false }), 'scheduled');
  eq(guaranteeState({ pickupAt, now: T('2026-11-02T14:50:00Z'), captainConfirmed: false, boarded: false }), 'reassign');
  eq(guaranteeState({ pickupAt, now: T('2026-11-02T14:50:00Z'), captainConfirmed: true, boarded: false }), 'confirmed');
  eq(guaranteeState({ pickupAt, now: T('2026-11-02T15:05:00Z'), captainConfirmed: true, boarded: false }), 'late');
  eq(guaranteeState({ pickupAt, now: T('2026-11-02T15:11:00Z'), captainConfirmed: true, boarded: false }), 'missed');
  eq(guaranteeState({ pickupAt, now: T('2026-11-02T15:30:00Z'), captainConfirmed: true, boarded: true }), 'confirmed');
});

Deno.test('night: uses Roatán time (UTC-6) and the monthly sunset', () => {
  eq(nightMode(T('2026-11-02T18:00:00Z')), 'day'); // noon in Roatán
  eq(nightMode(T('2026-11-02T23:45:00Z')), 'night'); // 5:45 pm, after Nov sunset (~5:20)
  eq(nightMode(T('2026-06-15T23:45:00Z')), 'day'); // 5:45 pm in June, before sunset (~6:18)
  eq(nightMode(T('2026-11-03T04:30:00Z')), 'boats_closed'); // 10:30 pm
  eq(nightMode(T('2026-11-03T10:00:00Z')), 'boats_closed'); // 4 am
});

Deno.test('shared seats: only same route, enough room, leaving within the wait window', () => {
  const now = T('2026-11-02T15:00:00Z');
  const boats = [
    { id: 'a', from: 'we', to: 'inf', departsAt: T('2026-11-02T15:06:00Z'), seatsTaken: 2, seatsTotal: 8 },
    { id: 'b', from: 'we', to: 'ban', departsAt: T('2026-11-02T15:03:00Z'), seatsTaken: 1, seatsTotal: 8 },
    { id: 'c', from: 'we', to: 'inf', departsAt: T('2026-11-02T15:40:00Z'), seatsTaken: 1, seatsTotal: 8 },
    { id: 'd', from: 'we', to: 'inf', departsAt: T('2026-11-02T15:02:00Z'), seatsTaken: 7, seatsTotal: 8 },
  ];
  eq(joinableBoats(boats, { from: 'we', to: 'inf', riders: 2, now }).map((b) => b.id), ['a']);
  eq(joinableBoats(boats, { from: 'we', to: 'inf', riders: 1, now }).map((b) => b.id), ['d', 'a']);
  eq(sharedDeparture(now, 3).leavesNow, true);
  eq(sharedDeparture(now, 1).departsAt.getTime(), now.getTime() + FEATURE_SETTINGS.shared.maxWaitMinutes * 60_000);
});

Deno.test('passes: cover flat-zone rides only, within dates, riders and ride count', () => {
  const pass = { passId: 'week2' as const, startsAt: T('2026-11-01T12:00:00Z'), ridesUsed: 3 };
  const at = T('2026-11-03T15:00:00Z');
  eq(passCovers(pass, { from: 'we', to: 'inf', riders: 1, at }).covered, true);
  eq(passCovers(pass, { from: 'we', to: 'sandyD', riders: 1, at }).reason, 'outside_zone');
  eq(passCovers(pass, { from: 'we', to: 'inf', riders: 2, at }).fareUsd, 0); // 2-person pass covers both
  eq(passCovers(pass, { from: 'we', to: 'inf', riders: 3, at }).fareUsd, 5); // a friend tagging along pays $5
  eq(passCovers(pass, { from: 'we', to: 'inf', riders: 1, at }).fareUsd, 0);
  eq(passCovers(pass, { from: 'we', to: 'inf', riders: 1, at: T('2026-11-09T15:00:00Z') }).reason, 'expired');
  eq(passCovers(null, { from: 'we', to: 'inf', riders: 1, at }).reason, 'no_pass');
  eq(ridesLeft(pass), null); // unlimited
  eq(passBreakEvenRides('week2'), 7); // $70 ÷ ($5 × 2 people)
  const twoWeeks = { passId: 'twoWeek4' as const, startsAt: T('2026-11-01T12:00:00Z'), ridesUsed: 0 };
  eq(passCovers(twoWeeks, { from: 'we', to: 'inf', riders: 4, at: T('2026-11-13T15:00:00Z') }).covered, true); // day 12
});

Deno.test('pass prices: $35 per person per week, two weeks is double, every group size', () => {
  for (const n of PASS_GROUP_SIZES) {
    eq(passFor(n, 7)!.priceUsd, 35 * n);
    eq(passFor(n, 14)!.priceUsd, 70 * n);
  }
  eq(passFor(2, 7)!.priceUsd, 70);
  eq(passFor(12, 7)!.priceUsd, 420);
  eq(passFor(2, 14)!.priceUsd, 140);
  eq(passSizeFor(1), 2);
  eq(passSizeFor(3), 4);
  eq(passSizeFor(12), 12);
  eq(passSizeFor(15), 12);
});

Deno.test('repeat rides: right local time, right weekdays, stops at end date', () => {
  const rule = { time: '08:30', weekdays: [1, 3, 5], startDate: '2026-11-02', endDate: '2026-11-08' }; // Mon Wed Fri
  const out = nextOccurrences(rule, T('2026-11-01T00:00:00Z'), 10);
  eq(out.map((d) => d.toISOString()), ['2026-11-02T14:30:00.000Z', '2026-11-04T14:30:00.000Z', '2026-11-06T14:30:00.000Z']);
  eq(nextOccurrences({ ...rule, weekdays: [] }, T('2026-11-01T00:00:00Z'), 50).length, 7);
});

Deno.test('sea conditions: worst fresh report on the route wins; old reports ignored', () => {
  const now = T('2026-11-02T15:00:00Z');
  const reports = [
    { area: 'west' as const, state: 'calm' as const, reportedAt: T('2026-11-02T14:00:00Z') },
    { area: 'north' as const, state: 'choppy' as const, reportedAt: T('2026-11-02T14:30:00Z') },
    { area: 'south' as const, state: 'rough' as const, reportedAt: T('2026-11-02T09:00:00Z') },
  ];
  eq(routeCondition(reports, 'we', 'inf', now).state, 'calm');
  eq(routeCondition(reports, 'we', 'sandyD', now).state, 'choppy');
  eq(routeCondition(reports, 'we', 'coxenD', now).state, 'calm'); // south report is stale
  eq(conditionAdvice('rough'), 'land_taxi');
  eq(conditionAdvice('choppy'), 'expect_spray');
});

Deno.test('activity rides: arrive 15 minutes early; areas map to docks', () => {
  const start = T('2026-11-02T15:00:00Z');
  eq(pickupForActivity(start, 11).toISOString(), '2026-11-02T14:34:00.000Z');
  eq(dockForArea('West Bay'), 'inf');
  eq(dockForArea('West End · Half Moon Bay'), 'hmb');
  eq(dockForArea('French Cay'), null);
  ok(true);
});
