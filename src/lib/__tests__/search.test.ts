import { expect, test } from '@jest/globals';
import { LISTINGS, PORTALS } from '@/data/catalogue';
import { normalize, searchListings } from '@/lib/search';

const names = (q: string, lang: 'en' | 'es' = 'en') => searchListings(q, LISTINGS, PORTALS, lang).hits.map((h) => h.listing.name);
const portalsOf = (q: string) => searchListings(q, LISTINGS, PORTALS).hits.slice(0, 5).map((h) => h.listing.portal);

test('normalize strips accents and case', () => {
  expect(normalize('Farmacia SIMÁN!')).toBe('farmacia siman');
});

test('finds a business by exact name', () => {
  expect(names('Wahoo Slayer')[0]).toBe('Wahoo Slayer Fishing Charter');
  expect(names('infinity bay')[0]).toMatch(/Infinity Bay/);
});

test('ignores accents and partial typing', () => {
  expect(names('siman')[0]).toBe('Farmacia Simán');
  expect(names('gumbal')[0]).toMatch(/Gumbalimba/);
});

test('product words point to the right kind of shop', () => {
  const r = searchListings('sunscreen', LISTINGS, PORTALS);
  expect(r.isProduct).toBe(true);
  expect(r.portals).toEqual(expect.arrayContaining(['rx', 'merch']));
  expect(r.hits.every((h) => ['rx', 'merch'].includes(h.listing.portal))).toBe(true);
  expect(r.hits[0].likely).toBe(true);
  expect(r.hits[0].listing.portal).toBe('rx');
});

test('Spanish words work', () => {
  expect(portalsOf('farmacia')).toContain('rx');
  expect(portalsOf('ron')).toContain('merch');
  expect(names('perezoso').some((n) => /Sloth/.test(n))).toBe(true);
});

test('activity words find the activity', () => {
  expect(portalsOf('scuba')).toEqual(expect.arrayContaining(['dive']));
  expect(portalsOf('zipline')[0]).toBe('zip');
  expect(portalsOf('doctor')[0]).toBe('med');
});

test('water taxi queries are flagged for the Ride tab', () => {
  expect(searchListings('water taxi', LISTINGS, PORTALS).isRide).toBe(true);
  expect(searchListings('sunscreen', LISTINGS, PORTALS).isRide).toBe(false);
});

test('nonsense returns nothing', () => {
  expect(names('zzqqx')).toEqual([]);
  expect(names('a')).toEqual([]);
});
