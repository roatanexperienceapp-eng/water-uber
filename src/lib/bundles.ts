import { passDefinition, type PassId } from '../../supabase/functions/_shared/features.ts';
import { BUNDLE_SETTINGS, bundleQuote, type BundleQuote, type BundleTourPrice } from '../../supabase/functions/_shared/bundle.ts';
import { LISTINGS } from '@/data/catalogue';
import { readJSON, writeJSON } from '@/lib/localStore';
import { ensureSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Booking } from '@/types';

/**
 * Packages: water taxi pass + the owner's snorkel / fishing tours at a discount.
 * The app shows the price with the same rules the server charges (supabase/functions/_shared/bundle.ts).
 */
export interface PackageTourOption {
  listingId: string;
  kind: 'snorkel' | 'fishing';
  name: string;
  priceUsd: number | null; // null = no fixed price yet ("coming soon")
  unit: 'person' | 'boat' | 'day' | 'ski';
}

export function packageTourOptions(): PackageTourOption[] {
  return BUNDLE_SETTINGS.tours.map((t) => {
    const l = LISTINGS.find((x) => x.id === t.listingId);
    return {
      listingId: t.listingId,
      kind: t.kind,
      name: l?.name ?? t.listingId,
      priceUsd: l?.booking === 'instant' && l.priceUsd != null ? l.priceUsd : null,
      unit: l?.unit ?? 'person',
    };
  });
}

export interface PickedTour {
  listingId: string;
  date: string; // island date
  time: string; // island time HH:MM
}

export function quotePackage(passId: PassId, picked: PickedTour[]): BundleQuote | null {
  const pass = passDefinition(passId);
  const opts = packageTourOptions();
  const tours: BundleTourPrice[] = [];
  for (const p of picked) {
    const o = opts.find((x) => x.listingId === p.listingId);
    if (!o || o.priceUsd == null) return null;
    tours.push({ listingId: o.listingId, kind: o.kind, priceUsd: o.priceUsd, unit: o.unit });
  }
  try {
    return bundleQuote(pass.priceUsd, pass.riders, tours);
  } catch {
    return null;
  }
}

const BUNDLES_KEY = 'demo.bundles';
type DemoBundle = { id: string; passId: string; bookingIds: string[]; totalCents: number; status: 'awaiting_payment' | 'paid' };

/** Creates the package (pass + tour bookings), awaiting one payment: pay({ bundleId }). */
export async function createPackage(passId: PassId, picked: PickedTour[]): Promise<{ bundleId: string; passRowId: string; totalCents: number }> {
  if (!supabase) {
    const q = quotePackage(passId, picked);
    if (!q) throw new Error('bad_package');
    const pass = passDefinition(passId);
    const newId = () => Math.random().toString(36).slice(2, 10).toUpperCase();
    const passRowId = newId();
    writeJSON('demo.passes', [{ id: passRowId, passId, startsAt: new Date().toISOString(), ridesUsed: 0, status: 'awaiting_payment' }, ...readJSON<unknown[]>('demo.passes', [])]);
    const bookings: Booking[] = picked.map((p) => {
      const l = LISTINGS.find((x) => x.id === p.listingId)!;
      return {
        id: newId(), listingId: l.id, listingName: l.name, date: p.date, time: p.time, quantity: pass.riders,
        totalUsd: l.unit === 'person' ? l.priceUsd! * pass.riders : l.priceUsd!, status: 'awaiting_payment', createdAt: new Date().toISOString(), ticketCode: newId(),
      };
    });
    writeJSON('demo.bookings', [...bookings, ...readJSON<Booking[]>('demo.bookings', [])]);
    const id = newId();
    writeJSON(BUNDLES_KEY, [{ id, passId: passRowId, bookingIds: bookings.map((b) => b.id), totalCents: q.totalCents, status: 'awaiting_payment' }, ...readJSON<DemoBundle[]>(BUNDLES_KEY, [])]);
    return { bundleId: id, passRowId, totalCents: q.totalCents };
  }
  await ensureSession();
  const { data, error } = await supabase.functions.invoke<{ bundle: Record<string, unknown> }>('create-bundle', { body: { passType: passId, tours: picked } });
  if (error || !data) {
    const ctx = (error as { context?: Response } | null)?.context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    throw new Error(payload?.code ?? 'bundle_failed');
  }
  return { bundleId: String(data.bundle.id), passRowId: String(data.bundle.pass_id), totalCents: Number(data.bundle.total_cents) };
}

/** Demo mode only: the simulated processor confirms the whole package. */
export async function demoPayPackage(bundleId: string): Promise<number> {
  const all = readJSON<DemoBundle[]>(BUNDLES_KEY, []);
  const b = all.find((x) => x.id === bundleId);
  if (!b) return 0;
  writeJSON(BUNDLES_KEY, all.map((x) => (x.id === bundleId ? { ...x, status: 'paid' as const } : x)));
  const { demoActivatePass } = await import('@/lib/stay');
  await demoActivatePass(b.passId);
  const bookings = readJSON<Booking[]>('demo.bookings', []).map((x) => (b.bookingIds.includes(x.id) ? { ...x, status: 'paid' as const } : x));
  writeJSON('demo.bookings', bookings);
  const { demoInboxAdd } = await import('@/lib/inbox');
  for (const x of bookings.filter((y) => b.bookingIds.includes(y.id))) {
    demoInboxAdd({ category: 'update', title: 'Your ticket is ready', body: `${x.listingName} on ${x.date} at ${x.time}. Your ticket works offline: open it from Trips.`, ctaLabel: 'Open ticket', ctaPath: `/ticket/${x.id}`, audience: 'all' });
  }
  return b.totalCents / 100;
}
