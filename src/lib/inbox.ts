import { useCallback, useEffect, useState } from 'react';
import { getMyShip } from '@/lib/cruise';
import { readJSON, writeJSON } from '@/lib/localStore';
import { ensureSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * Guest inbox: Offers, Support, Updates, Priority.
 * Priority is reserved for safety and trip alerts (the database refuses promotions there).
 * Live mode reads `inbox_messages` (RLS shows broadcasts + the guest's own); demo mode keeps a local list.
 */
export type InboxCategory = 'offer' | 'support' | 'update' | 'priority';
export type InboxAudience = 'all' | 'cruise' | 'stay';

export interface InboxMessage {
  id: string;
  category: InboxCategory;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaPath?: string;
  audience: InboxAudience;
  personal: boolean;
  source: 'team' | 'system';
  createdAt: string;
  read: boolean;
}

export interface NewInboxMessage {
  category: InboxCategory;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaPath?: string;
  audience: InboxAudience;
  expiresInDays?: number;
}

type Row = Record<string, unknown>;
const DEMO_KEY = 'demo.inbox';
const READ_KEY = 'demo.inboxRead';

// ---------- change notifications (badge refresh) ----------
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

// ---------- demo content ----------
function demoSeed(): (Omit<InboxMessage, 'read'> & { expiresAt?: string })[] {
  const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  return [
    { id: 'd-pri', category: 'priority', title: 'Priority is for safety only', body: "You'll only get Priority messages for things that affect your trip: rough water, schedule changes, your ship's all-aboard time or a cancelled booking. Never ads.", audience: 'all', personal: false, source: 'system', createdAt: ago(0.2) },
    { id: 'd-off1', category: 'offer', title: 'Beat the cruise crowds', body: 'Book your West Bay water taxi before 10 am and skip the lines. (Demo offer)', ctaLabel: 'Book a ride', ctaPath: '/', audience: 'all', personal: false, source: 'team', createdAt: ago(1) },
    { id: 'd-off2', category: 'offer', title: 'Staying a week? Ride all week for $49', body: 'Unlimited West End ↔ West Bay rides with a week pass. Pays for itself after 10 rides. (Demo offer)', ctaLabel: 'See passes', ctaPath: '/pass', audience: 'stay', personal: false, source: 'team', createdAt: ago(5) },
    { id: 'd-off3', category: 'offer', title: 'Snorkel the shipwreck, back before all-aboard', body: 'Port pickup at the gate and a guaranteed return for your ship. (Demo offer)', ctaLabel: 'See snorkel trips', ctaPath: '/portal/snork', audience: 'cruise', personal: false, source: 'team', createdAt: ago(3) },
    { id: 'd-upd', category: 'update', title: 'Your tickets work offline', body: 'Paid tours show a QR ticket in Trips. It opens with no signal, so you can show it to your guide anywhere on the island.', ctaLabel: 'Open Trips', ctaPath: '/trips', audience: 'all', personal: false, source: 'system', createdAt: ago(20) },
    { id: 'd-sup', category: 'support', title: 'Need help? We answer fast', body: 'Ask Isla any time, day or night. For changes to a booking, message your operator on WhatsApp from the ticket after payment.', ctaLabel: 'Ask Isla', ctaPath: '/assistant', audience: 'all', personal: false, source: 'team', createdAt: ago(30) },
  ];
}

function demoAll() {
  const extra = readJSON<(Omit<InboxMessage, 'read'> & { expiresAt?: string })[]>(DEMO_KEY, []);
  const now = Date.now();
  return [...extra, ...demoSeed()].filter((m) => !m.expiresAt || Date.parse(m.expiresAt) > now);
}

/** Demo mode: the app adds system messages itself (live mode does this in the database). */
export function demoInboxAdd(m: Omit<InboxMessage, 'id' | 'read' | 'createdAt' | 'personal' | 'source'>): void {
  if (supabase) return;
  const item = { ...m, id: `d-${Math.random().toString(36).slice(2, 10)}`, personal: true, source: 'system' as const, createdAt: new Date().toISOString() };
  writeJSON(DEMO_KEY, [item, ...readJSON<unknown[]>(DEMO_KEY, [])]);
  changed();
}

// ---------- audience: cruise visitors vs week-stay guests ----------
function forThisGuest(m: { audience: InboxAudience; shipCallId?: string | null }): boolean {
  const ship = getMyShip();
  if (m.shipCallId) return ship?.id === m.shipCallId;
  if (m.audience === 'cruise') return !!ship;
  if (m.audience === 'stay') return !ship;
  return true;
}

function localized(r: Row, lang: string): { title: string; body: string } {
  const tr = (r.translations as Record<string, { title?: string; body?: string }> | null)?.[lang];
  return { title: tr?.title || String(r.title), body: tr?.body || String(r.body) };
}

export async function listInbox(lang: string): Promise<InboxMessage[]> {
  if (!supabase) {
    const read = new Set(readJSON<string[]>(READ_KEY, []));
    return demoAll()
      .filter(forThisGuest)
      .map((m) => ({ ...m, read: read.has(m.id) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  await ensureSession();
  const [{ data, error }, { data: reads }] = await Promise.all([
    supabase.from('inbox_messages').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('inbox_reads').select('message_id'),
  ]);
  if (error) throw error;
  const read = new Set((reads ?? []).map((r: Row) => String(r.message_id)));
  return (data ?? [])
    .filter((r: Row) => forThisGuest({ audience: r.audience as InboxAudience, shipCallId: r.ship_call_id as string | null }))
    .map((r: Row) => ({
      id: String(r.id),
      category: r.category as InboxCategory,
      ...localized(r, lang),
      ctaLabel: (r.cta_label as string) ?? undefined,
      ctaPath: (r.cta_path as string) ?? undefined,
      audience: r.audience as InboxAudience,
      personal: !!r.guest_id,
      source: r.source as 'team' | 'system',
      createdAt: String(r.created_at),
      read: read.has(String(r.id)),
    }));
}

export async function markRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  if (!supabase) {
    writeJSON(READ_KEY, [...new Set([...readJSON<string[]>(READ_KEY, []), ...ids])]);
  } else {
    await ensureSession();
    const { error } = await supabase.rpc('mark_inbox_read', { p_ids: ids });
    if (error) throw error;
  }
  changed();
}

/** Staff only (RLS: admins). In demo mode anyone can try it; messages stay on this phone. */
export async function sendInbox(m: NewInboxMessage): Promise<void> {
  const expires = m.expiresInDays ? new Date(Date.now() + m.expiresInDays * 86_400_000).toISOString() : undefined;
  if (!supabase) {
    const item = { ...m, id: `d-${Math.random().toString(36).slice(2, 10)}`, personal: false, source: 'team' as const, createdAt: new Date().toISOString(), expiresAt: expires };
    writeJSON(DEMO_KEY, [item, ...readJSON<unknown[]>(DEMO_KEY, [])]);
    changed();
    return;
  }
  const { error } = await supabase.from('inbox_messages').insert({
    category: m.category,
    title: m.title,
    body: m.body,
    cta_label: m.ctaLabel || null,
    cta_path: m.ctaPath || null,
    audience: m.audience,
    expires_at: expires ?? null,
  });
  if (error) throw new Error(error.message.includes('offers_are_not_priority') ? 'offers_are_not_priority' : error.message);
  changed();
}

/** Whether this user may send inbox messages. Demo mode: yes (to try it out). */
export async function canSendInbox(): Promise<boolean> {
  if (!supabase) return true;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data } = await supabase.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  return data?.role === 'admin';
}

/** Unread count for the tab badge. Refreshes every minute and whenever the inbox changes. */
export function useUnreadCount(lang: string): number {
  const [n, setN] = useState(0);
  const load = useCallback(() => {
    listInbox(lang)
      .then((ms) => setN(ms.filter((m) => !m.read).length))
      .catch(() => {});
  }, [lang]);
  useEffect(() => {
    load();
    listeners.add(load);
    const id = setInterval(load, 60_000);
    return () => {
      listeners.delete(load);
      clearInterval(id);
    };
  }, [load]);
  return n;
}

/** Only in-app destinations, never outside links. Mirrors the database check. */
export function safeInboxPath(p?: string): string | null {
  return p && /^\/[A-Za-z0-9_\-/?=&%.[\]]*$/.test(p) && !p.startsWith('//') ? p : null;
}
