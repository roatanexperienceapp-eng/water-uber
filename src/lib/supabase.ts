import 'expo-sqlite/localStorage/install';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { DEMO_MODE, SUPABASE_KEY, SUPABASE_URL } from '@/config';

/** Null in demo mode (no backend configured). Callers must handle that. */
export const supabase: SupabaseClient | null = DEMO_MODE
  ? null
  : createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

// Refresh auth tokens only while the app is in the foreground (Supabase's recommended pattern).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
