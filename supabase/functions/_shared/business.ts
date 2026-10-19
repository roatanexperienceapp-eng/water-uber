// The business's own contact and payment details. One place, used by the app, Isla and the server.
// Change them here only.

export const BUSINESS = {
  name: 'Roatán Water Taxi',
  /** Shown to guests. */
  phoneDisplay: '+1 (207) 213-5757',
  /** For tel:, sms: and WhatsApp links. */
  phoneE164: '+12072135757',
  /** Set to false if this number is not on WhatsApp (hides the WhatsApp button). */
  whatsapp: true,
  /** Every email the business sends or receives: support, receipts, sign-in emails. */
  email: 'roatanexperienceapp@gmail.com',
} as const;

/**
 * Zelle: a US bank-to-bank transfer. There is no way for the app to see it arrive, so a Zelle
 * payment stays "pending" until someone on the team checks the bank and confirms it
 * (docs/PAYMENTS.md → Zelle). That is why it is offered only for things booked ahead,
 * never for a water taxi needed right now.
 */
export const ZELLE = {
  enabled: true,
  /** The email the business's Zelle is registered to. */
  recipient: 'roatanexperienceapp@gmail.com',
  /** Only for passes, packages and tours starting at least this many hours from now. */
  minLeadHours: 6,
} as const;

/** Short code the guest types in the Zelle memo, so the team can match the transfer. */
export function zelleMemo(paymentId: string): string {
  return `RWT-${paymentId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
