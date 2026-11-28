// Payment provider boundary for the server. Everything that touches real money goes through here.
//
// Design rules (do not break these when adding a processor):
//   * Amounts are whole cents (integers). Never send floats to a processor.
//   * The server decides every amount. The app never sends a price.
//   * The guest pays on the processor's HOSTED page (Checkout). Card numbers never touch our app or server,
//     which keeps us out of most PCI scope and gives Apple Pay / Google Pay for free.
//   * A payment is only "succeeded" when the processor's SIGNED webhook says so, and the amount it reports
//     matches what we asked for. The app's redirect back is never trusted.
//   * Every processor call carries an idempotency key = our payment id, so retries can't double-charge.
//
// To add a Honduran processor (PixelPay, BAC, etc.): implement PaymentProvider and add it to getProvider().

// @ts-ignore -- node:crypto resolves in Deno; the app typecheck has no Node types for server files.
import { createHash, createHmac } from 'node:crypto';

export interface CheckoutRequest {
  paymentId: string;
  amountCents: number;
  currency: 'usd';
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface CheckoutSession {
  providerSessionId: string;
  checkoutUrl: string;
  expiresAt: Date;
}

/** A processor event, reduced to what our database needs. */
export type PaymentEvent =
  | { kind: 'succeeded'; paymentId: string; providerRef: string; amountCents: number }
  | { kind: 'failed'; paymentId: string }
  | { kind: 'refunded'; providerRef: string; refundRef: string }
  | { kind: 'ignored'; type: string };

export interface PaymentProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Throws if the signature is missing, wrong or too old. */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent>;
  refund(providerRef: string, amountCents: number, idempotencyKey: string): Promise<{ refundRef: string }>;
}

// =====================================================================================
// Money helpers (pure, unit-tested)
// =====================================================================================
export function toCents(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('bad_amount');
  return Math.round(usd * 100);
}

/**
 * Cents owed for shares [from, from+count) when `totalCents` is split into `shares` parts.
 * The first (total % shares) shares carry one extra cent, so the parts always add up exactly.
 */
export function shareCents(totalCents: number, shares: number, from: number, count: number): number {
  if (shares < 1 || from < 0 || count < 1 || from + count > shares) throw new Error('bad_share');
  const base = Math.floor(totalCents / shares);
  const extra = totalCents % shares;
  return count * base + Math.max(0, Math.min(from + count, extra) - from);
}

// =====================================================================================
// Stripe (hosted Checkout). Works for US LLC accounts; see docs/PAYMENTS.md.
// =====================================================================================
const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 300;

function form(params: Record<string, string | number | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) out.append(k, String(v));
  return out.toString();
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifies a `Stripe-Signature` header (scheme v1) per Stripe's documented algorithm. */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<void> {
  if (!header) throw new Error('missing_signature');
  const parts = header.split(',').map((p) => p.split('=') as [string, string]);
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const v1 = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(t) || v1.length === 0) throw new Error('bad_signature_header');
  if (Math.abs(nowSeconds - t) > SIGNATURE_TOLERANCE_SECONDS) throw new Error('signature_too_old');
  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  if (!v1.some((s) => safeEqual(s, expected))) throw new Error('bad_signature');
}

/** Builds a valid header for tests and local webhook replays. */
export async function signStripePayload(rawBody: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  return `t=${nowSeconds},v1=${await hmacSha256Hex(secret, `${nowSeconds}.${rawBody}`)}`;
}

// deno-lint-ignore no-explicit-any
type Json = any;

/** Turns a verified Stripe event into our event shape. */
export function stripeEventToPaymentEvent(event: Json): PaymentEvent {
  const obj = event?.data?.object ?? {};
  switch (event?.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (obj.payment_status !== 'paid') return { kind: 'ignored', type: `${event.type}:${obj.payment_status}` };
      return { kind: 'succeeded', paymentId: String(obj.client_reference_id ?? obj.metadata?.payment_id), providerRef: String(obj.payment_intent), amountCents: Number(obj.amount_total) };
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      return { kind: 'failed', paymentId: String(obj.client_reference_id ?? obj.metadata?.payment_id) };
    case 'charge.refunded':
      return { kind: 'refunded', providerRef: String(obj.payment_intent), refundRef: String(obj.refunds?.data?.[0]?.id ?? obj.id) };
    default:
      return { kind: 'ignored', type: String(event?.type) };
  }
}

