import Constants from 'expo-constants';
import { readJSON, writeJSON } from '@/lib/localStore';
import { currentUser, ensureSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Private feedback about the app. Only the team reads it (RLS); the guest sees their own. */
export type FeedbackKind = 'love' | 'idea' | 'confusing' | 'bug';
export interface Feedback { id: string; rating: number | null; kind: FeedbackKind; body: string; createdAt: string }

const KEY = 'demo.feedback';

export async function sendFeedback(f: { rating: number | null; kind: FeedbackKind; body: string; screen?: string }): Promise<void> {
  const body = f.body.trim();
  if (!f.rating && !body) throw new Error('empty');
  if (!supabase) {
    writeJSON(KEY, [{ id: Math.random().toString(36).slice(2), rating: f.rating, kind: f.kind, body, createdAt: new Date().toISOString() }, ...readJSON<Feedback[]>(KEY, [])]);
    return;
  }
  const s = await currentUser();
  const { error } = await supabase.from('app_feedback').insert({
    guest_id: s.user.id, rating: f.rating, kind: f.kind, body, screen: f.screen ?? null, app_version: Constants.expoConfig?.version ?? null,
  });
  if (error) throw error;
}

export async function myFeedback(): Promise<Feedback[]> {
  if (!supabase) return readJSON<Feedback[]>(KEY, []);
  await ensureSession();
  const { data } = await supabase.from('app_feedback').select('id, rating, kind, body, created_at').order('created_at', { ascending: false }).limit(20);
  return (data ?? []).map((r) => ({ id: r.id, rating: r.rating, kind: r.kind, body: r.body, createdAt: r.created_at }));
}
