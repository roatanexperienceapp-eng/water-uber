import { describe, expect, it, jest } from '@jest/globals';
import { cruiseStartTimes, listingFit, roatanInstant, type ShipCall } from './cruise';

jest.mock('@/lib/supabase', () => ({ supabase: null }));
jest.mock('@/lib/localStore', () => ({ readJSON: (_k: string, f: unknown) => f, writeJSON: () => {} }));
jest.mock('@/i18n', () => ({ localeFor: () => 'en-US' }));

const call: ShipCall = { id: 'c', date: '2026-10-20', ship: 'X', port: 'mahogany', arriveAt: roatanInstant('2026-10-20', '07:00'), allAboardAt: roatanInstant('2026-10-20', '16:30') };
const landTour = { area: 'Coxen Hole', portal: 'land', booking: 'request' };

describe('cruise badges use the current time', () => {
  it('a 4 h tour fits in the morning', () => {
    expect(listingFit(call, landTour, roatanInstant('2026-10-20', '08:00'))).toBe('fits');
  });
  it('the same tour no longer fits at 1:30 pm', () => {
    expect(listingFit(call, landTour, roatanInstant('2026-10-20', '13:30'))).toBe('no');
  });
  it('start times are half-hour slots inside the window, island time', () => {
    const times = cruiseStartTimes(call, landTour, roatanInstant('2026-10-20', '07:00'));
    expect(times[0]).toBe('08:00'); // docks 7:00 + 30 min off the ship + 20 min drive = 7:50 → first slot 8:00
    expect(times[times.length - 1]).toBe('11:00'); // back by 15:30 − 20 min − 4 h = 11:10 → last slot 11:00
  });
  it('info listings and hotels get no badge', () => {
    expect(listingFit(call, { area: 'West End', portal: 'rx', booking: 'info' })).toBeNull();
  });
});
