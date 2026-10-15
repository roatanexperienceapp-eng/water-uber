import { DEMO_MODE } from '@/config';

/**
 * Payment provider boundary. Keep every payment call behind this file so the processor can be swapped.
 * OPEN DECISION (see docs/DECISIONS.md): Stripe requires a supported-country company (e.g. a US LLC);
 * otherwise use a Honduran processor with a mobile SDK. Never collect raw card numbers in our own UI.
 */
export interface PaymentRequest {
  amountUsd: number;
  description: string;
  /** Server-side id of the ride or booking being paid. */
  referenceId: string;
}

export interface PaymentResult {
  ok: boolean;
  receiptId?: string;
  error?: string;
}

export async function pay(req: PaymentRequest): Promise<PaymentResult> {
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 900));
    return { ok: true, receiptId: `DEMO-${req.referenceId}` };
  }
  // TODO(payments): 1) call the `create-payment` edge function to get a payment intent/session for referenceId,
  // 2) present the processor's native payment sheet, 3) return its result. The server marks the booking paid
  // only from the processor's webhook, never from this client result.
  return { ok: false, error: 'payments_not_configured' };
}
