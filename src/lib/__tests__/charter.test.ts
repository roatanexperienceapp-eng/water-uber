import { expect, test } from '@jest/globals';
import { bitingIsFresh } from '@/lib/charter';

const now = Date.parse('2026-11-28T12:00:00Z');

test('shows a biting report from this week', () => {
  expect(bitingIsFresh('2026-11-25', now)).toBe(true);
});

test('hides a biting report older than 7 days', () => {
  expect(bitingIsFresh('2026-11-18', now)).toBe(false);
});

test('hides a missing or bad date', () => {
  expect(bitingIsFresh(undefined, now)).toBe(false);
  expect(bitingIsFresh('soon', now)).toBe(false);
});
