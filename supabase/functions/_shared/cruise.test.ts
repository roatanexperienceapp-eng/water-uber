import { deepStrictEqual as eq, ok } from 'node:assert';
import { crowdFor, fitsPortTime, roatanDate, roatanInstant, splitDeadline, startWindow, transferMinutes, type ShipCall } from './cruise.ts';

// Coxen Hole call: docks 8:00, all aboard 17:00 (Roatán time). Must be back at the port by 16:00.
const call: ShipCall = { id: 'c1', date: '2026-10-20', ship: 'Test', port: 'coxen', arriveAt: roatanInstant('2026-10-20', '08:00'), allAboardAt: roatanInstant('2026-10-20', '17:00') };

Deno.test('transfer times by port and area', () => {
  eq(transferMinutes('coxen', 'West Bay'), 30);
  eq(transferMinutes('mahogany', 'West Bay'), 45);
  eq(transferMinutes('coxen', 'Somewhere else'), null);
});

Deno.test('port time maths is exact', () => {
  const r = fitsPortTime(call, { area: 'West End', portal: 'snork', start: roatanInstant('2026-10-20', '10:00') });
  // back at port 10:00 + 150 + 25 = 12:55; deadline 16:00 → 185 min spare
  ok(r.fits && r.spareMinutes === 185);
  const late = fitsPortTime(call, { area: 'West End', portal: 'snork', start: roatanInstant('2026-10-20', '13:30') });
  ok(!late.fits && late.reason === 'too_late'); // back 16:25
  const early = fitsPortTime(call, { area: 'West End', portal: 'snork', start: roatanInstant('2026-10-20', '08:30') });
  ok(!early.fits && early.reason === 'too_early'); // can't be at West End before 8:55
  const unknown = fitsPortTime(call, { area: 'Utila', portal: 'snork', start: roatanInstant('2026-10-20', '10:00') });
  ok(!unknown.fits && unknown.reason === 'unknown_area');
  const w = startWindow(call, { area: 'West End', portal: 'snork' })!;
  eq(w.earliest.toISOString(), roatanInstant('2026-10-20', '08:55').toISOString());
  eq(w.latest.toISOString(), roatanInstant('2026-10-20', '13:05').toISOString());
});

Deno.test('crowd meter from ships in port', () => {
  const c2 = { ...call, id: 'c2', passengers: 6000 };
  eq(crowdFor([call], '2026-10-20').level, 'quiet'); // 1 ship, assumed 3,500
  eq(crowdFor([call, c2], '2026-10-20').level, 'very_busy'); // 9,500
  eq(crowdFor([call, c2], '2026-10-21').ships, 0);
});

Deno.test('island dates and split deadlines', () => {
  eq(roatanDate(new Date('2026-10-21T01:00:00Z')), '2026-10-20'); // 7 pm in Roatán is still the 20th
  const now = roatanInstant('2026-10-20', '08:00');
  eq(splitDeadline(now, roatanInstant('2026-10-20', '13:00'))!.toISOString(), roatanInstant('2026-10-20', '12:00').toISOString());
  eq(splitDeadline(now, roatanInstant('2026-10-20', '09:10')), null); // too close to split
});
