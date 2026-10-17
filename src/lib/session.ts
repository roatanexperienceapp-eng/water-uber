import { supabase } from '@/lib/supabase';

/**
 * Guests can book without creating an account (cruise visitors on the no-download web page): we give
 * them an anonymous session. They can add an email later and keep their bookings.
 * Requires "Allow anonymous sign-ins" in Supabase Auth (docs/PAYMENTS.md).
 */
export async function ensureSession(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}
