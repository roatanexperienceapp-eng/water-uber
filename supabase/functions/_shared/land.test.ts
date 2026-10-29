import { deepStrictEqual as eq, ok, throws } from 'node:assert';
import { LAND_PLACES, LAND_PRICING, onIsland, pickupEta, placeById, quoteLand, vehicleFor } from './land.ts';

const P = (id: string) => placeById(id)!;

Deno.test('all places are on the island and have unique ids', () => {
  ok(LAND_PLACES.every(onIsland));
  eq(new Set(LAND_PLACES.map((p) => p.id)).size, LAND_PLACES.length);
});

Deno.test('vehicle by group size', () => {
  eq(vehicleFor(1), 'car');
  eq(vehicleFor(4), 'car');
  eq(vehicleFor(5), 'van');
  eq(vehicleFor(12), 'van');
  eq(vehicleFor(13), null);
});

Deno.test('airport to West Bay by car is a fair island price', () => {
  const q = quoteLand({ from: P('airport'), to: P('westBay'), riders: 2, timing: 'now' });
  eq(q.vehicle, 'car');
  ok(q.km > 8 && q.km < 14, `km ${q.km}`);
  ok(q.fareUsd >= 20 && q.fareUsd <= 30, `fare ${q.fareUsd}`);
  eq(q.totalUsd, q.fareUsd);
});

Deno.test('van for 6 people costs more; scheduled adds the fee', () => {
  const car = quoteLand({ from: P('portCoxen'), to: P('westEnd'), riders: 4, timing: 'now' });
  const van = quoteLand({ from: P('portCoxen'), to: P('westEnd'), riders: 6, timing: 'scheduled' });
  eq(van.vehicle, 'van');
  ok(van.fareUsd > car.fareUsd);
  eq(van.totalUsd, van.fareUsd + LAND_PRICING.scheduledFeeUsd);
  // A small group may still ask for the van.
  eq(quoteLand({ from: P('portCoxen'), to: P('westEnd'), riders: 2, vehicle: 'van', timing: 'now' }).vehicle, 'van');
});

Deno.test('minimum fare on short rides', () => {
  const q = quoteLand({ from: P('westEnd'), to: P('westEndDock'), riders: 1, timing: 'now' });
  eq(q.fareUsd, LAND_PRICING.car.minUsd);
});

Deno.test('refuses off-island, too many riders, same spot', () => {
  throws(() => quoteLand({ from: { lat: 25.76, lon: -80.19 }, to: P('westBay'), riders: 1, timing: 'now' }), /off_island/);
  throws(() => quoteLand({ from: P('airport'), to: P('westBay'), riders: 13, timing: 'now' }), /too_many_riders/);
  throws(() => quoteLand({ from: P('airport'), to: P('airport'), riders: 1, timing: 'now' }), /too_close/);
});

Deno.test('pickup ETA uses the nearest free vehicle that fits', () => {
  const at = P('westBay');
  const cars = [
    { id: 'a', kind: 'car' as const, seats: 4, available: true, lat: P('airport').lat, lon: P('airport').lon },
    { id: 'b', kind: 'car' as const, seats: 4, available: false, lat: at.lat, lon: at.lon },
    { id: 'c', kind: 'van' as const, seats: 12, available: true, lat: P('frenchHarbour').lat, lon: P('frenchHarbour').lon },
  ];
  const carEta = pickupEta(cars, at, 'car')!;
  const vanEta = pickupEta(cars, at, 'van')!;
  ok(carEta > 10 && carEta < 30, `car ${carEta}`);
  ok(vanEta > carEta);
  eq(pickupEta([], at, 'car'), null);
});
