import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { APP_VARIANT } from '@/config';
import { readJSON, writeJSON } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';

/**
 * Crash and error reports, sent to our own database (public.log_app_error) so the office can see them
 * under App health. Works in Expo Go, on the web and in real builds; no outside service or key needed.
 * Never put names, phone numbers or card details in an error message — the message is stored as is.
 */

type Kind = 'crash' | 'render' | 'handled' | 'promise';

const DEVICE_KEY = 'errors.device';
let currentRoute = '';
let installed = false;
const recent = new Map<string, number>();

/** A random id for this install, so one phone's repeat crashes count as one device. Not tied to the person. */
function deviceId(): string {
  let id = readJSON<string>(DEVICE_KEY, '');
  if (!id) {
    id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    writeJSON(DEVICE_KEY, id);
  }
  return id;
}

/** The screen the guest was on; set by the root layout as they move around. */
export function setErrorRoute(route: string): void {
  currentRoute = route;
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack };
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

/** Send one report. Never throws; the same problem is sent at most once a minute from one phone. */
export function reportError(error: unknown, kind: Kind = 'handled', componentStack?: string): void {
  try {
    const { message, stack } = describe(error);
    const key = `${kind}:${message}:${currentRoute}`;
    const now = Date.now();
    if ((recent.get(key) ?? 0) > now - 60_000) return;
    recent.set(key, now);
    if (__DEV__) console.warn('[error report]', kind, message);
    if (!supabase) return; // demo mode: nowhere to send
    const fullStack = [stack, componentStack].filter(Boolean).join('\n--- component stack ---\n');
    void supabase
      .rpc('log_app_error', {
        p_app: Platform.OS === 'web' ? 'web' : APP_VARIANT,
        p_platform: Platform.OS,
        p_app_version: Constants.expoConfig?.version ?? null,
        p_route: currentRoute || null,
        p_kind: kind,
        p_message: message.slice(0, 500),
        p_stack: fullStack ? fullStack.slice(0, 4000) : null,
        p_device_id: deviceId(),
      })
      .then(() => undefined, () => undefined);
  } catch {
    // Reporting must never cause a second crash.
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler(): GlobalHandler; setGlobalHandler(h: GlobalHandler): void };

/** Catch crashes that nothing else catches. React Native's own behavior (red screen in development) is kept. */
export function installErrorReporting(): void {
  if (installed) return;
  installed = true;
  const eu = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (eu) {
    const previous = eu.getGlobalHandler();
    eu.setGlobalHandler((error, isFatal) => {
      reportError(error, isFatal ? 'crash' : 'handled');
      previous(error, isFatal);
    });
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'crash'));
    window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
  }
}