export function stripeProvider(secretKey: string, webhookSecret: string): PaymentProvider {
  async function call(path: string, body: string, idempotencyKey: string): Promise<Json> {
    const res = await fetch(`${STRIPE_API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey },
      body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`stripe_${res.status}:${data?.error?.code ?? data?.error?.message ?? 'error'}`);
    return data;
  }
  return {
    name: 'stripe',
    async createCheckout(req) {
      const expires = Math.floor(Date.now() / 1000) + 30 * 60; // Stripe minimum is 30 minutes.
      const s = await call(
        '/checkout/sessions',
        form({
          mode: 'payment',
          client_reference_id: req.paymentId,
          'metadata[payment_id]': req.paymentId,
          'payment_intent_data[metadata][payment_id]': req.paymentId,
          'line_items[0][quantity]': 1,
          'line_items[0][price_data][currency]': req.currency,
          'line_items[0][price_data][unit_amount]': req.amountCents,
          'line_items[0][price_data][product_data][name]': req.description.slice(0, 120),
          success_url: req.successUrl,
          cancel_url: req.cancelUrl,
          customer_email: req.customerEmail,
          expires_at: expires,
        }),
        `checkout-${req.paymentId}`,
      );
      return { providerSessionId: s.id, checkoutUrl: s.url, expiresAt: new Date(expires * 1000) };
    },
    async parseWebhook(rawBody, headers) {
      await verifyStripeSignature(rawBody, headers.get('stripe-signature'), webhookSecret);
      return stripeEventToPaymentEvent(JSON.parse(rawBody));
    },
    async refund(providerRef, amountCents, idempotencyKey) {
      const r = await call('/refunds', form({ payment_intent: providerRef, amount: amountCents }), idempotencyKey);
      return { refundRef: String(r.id) };
    },
  };
}

// =====================================================================================
// PixelPay Hosted Payment (Honduras). Docs: docs.pixelpay.com, "Hosted Payment".
// The guest pays on PixelPay's page (3D Secure included). PixelPay POSTs a JSON callback to
// `_callback` with `payment_hash` = md5(order_id|key_id|secret_key), which only we and PixelPay can make.
// =====================================================================================
export interface PixelPayConfig {
  keyId: string;
  secretKey: string;
  /** Merchant domain shown in the PixelPay dashboard, e.g. "pixelpay.app". */
  endpoint: string;
  /** app_url used in the request signature (Preferences → API Options). */
  appUrl: string;
  sandbox: boolean;
  /** Where PixelPay sends the paid callback: our payment-webhook function. */
  callbackUrl: string;
  /** Used when the guest has no email on file (PixelPay requires one). */
  fallbackEmail: string;
}

/** `_client_signature`: HMAC SHA3-512 of key|order_id|app_url with the secret key (Secure Signature docs). */
export function pixelPaySignature(keyId: string, orderId: string, appUrl: string, secretKey: string): string {
  return createHmac('sha3-512', secretKey).update([keyId, orderId, appUrl].join('|')).digest('hex');
}

/** The `paymentHash` / `payment_hash` PixelPay sends back: md5(order_id|key_id|secret_key). */
export function pixelPayPaymentHash(orderId: string, keyId: string, secretKey: string): string {
  return createHash('md5').update([orderId, keyId, secretKey].join('|')).digest('hex');
}

/** Turns a PixelPay `_callback` body into our event, after checking its payment_hash. Throws if forged. */
export function pixelPayCallbackToEvent(body: Json, keyId: string, secretKey: string): PaymentEvent {
  const order = String(body?.order ?? '');
  if (!order) throw new Error('missing_order');
  const hash = String(body?.payment_hash ?? '');
  if (!hash || !safeEqual(hash.toLowerCase(), pixelPayPaymentHash(order, keyId, secretKey))) throw new Error('bad_signature');
  if (String(body?.status ?? '').toLowerCase() !== 'paid') return { kind: 'ignored', type: `pixelpay:${body?.status}` };
  if (String(body?.currency ?? 'USD').toUpperCase() !== 'USD') return { kind: 'ignored', type: `pixelpay:currency:${body?.currency}` };
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount)) throw new Error('bad_amount');
  return { kind: 'succeeded', paymentId: order, providerRef: String(body?.uuid ?? body?.ref ?? order), amountCents: toCents(amount) };
}

export function pixelPayProvider(cfg: PixelPayConfig): PaymentProvider {
  const route = `https://${cfg.endpoint}/api/v2/transaction/hosted/${cfg.sandbox ? 'sandbox' : 'other'}`;
  return {
    name: 'pixelpay',
    async createCheckout(req) {
      if (req.currency !== 'usd') throw new Error('pixelpay_currency');
      const res = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'x-client-signature': pixelPaySignature(cfg.keyId, req.paymentId, cfg.appUrl, cfg.secretKey) },
        body: form({
          _key: cfg.keyId,
          _client_signature: pixelPaySignature(cfg.keyId, req.paymentId, cfg.appUrl, cfg.secretKey),
          _order_id: req.paymentId,
          _amount: (req.amountCents / 100).toFixed(2),
          _currency: 'USD',
          _complete: req.successUrl,
          _cancel: req.cancelUrl,
          _callback: cfg.callbackUrl,
          _first_name: 'Guest',
          _last_name: 'Roatan',
          _email: req.customerEmail ?? cfg.fallbackEmail,
          _order_content: btoa(JSON.stringify([{ title: req.description.slice(0, 60).padEnd(3, '.'), price: req.amountCents / 100, qty: 1, total: req.amountCents / 100 }])),
          json: 'true',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.url) throw new Error(`pixelpay_${res.status}:${JSON.stringify(data?.errors ?? data?.message ?? 'error').slice(0, 200)}`);
      return { providerSessionId: req.paymentId, checkoutUrl: String(data.url), expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
    },
    async parseWebhook(rawBody) {
      return pixelPayCallbackToEvent(JSON.parse(rawBody), cfg.keyId, cfg.secretKey);
    },
    async refund() {
      // Hosted Payment has no refund API. PixelPay only voids same-day card payments through its SDK.
      // Refunds stay in the queue with this error, and are done by hand in the PixelPay dashboard.
      throw new Error('pixelpay_manual_refund');
    },
  };
}

/** Picks the processor from server secrets. Returns null until one is configured. */
export function getProvider(env: { get(k: string): string | undefined }): PaymentProvider | null {
  const name = env.get('PAYMENT_PROVIDER');
  if (name === 'stripe') {
    const key = env.get('STRIPE_SECRET_KEY');
    const hook = env.get('STRIPE_WEBHOOK_SECRET');
    if (!key || !hook) throw new Error('stripe_not_configured');
    return stripeProvider(key, hook);
  }
  if (name === 'pixelpay') {
    const keyId = env.get('PIXELPAY_KEY_ID');
    const secretKey = env.get('PIXELPAY_SECRET_KEY');
    const endpoint = env.get('PIXELPAY_ENDPOINT');
    const appUrl = env.get('PIXELPAY_APP_URL') ?? (endpoint ? `https://${endpoint}` : undefined);
    const base = env.get('SUPABASE_URL');
    if (!keyId || !secretKey || !endpoint || !appUrl || !base) throw new Error('pixelpay_not_configured');
    return pixelPayProvider({
      keyId,
      secretKey,
      endpoint,
      appUrl,
      sandbox: env.get('PIXELPAY_SANDBOX') !== 'false',
      callbackUrl: `${base}/functions/v1/payment-webhook`,
      fallbackEmail: env.get('PIXELPAY_FALLBACK_EMAIL') ?? 'bookings@roatanexperienceapp.com',
    });
  }
  return null;
}
