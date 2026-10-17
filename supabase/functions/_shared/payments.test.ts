import { deepStrictEqual as eq, ok, rejects } from 'node:assert';
import { shareCents, signStripePayload, stripeEventToPaymentEvent, toCents, verifyStripeSignature } from './payments.ts';

Deno.test('amounts become whole cents without float drift', () => {
  eq(toCents(5), 500);
  eq(toCents(19.99), 1999);
  eq(toCents(0.1 + 0.2), 30);
  eq(toCents(129), 12900);
});

Deno.test('split shares always add up to the exact total', () => {
  for (const [total, n] of [[17000, 4], [10001, 3], [4500, 7], [999, 2], [12900, 12]]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += shareCents(total, n, i, 1);
    eq(sum, total);
    eq(shareCents(total, n, 0, n), total);
  }
  eq(shareCents(10001, 3, 0, 1), 3334); // first share carries the extra cent
  eq(shareCents(10001, 3, 1, 2), 6667);
});

Deno.test('Stripe signature: valid passes, tampered / wrong secret / stale fail', async () => {
  const body = JSON.stringify({ type: 'checkout.session.completed' });
  const now = 1_800_000_000;
  const header = await signStripePayload(body, 'whsec_test', now);
  await verifyStripeSignature(body, header, 'whsec_test', now + 10);
  await rejects(() => verifyStripeSignature(body + ' ', header, 'whsec_test', now), /bad_signature/);
  await rejects(() => verifyStripeSignature(body, header, 'whsec_other', now), /bad_signature/);
  await rejects(() => verifyStripeSignature(body, header, 'whsec_test', now + 3600), /too_old/);
  await rejects(() => verifyStripeSignature(body, null, 'whsec_test', now), /missing/);
});

Deno.test('Stripe events map to our payment events', () => {
  const paid = stripeEventToPaymentEvent({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid', client_reference_id: 'P1', payment_intent: 'pi_1', amount_total: 1700 } } });
  eq(paid, { kind: 'succeeded', paymentId: 'P1', providerRef: 'pi_1', amountCents: 1700 });
  // Bank-transfer style payments complete later; "unpaid" must not count as paid.
  eq(stripeEventToPaymentEvent({ type: 'checkout.session.completed', data: { object: { payment_status: 'unpaid' } } }).kind, 'ignored');
  eq(stripeEventToPaymentEvent({ type: 'checkout.session.expired', data: { object: { client_reference_id: 'P2' } } }), { kind: 'failed', paymentId: 'P2' });
  const ref = stripeEventToPaymentEvent({ type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_1', refunds: { data: [{ id: 're_1' }] } } } });
  eq(ref, { kind: 'refunded', providerRef: 'pi_1', refundRef: 're_1' });
  ok(stripeEventToPaymentEvent({ type: 'customer.created' }).kind === 'ignored');
});
