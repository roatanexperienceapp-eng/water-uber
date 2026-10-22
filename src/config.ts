import Constants from 'expo-constants';

type Extra = { variant?: 'guest' | 'captain'; brandName?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Which app this build is: the guest app or the captain app (set by APP_VARIANT in app.config.ts). */
export const APP_VARIANT: 'guest' | 'captain' = extra.variant ?? 'guest';
export const BRAND_NAME = extra.brandName ?? 'Roatán Water Taxi';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Demo mode: no backend configured. The app runs on simulated boats and local storage only. */
export const DEMO_MODE = !SUPABASE_URL || !SUPABASE_KEY;

/** Map starts centred on the West End water taxi dock. */
export const HOME_CENTER = { latitude: 16.3033, longitude: -86.596 };

/** Public website for no-download booking, QR codes and group-split links. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://roatanwatertaxi.com').replace(/\/$/, '');
