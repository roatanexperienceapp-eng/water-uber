import type { MarineId } from '../../supabase/functions/_shared/marine.ts';
import { safetyFor } from '../../supabase/functions/_shared/marine.ts';
import { ensureSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Sends a (shrunk) photo to the server, which asks the AI and adds our own safety notes. */
export async function identify(base64: string, language: string): Promise<MarineId & { demo?: boolean }> {
  if (!supabase) {
    // Demo mode has no server: show what a result looks like, clearly marked.
    await new Promise((r) => setTimeout(r, 900));
    return {
      found: true, demo: true, commonName: 'Hawksbill turtle (demo result)', scientificName: 'Eretmochelys imbricata', group: 'turtle', confidence: 'medium',
      facts: ['Demo mode: the real scanner looks at your photo once the app is connected.', 'Hawksbills feed mostly on sponges on the reef.'],
      safety: safetyFor('Hawksbill turtle'),
    };
  }
  await ensureSession();
  const { data, error } = await supabase.functions.invoke<MarineId>('identify-marine-life', { body: { image: base64, mediaType: 'image/jpeg', language } });
  if (error || !data) {
    const ctx = (error as { context?: Response } | null)?.context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    throw new Error(payload?.code ?? 'scan_failed');
  }
  return data;
}
