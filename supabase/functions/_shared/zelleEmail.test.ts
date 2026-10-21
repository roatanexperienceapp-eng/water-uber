import { deepStrictEqual as eq, ok } from 'node:assert';
import { parseZelleEmail, sameSecret, senderAllowed } from './zelleEmail.ts';

Deno.test('reads code and amount from a typical deposit email', () => {
  const r = parseZelleEmail('Jane Smith sent you $1,010.00 with Zelle®.\nMemo: RWT-7C79C78D\nThe money has been deposited.');
  eq(r, { ok: true, deposit: { code: 'RWT-7C79C78D', amountUsd: 1010 } });
});

Deno.test('lower case, a space instead of the dash, and no cents', () => {
  const r = parseZelleEmail('You received $95 from JOHN DOE. Message: rwt 1a2b3c4d');
  eq(r, { ok: true, deposit: { code: 'RWT-1A2B3C4D', amountUsd: 95 } });
});

Deno.test('the same amount twice is still one amount', () => {
  const r = parseZelleEmail('Amount: $70.00. RWT-ABCDEF12. Total deposited: $70.00');
  ok(r.ok);
});

Deno.test('USD written as text', () => {
  eq(parseZelleEmail('Deposit of 70.00 USD, note RWT-ABCDEF12'), { ok: true, deposit: { code: 'RWT-ABCDEF12', amountUsd: 70 } });
  eq(parseZelleEmail('USD 70.00 RWT-ABCDEF12'), { ok: true, deposit: { code: 'RWT-ABCDEF12', amountUsd: 70 } });
});

Deno.test('no memo code means a person checks it', () => {
  eq(parseZelleEmail('Jane sent you $70.00'), { ok: false, reason: 'no_code' });
});

Deno.test('two different codes or two different amounts are never guessed', () => {
  eq(parseZelleEmail('$70.00 RWT-ABCDEF12 RWT-12345678'), { ok: false, reason: 'many_codes' });
  eq(parseZelleEmail('$70.00 and $5.00 fee RWT-ABCDEF12'), { ok: false, reason: 'many_amounts' });
  eq(parseZelleEmail('RWT-ABCDEF12'), { ok: false, reason: 'no_amount' });
});

Deno.test('codes must be exactly 8 hex characters', () => {
  eq(parseZelleEmail('$70.00 RWT-ABCDEF1'), { ok: false, reason: 'no_code' });
  eq(parseZelleEmail('$70.00 RWT-ABCDEFGH'), { ok: false, reason: 'no_code' });
});

Deno.test('only verified bank domains are trusted', () => {
  ok(senderAllowed(['bankofamerica.com'], ['bankofamerica.com']));
  ok(senderAllowed(['ealerts.bankofamerica.com'], ['bankofamerica.com']));
  ok(!senderAllowed(['bankofamerica.com.evil.net'], ['bankofamerica.com']));
  ok(!senderAllowed(['gmail.com'], ['bankofamerica.com']));
  ok(!senderAllowed(['bankofamerica.com'], []));
  ok(!senderAllowed([], ['bankofamerica.com']));
});

Deno.test('secret comparison', () => {
  ok(sameSecret('abc123', 'abc123'));
  ok(!sameSecret('abc123', 'abc124'));
  ok(!sameSecret('', ''));
  ok(!sameSecret('abc', 'abcd'));
});
