import { expect, jest, test } from '@jest/globals';
import { lempiras, money, toHnlPer } from './fx';

jest.mock('@/lib/localStore', () => ({ readJSON: (_k: string, f: unknown) => f, writeJSON: () => {} }));

const perUsd = { HNL: 26.872312, CAD: 1.414714, EUR: 0.889614, GBP: 0.750845, MXN: 18.465451, GTQ: 7.641331, AUD: 1.439806 };

test('lempiras per unit of each currency', () => {
  const r = toHnlPer(perUsd)!;
  expect(r.USD).toBeCloseTo(26.8723, 3);
  expect(r.CAD).toBeCloseTo(18.995, 2); // 26.87 / 1.4147
  expect(r.EUR).toBeCloseTo(30.207, 2);
  expect(r.GTQ).toBeCloseTo(3.517, 2);
});

test('a broken feed never reaches guests', () => {
  expect(toHnlPer({ ...perUsd, HNL: 0 })).toBeNull();
  expect(toHnlPer({ ...perUsd, HNL: 2687 })).toBeNull(); // decimal-point error upstream
  const { GBP, ...noGbp } = perUsd;
  void GBP;
  expect(toHnlPer(noGbp)).toBeNull();
});

test('formatting without Intl', () => {
  expect(lempiras(26.872)).toBe('L 26.87');
  expect(lempiras(2687.2)).toBe('L 2,687');
  expect(money(1234.5, '$')).toBe('$1,234.50');
});
