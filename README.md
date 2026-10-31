# SortMedication

Stock-control software for independent US pharmacies, sold as a subscription
($80/month per pharmacy, 14-day free trial).

Each pharmacy gets its own private account with staff logins. The app tracks
every product and every batch (lot number and expiry date), warns when stock
runs low or is about to expire, and records every stock change in an audit
trail. It stores no patient details.

## What's in version 1

- **Sign up and log in**, with an email and password or with **Google**. A
  pharmacy signs up, gets a 14-day free trial (no card) and a "Main store"
  branch, and lands on its inventory. The owner adds staff with one of four roles:
  owner, pharmacist, technician or read-only.
- **Dashboard** with counts of products running low, batches expiring soon and
  expired batches, plus today's stock movements.
- **Inventory list**, searchable by name, NDC, barcode or shelf, with filters
  and sorting. A barcode scanner typing into the search box jumps straight to
  the product.
- **Products** with NDC, barcode, strength, form, pack size, category, DEA
  schedule (II–V), reorder level and quantity, supplier, prices, storage and
  shelf location.
- **Receive stock** into a batch (lot, expiry, invoice, supplier).
- **Stock out**: dispense, return to supplier, expired/destroyed, count
  adjustment, or move to another branch. Suggests the batch that expires
  first and refuses to take more than a batch holds. Schedule II adjustments
  and destruction need a pharmacist confirmation.
- **Reports**: reorder list by supplier, expiry report, stock valuation, and
  the audit log (stock movements and account activity). All download as CSV
  and print to PDF.
- **CSV import** of products, with optional opening stock.
- **Settings**: pharmacy details, expiry warning period (30 days by default),
  branches, staff, suppliers, subscription and password.
- **Trial ending**: after the trial, an unpaid pharmacy becomes read-only (it
  can still view and export everything).

### Not yet included

- Taking payments. The "Start subscription" button explains that online
  payment isn't switched on yet. Connecting Stripe is the next step.
- Password reset by email (the owner resets staff passwords for now) and
  sending invitations by email.
- Limiting staff to particular branches (everyone sees all branches).
- A full controlled-substance (DEA) log, and links to tills, dispensing
  systems or wholesalers.

## How stock is stored

Stock levels are never typed in directly. Every change is a **movement**
(received +63, dispensed −21, and so on) and a batch's quantity is the sum of
its movements. That makes the movements table a complete, unchangeable audit
trail. Quantities are stored in single units (tablets, ml); prices are per
pack.

Every table carries the pharmacy's id and every query filters on it, so one
pharmacy can never see another's data.

## Running it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000 and sign up. With no `DATABASE_URL` set, the
app uses a built-in database stored in the `.data` folder, so there is nothing
else to install. Delete `.data` to start again from empty.

Other commands:

- `npm test` runs the automated tests.
- `npm run build` checks the whole app compiles, as Vercel will.

## Putting it online (Vercel)

1. In Vercel, import this GitHub repository as a new project.
2. In the project's **Storage** tab, add a **Neon** Postgres database. Vercel
   sets `DATABASE_URL` for you.
3. Deploy. The database tables are created automatically on first use.

## Sign in with Google

The "Sign up with Google" and "Sign in with Google" buttons need two keys
from Google. Until they are added, the buttons explain that Google sign-in
isn't switched on yet, and email and password still work.

Getting the keys takes about 10 minutes and is free:

1. Go to https://console.cloud.google.com and sign in with your Google
   account. If asked, agree to the terms.
2. At the top, click the project picker, then **New project**. Name it
   `SortMedication` and click **Create**. Make sure it is selected.
3. In the search bar, type **Google Auth Platform** and open it. Click
   **Get started**. Fill in the app name (`SortMedication`) and your support
   email, choose **External** for the audience, add your email as the contact,
   agree, and click **Create**.
4. In the left menu, open **Clients**, then **Create client**.
   - Application type: **Web application**. Name: `SortMedication`.
   - Under **Authorised redirect URIs**, click **Add URI** and paste
     `http://localhost:3000/auth/google/callback`. When the app is online,
     add a second one with your real address, for example
     `https://sortmedication.vercel.app/auth/google/callback`.
   - Click **Create**.
5. Google shows a **Client ID** and a **Client secret**. Copy both. Keep the
   secret private, like a password.
6. On your computer, put them in a file called `.env.local` next to
   `package.json` (copy `.env.example` to start):

   ```
   GOOGLE_CLIENT_ID=paste-the-client-id-here
   GOOGLE_CLIENT_SECRET=paste-the-client-secret-here
   ```

   On Vercel, add the same two under **Settings → Environment Variables**,
   plus `APP_URL` set to your site address (for example
   `https://sortmedication.vercel.app`), then redeploy.
7. Restart the app (`npm run dev`) and press "Sign up with Google".

While Google lists the app as "Testing", only the Google accounts you add
under **Audience → Test users** can sign in. When you are ready for any
pharmacy to use it, click **Publish app** on the Audience page.

How it works: a new person picks their Google account, then types their
pharmacy's name, and the account is made with a 14-day trial. If someone
already has an email login with the same address, Google signs them into
that login. People who signed up with Google can also set a password under
Settings → My account.

## Where things are

- `src/lib/domain.ts`: business rules (roles, warnings, trial length, price).
- `src/lib/stock.ts`: products, batches, movements and reports.
- `src/lib/accounts.ts`: pharmacies, staff logins and sessions.
- `src/lib/google.ts` and `src/app/auth/google/`: Sign in with Google.
- `src/lib/schema.ts`: the database tables.
- `src/app/`: the pages. `src/app/actions.ts` handles every form.
