import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { paymentStatus, startPayment, type PayTarget } from '@/lib/api';

/**
 * How the app takes money (same flow for every processor):
 *   1. The server prices the item and returns the processor's HOSTED checkout page (create-payment).
 *   2. The app opens that page. Card details, Apple Pay and Google Pay happen there, never in our app.
 *   3. The processor tells our server through a signed webhook. Only then is anything marked paid.
 *   4. The app asks the server for the result. A redirect back from the page proves nothing.
 *
 * Do every step that must happen around a purchase (create the booking, link the taxi rides, start the
 * group split) BEFORE calling pay(): on the web the page navigates away to the checkout and comes back
 * on /paid, so code after pay() would not run there.
 */
export type PayOutcome = 'paid' | 'pending' | 'cancelled' | 'failed' | 'redirected';

const POLL_MS = 1500;
const POLL_TRIES = 20; // ~30 s for the webhook to land

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits for the server to confirm a payment. 'pending' if it hasn't heard from the processor yet. */
export async function waitForPayment(paymentId: string, tries = POLL_TRIES): Promise<'paid' | 'failed' | 'pending'> {
  for (let i = 0; i < tries; i++) {
    const s = await paymentStatus(paymentId).catch(() => null);
    if (s === 'succeeded') return 'paid';
    if (s === 'failed') return 'failed';
    await sleep(POLL_MS);
  }
  return 'pending';
}

/**
 * Pays for something the server already priced.
 * @param returnPath where the web version lands after the checkout page, e.g. "/confirmation?kind=ride&id=…"
 */
export async function pay(target: PayTarget, returnPath: string): Promise<{ outcome: PayOutcome; paymentId?: string }> {
  const r = await startPayment(target, returnPath);
  if (!r.checkoutUrl) {
    // Demo mode (no server): simulate the processor.
    await sleep(900);
    return { outcome: 'paid', paymentId: r.paymentId };
  }
  if (Platform.OS === 'web') {
    window.location.assign(r.checkoutUrl);
    return { outcome: 'redirected', paymentId: r.paymentId };
  }
  const res = await WebBrowser.openAuthSessionAsync(r.checkoutUrl, Linking.createURL('paid'));
  const result = await waitForPayment(r.paymentId, res.type === 'success' ? POLL_TRIES : 3);
  if (result === 'pending' && res.type !== 'success') return { outcome: 'cancelled', paymentId: r.paymentId };
  return { outcome: result, paymentId: r.paymentId };
}
