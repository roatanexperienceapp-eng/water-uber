import { useEffect, useState } from 'react';
import { CREW, type CrewRole } from '../../supabase/functions/_shared/crew.ts';
import { roatanDate } from '../../supabase/functions/_shared/cruise.ts';
import { readJSON, writeJSON } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';

/**
 * The owner's captains. Live mode reads crew_public() (names, roles, certified — never licence numbers).
 * Demo mode uses supabase/functions/_shared/crew.ts and treats everyone as verified.
 */
export interface CrewCard {
  id: string;
  name: string;
  roles: CrewRole[];
  certified: boolean;
}

export async function listCrew(): Promise<CrewCard[]> {
  if (!supabase) return CREW.map((c) => ({ ...c, certified: true }));
  const { data, error } = await supabase.rpc('crew_public');
  if (error) throw error;
  return ((data ?? []) as { id: string; display_name: string; roles: CrewRole[]; certified: boolean }[]).map((r) => ({
    id: r.id,
    name: r.display_name,
    roles: r.roles,
    certified: r.certified,
  }));
}

export function useCrew(): CrewCard[] {
  const [crew, setCrew] = useState<CrewCard[]>(() => (supabase ? [] : CREW.map((c) => ({ ...c, certified: true }))));
  useEffect(() => {
    listCrew().then(setCrew).catch(() => {});
  }, []);
  return crew;
}

// ---------- Captain app: who is at the helm ----------
const HELM_KEY = 'demo.helm';

export type Helm = { status: 'ok'; crew: CrewCard } | { status: 'pick' } | { status: 'unlinked' };

/**
 * Live: the crew row the office linked to this captain's account (RLS shows only their own).
 * Demo: whichever name was picked on this phone.
 */
export async function myHelm(): Promise<Helm> {
  if (!supabase) {
    const id = readJSON<string | null>(HELM_KEY, null);
    const c = CREW.find((x) => x.id === id);
    return c ? { status: 'ok', crew: { ...c, certified: true } } : { status: 'pick' };
  }
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: 'unlinked' };
  const { data } = await supabase.from('crew').select('id, display_name, roles, license_expires, verified_at, active').eq('profile_id', u.user.id).maybeSingle();
  if (!data) return { status: 'unlinked' };
  const certified = !!data.active && !!data.verified_at && !!data.license_expires && String(data.license_expires) >= roatanDate(new Date());
  return { status: 'ok', crew: { id: data.id, name: data.display_name, roles: data.roles, certified } };
}

/** Demo only. In the live app the office links accounts, so nobody can pick another captain's name. */
export function demoSetHelm(id: string | null): void {
  writeJSON(HELM_KEY, id);
}
