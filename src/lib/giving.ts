import { readJSON, writeJSON } from '@/lib/localStore';
import { ensureSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * Giving: guest donations to the charity we support, plus the app's pledge (10% of what the app earns).
 * Apple rule (App Review 3.2.1(vi) / 3.2.2(iv)): unless the charity is an Apple-approved nonprofit, the iOS app
 * must not collect donations itself — it opens this same page on the website, where payment happens.
 */
export interface GivingPublic {
  charityName: string;
  pledgePct: number;
  raisedCents: number;
  donors: number;
  givenCents: number;
  lastGivenOn?: string;
}

export const DONATION_PRESETS = [5, 10, 25, 50];
export const DONATION_MIN = 1;
export const DONATION_MAX = 5000;

const DEMO_KEY = 'demo.donations';
type DemoDonation = { id: string; amount: number; status: 'awaiting_payment' | 'paid' };

export async function givingPublic(): Promise<GivingPublic> {
  if (!supabase) {
    const paid = readJSON<DemoDonation[]>(DEMO_KEY, []).filter((d) => d.status === 'paid');
    return { charityName: 'Every Child Roatán', pledgePct: 10, raisedCents: paid.reduce((s, d) => s + d.amount * 100, 0), donors: paid.length, givenCents: 0 };
  }
  const { data, error } = await supabase.rpc('giving_public');
  if (error) throw error;
  const r = (data as Record<string, unknown>[])[0];
  return {
    charityName: String(r.charity_name),
    pledgePct: Number(r.pledge_pct),
    raisedCents: Number(r.raised_cents),
    donors: Number(r.donors),
    givenCents: Number(r.given_cents),
    lastGivenOn: (r.last_given_on as string) ?? undefined,
  };
}

/** Creates the donation (server checks the amount). Pay it with pay({ donationId }) on the website. */
export async function startDonation(amountUsd: number, message?: string): Promise<string> {
  if (!supabase) {
    const id = Math.random().toString(36).slice(2, 10).toUpperCase();
    writeJSON(DEMO_KEY, [{ id, amount: amountUsd, status: 'awaiting_payment' }, ...readJSON<DemoDonation[]>(DEMO_KEY, [])]);
    return id;
  }
  await ensureSession();
  const { data, error } = await supabase.rpc('create_donation', { p_amount: amountUsd, p_message: message ?? null });
  if (error) throw new Error(error.message.includes('bad_amount') ? 'bad_amount' : error.message);
  return String((data as { id: string }).id);
}

/** Demo mode only: the simulated processor marks the donation paid. */
export function demoMarkDonationPaid(id: string): number {
  const list = readJSON<DemoDonation[]>(DEMO_KEY, []);
  writeJSON(DEMO_KEY, list.map((d) => (d.id === id ? { ...d, status: 'paid' as const } : d)));
  return list.find((d) => d.id === id)?.amount ?? 0;
}
