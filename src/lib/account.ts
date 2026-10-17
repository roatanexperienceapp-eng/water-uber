import { useCallback, useEffect, useState } from 'react';
import { readJSON, writeJSON } from '@/lib/localStore';
import { ensureSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Account page data: profile, notification choices, help requests, partner applications, wallet, deletion. */

export interface Profile {
  email: string | null; // null = guest without email (anonymous session)
  fullName: string;
  emergencyName: string;
  emergencyPhone: string;
  notifyTrips: boolean;
  notifyOffers: boolean;
}

const PROFILE_KEY = 'demo.profile';
const FLAGS_KEY = 'account.flags';
const emptyProfile: Profile = { email: null, fullName: '', emergencyName: '', emergencyPhone: '', notifyTrips: true, notifyOffers: false };

export async function getProfile(): Promise<Profile> {
  if (!supabase) return { ...emptyProfile, ...readJSON<Partial<Profile>>(PROFILE_KEY, {}) };
  await ensureSession();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return emptyProfile;
  const { data } = await supabase.from('profiles').select('full_name, emergency_name, emergency_phone, notify_trips, notify_offers').eq('id', u.user.id).maybeSingle();
  return {
    email: u.user.email ?? null,
    fullName: data?.full_name ?? '',
    emergencyName: data?.emergency_name ?? '',
    emergencyPhone: data?.emergency_phone ?? '',
    notifyTrips: data?.notify_trips ?? true,
    notifyOffers: data?.notify_offers ?? false,
  };
}

export async function updateProfile(p: Partial<Omit<Profile, 'email'>>): Promise<void> {
  if (!supabase) {
    writeJSON(PROFILE_KEY, { ...readJSON<Partial<Profile>>(PROFILE_KEY, {}), ...p });
    return;
  }
  await ensureSession();
  const { data: u } = await supabase.auth.getUser();
  const row: Record<string, unknown> = {};
  if (p.fullName !== undefined) row.full_name = p.fullName.trim() || null;
  if (p.emergencyName !== undefined) row.emergency_name = p.emergencyName.trim() || null;
  if (p.emergencyPhone !== undefined) row.emergency_phone = p.emergencyPhone.trim() || null;
  if (p.notifyTrips !== undefined) row.notify_trips = p.notifyTrips;
  if (p.notifyOffers !== undefined) row.notify_offers = p.notifyOffers;
  const { error } = await supabase.from('profiles').update(row).eq('id', u.user!.id);
  if (error) throw new Error(error.message.includes('check') ? 'bad_phone' : error.message);
}

export const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

// ---------- Small per-phone flags (safety checkup progress) ----------
export type Flag = 'readSafety';
export function setFlag(f: Flag): void {
  writeJSON(FLAGS_KEY, { ...readJSON<Record<string, boolean>>(FLAGS_KEY, {}), [f]: true });
}
export function hasFlag(f: Flag): boolean {
  return !!readJSON<Record<string, boolean>>(FLAGS_KEY, {})[f];
}

// ---------- Help ----------
export type SupportTopic = 'ride' | 'tour' | 'payment' | 'lost' | 'safety' | 'other';

export async function sendSupportRequest(topic: SupportTopic, message: string): Promise<void> {
  if (!supabase) {
    const { demoInboxAdd } = await import('@/lib/inbox');
    demoInboxAdd(
      topic === 'safety'
        ? { category: 'priority', title: 'We got your safety report', body: 'Our team is on it now. If anyone is in danger, call 911 first.', audience: 'all' }
        : { category: 'support', title: 'We got your message', body: 'Thanks for writing. Our team replies here in your Inbox, usually within a few hours.', audience: 'all' },
    );
    return;
  }
  await ensureSession();
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('support_requests').insert({ guest_id: u.user!.id, topic, message: message.trim() });
  if (error) throw error;
}

// ---------- Drive with us / list your business ----------
export async function applyAsPartner(a: { kind: 'captain' | 'business'; name: string; whatsapp: string; businessName?: string; details?: string }): Promise<void> {
  if (!supabase) return;
  await ensureSession();
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('partner_applications').insert({
    applicant_id: u.user!.id,
    kind: a.kind,
    name: a.name.trim(),
    whatsapp: a.whatsapp.trim(),
    business_name: a.businessName?.trim() || null,
    details: a.details?.trim() || null,
  });
  if (error) throw error;
}

// ---------- Wallet: receipts ----------
export interface Receipt {
  id: string;
  kind: 'ride' | 'booking' | 'pass' | 'donation';
  amountUsd: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  at: string;
}

export async function myReceipts(): Promise<Receipt[]> {
  if (!supabase) {
    // Demo: build receipts from what was "paid" locally.
    const rides = readJSON<{ id: string; fareUsd: number; status: string; createdAt: string; coveredByPass?: boolean }[]>('demo.rides', []);
    const bookings = readJSON<{ id: string; totalUsd?: number; status: string; createdAt: string }[]>('demo.bookings', []);
    const out: Receipt[] = [
      ...rides.filter((r) => r.fareUsd > 0 && !['awaiting_payment', 'cancelled'].includes(r.status)).map((r) => ({ id: r.id, kind: 'ride' as const, amountUsd: r.fareUsd, status: 'succeeded' as const, at: r.createdAt })),
      ...bookings.filter((b) => b.totalUsd && ['paid', 'completed'].includes(b.status)).map((b) => ({ id: b.id, kind: 'booking' as const, amountUsd: b.totalUsd!, status: 'succeeded' as const, at: b.createdAt })),
    ];
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }
  await ensureSession();
  const { data, error } = await supabase.from('payments').select('id, ride_id, pass_id, donation_id, amount_usd, status, created_at').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? [])
    .filter((p) => p.status !== 'pending' || Date.parse(String(p.created_at)) > Date.now() - 3600_000)
    .map((p) => ({
      id: String(p.id),
      kind: p.ride_id ? 'ride' : p.pass_id ? 'pass' : p.donation_id ? 'donation' : 'booking',
      amountUsd: Number(p.amount_usd),
      status: p.status as Receipt['status'],
      at: String(p.created_at),
    }));
}

// ---------- Delete account ----------
export async function deleteAccount(): Promise<void> {
  if (!supabase) {
    for (const k of ['demo.profile', 'demo.places', 'demo.rides', 'demo.bookings', 'demo.passes', 'demo.repeat', 'demo.splits', 'demo.inbox', 'demo.inboxRead', 'demo.donations', 'tickets.v1', 'account.flags', 'cruise.myShip']) {
      clear(k);
    }
    return;
  }
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    throw new Error(payload?.code ?? 'delete_failed');
  }
  await supabase.auth.signOut();
  clear('tickets.v1');
  clear('cruise.myShip');
  clear(FLAGS_KEY);
}

function clear(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable: nothing to clear
  }
}

/** Reload helper for screens. */
export function useProfile(): [Profile | null, () => void] {
  const [p, setP] = useState<Profile | null>(null);
  const load = useCallback(() => {
    getProfile().then(setP).catch(() => setP(emptyProfile));
  }, []);
  useEffect(load, [load]);
  return [p, load];
}
