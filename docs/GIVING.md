# Giving: Every Child Roatán

Explore → the "Feed the Kids" poster → **donation page**. Guests pick $5 / $10 / $25 / $50 or any amount
($1–$5,000) and can leave a message for the kids.

## The rules this follows

- **Apple:** unless the charity is an *Apple-approved nonprofit*, an iPhone app may not collect donations itself.
  It must send people to a website (App Review Guidelines 3.2.1(vi) and 3.2.2(iv)). So in the store apps the
  button says **"Donate on our website"** and opens the same page in the phone's browser; the payment happens on
  the website. If Every Child Roatán later gets Apple nonprofit approval, donations can move inside the app
  (Apple Pay required).
- **Google Play:** tax-exempt donations are exempt from Google Play billing.
- **Honesty on the page:** "100% of your donation goes to the charity. We cover the card fees." and "Donations may
  not be tax-deductible where you live." Don't claim tax deductibility unless the charity is registered where the
  donor pays tax (e.g. a US 501(c)(3)).

## The 10% pledge: what "earnings" means

The page says **"10% of what this app earns goes to Roatán kids"** and explains: earnings = the part of each
booking the app keeps after paying captains and tour operators. In numbers:

| Payment | Counts as earnings |
|---|---|
| Your own tours and rentals | 100% |
| Partner tours | your commission (operator's `commission_pct`, default 15%) |
| Water taxi rides and passes | `giving_settings.ride_platform_pct` (default **20%**; set this to your real share) |
| Donations | 0% (they go 100% to the charity) |

Change the pledge or the ride share:
```sql
update giving_settings set pledge_pct = 10, ride_platform_pct = 20;
```

## Every month

1. See what the charity is owed (guest donations + pledge − what you already handed over):
   ```sql
   select * from giving_owed();
   ```
2. Transfer that amount to Every Child Roatán and record it:
   ```sql
   insert into charity_transfers (amount_usd, note, receipt_url)
   values (412.50, 'October: donations + 10% pledge', 'https://…receipt');
   ```
3. The donation page shows "raised by guests" and "handed to the charity so far" from these records.
   Revenue and the pledge calculation are never shown publicly.

## Before launch

- Confirm the charity's legal status and bank account, and whether donations should be paid **directly to the
  charity's own account** (cleanest) or collected by your company and passed on (what this build does).
- If you market "a portion of proceeds goes to charity" to US customers, some US states have
  commercial co-venture rules. Ask your accountant/lawyer once; it's a one-time check.
