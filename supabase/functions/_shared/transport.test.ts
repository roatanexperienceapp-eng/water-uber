import { deepStrictEqual as eq, ok } from 'node:assert';
import { distanceKm, gettingThere, meetingPoint, timingFor, VAN_SETTINGS, vanPlan, vanPriceUsd, vansFor } from './transport.ts';
import { DOCKS } from './geo.ts';
import type { ShipCall } from './cruise.ts';

const dock = (id: string) => DOCKS.find((d) => d.id === id)!;
const at = (hhmm: string) => new Date(`2026-11-05T${hhmm}:00-06:00`);
const ship: ShipCall = { id: 's', date: '2026-11-05', ship: 'Test', port: 'coxen', arriveAt: at('08:00'), allAboardAt: at('17:00') };

Deno.test('van price and van count', () => {
  eq(vanPriceUsd(5), 125);
  eq(VAN_SETTINGS.seatsPerVan, 12);
  eq(vansFor(12), 1);
  eq(vansFor(13), 2);
  eq(vansFor(0), 1);
});

Deno.test('van plan: waits 45 min at the gate and still drops guests 15 min early', () => {
  // Coxen → West End is 25 min. Tour 10:00, 4 h fishing. At the gate 08:35, leaves by 09:20, there 09:45.
  const p = vanPlan(ship, { area: 'West End', portal: 'fish', start: at('10:00'), people: 4 })!;
  eq(VAN_SETTINGS.waitMinutes, 45);
  eq(p.pickupAt.getTime(), at('08:35').getTime());
  eq(p.leavesAt.getTime(), at('09:20').getTime());
  eq(p.arriveAt.getTime(), at('09:45').getTime());
  ok(p.onTime);
  eq(p.returnPickupAt.getTime(), at('14:00').getTime());
  eq(p.backAtPort.getTime(), at('14:25').getTime());
  eq(p.vans, 1);
});

Deno.test('van is never at the gate before guests are off the ship; too-early tours are flagged', () => {
  // Ship docks 08:00, off by 08:30; tour at 09:00 → van at the gate 08:30, leaves 09:15, there 09:40: too late.
  const p = vanPlan(ship, { area: 'West End', portal: 'snork', start: at('09:00'), people: 2 })!;
  eq(p.pickupAt.getTime(), at('08:30').getTime());
  eq(p.onTime, false);
  // Earliest West End start with the van: 08:30 + 45 + 25 + 15 = 09:55.
  ok(vanPlan(ship, { area: 'West End', portal: 'snork', start: at('09:55'), people: 2 })!.onTime);
  ok(!vanPlan(ship, { area: 'West End', portal: 'snork', start: at('09:50'), people: 2 })!.onTime);
});

Deno.test('unknown area has no van plan', () => {
  eq(vanPlan(ship, { area: 'Utila', portal: 'dive', start: at('10:00'), people: 2 }), null);
});

Deno.test('meeting point: listing coordinates, else the area dock', () => {
  eq(meetingPoint({ lat: 16.3, lon: -86.5, area: 'x' }), { lat: 16.3, lon: -86.5 });
  eq(meetingPoint({ meetingLat: 16.31, meetingLon: -86.51, lat: 16.3, lon: -86.5, area: 'x' }), { lat: 16.31, lon: -86.51 });
  const we = meetingPoint({ area: 'West End' })!;
  eq(we.dockId, 'we');
  eq(meetingPoint({ area: 'Nowhere' }), null);
});

Deno.test('already at the meeting point', () => {
  const we = dock('we');
  ok(gettingThere({ lat: we.lat, lon: we.lon + 0.0005 }, { lat: we.lat, lon: we.lon, dockId: 'we' }, 2).arrived);
});

Deno.test('close by: walking is the suggestion', () => {
  const we = dock('we');
  const g = gettingThere({ lat: we.lat + 0.004, lon: we.lon }, { lat: we.lat, lon: we.lon, dockId: 'we' }, 2);
  eq(g.best?.mode, 'walk');
});

Deno.test('at West Bay going to West End: water taxi from the nearest dock is suggested', () => {
  const inf = dock('inf'), we = dock('we');
  const g = gettingThere({ lat: inf.lat, lon: inf.lon + 0.001 }, { lat: we.lat, lon: we.lon, dockId: 'we' }, 3);
  const taxi = g.options.find((o) => o.mode === 'taxi')!;
  ok(taxi, 'taxi offered');
  eq(taxi.fromDock, 'inf');
  eq(taxi.fareUsd, 20); // private boat minimum inside the $5 zone
  eq(g.best?.mode, 'taxi');
  ok(g.options.some((o) => o.mode === 'van'));
});

Deno.test('far from any dock (French Harbour): the van is the way', () => {
  const we = dock('we');
  const g = gettingThere({ lat: 16.3545, lon: -86.4655 }, { lat: we.lat, lon: we.lon, dockId: 'we' }, 2);
  eq(g.best?.mode, 'van');
  ok(!g.options.some((o) => o.mode === 'walk'));
  ok(distanceKm({ lat: 16.3545, lon: -86.4655 }, we) > 10);
});

Deno.test('timing: early, leave now, late', () => {
  const start = at('10:00');
  eq(timingFor(at('08:00'), start, 30).status, 'early');
  eq(timingFor(at('08:00'), start, 30).leaveBy.getTime(), at('09:15').getTime());
  eq(timingFor(at('09:12'), start, 30).status, 'leave_now');
  const late = timingFor(at('09:45'), start, 30);
  eq(late.status, 'late');
  eq(late.minutesLate, 15);
});
