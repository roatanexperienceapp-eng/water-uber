# Business contact details and email

All of these live in one file: `supabase/functions/_shared/business.ts`. The app (Help, Legal, Zelle
screen), Isla and the server read them from there. Change them there only.

| What | Value |
|---|---|
| Phone (call / text) | +1 (207) 213-5757 |
| WhatsApp | same number. If it is not on WhatsApp, set `whatsapp: false` |
| Email (all email) | roatanexperienceapp@gmail.com |
| Zelle | roatanexperienceapp@gmail.com |

Where guests see them: Account → Help (Call, WhatsApp, Email), Account → Legal (email), the Zelle
screen at checkout, and Isla's answers.

## Email services: set the same address everywhere

1. **Sign-in and account emails (Supabase Auth).** Supabase's built-in sender is for testing only
   (a few emails per hour). Use the Gmail:
   - In Google: turn on 2-Step Verification, then create an **App password** (Google Account → Security
     → App passwords). Never use the normal Gmail password.
   - In Supabase dashboard → Authentication → Emails → SMTP settings:
     host `smtp.gmail.com`, port `587`, user `roatanexperienceapp@gmail.com`, password = the app password,
     sender email `roatanexperienceapp@gmail.com`, sender name `Roatán Water Taxi`.
   - Gmail sends up to about 500 emails a day. When the app outgrows that, move to a sending service
     (Resend, Postmark, SendGrid) on the roatanwatertaxi.com domain.
2. **Payment receipts (Stripe).** Stripe dashboard → Settings → Business → Public details:
   support email `roatanexperienceapp@gmail.com`, support phone `+1 207 213 5757`.
   Settings → Customer emails: turn on "Successful payments".
3. **App Store Connect / Google Play.** Support email `roatanexperienceapp@gmail.com`
   on the app listing (both stores require a working support contact).
4. **Website.** The page on roatanwatertaxi.com shows the same phone and email.

Recommended later: create `hello@roatanwatertaxi.com` that forwards to the Gmail (GoDaddy offers free
forwarding). Guests trust an address on the app's own domain more than a Gmail address, and you
keep using the same Gmail inbox.
