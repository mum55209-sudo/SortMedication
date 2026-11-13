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
  expired batches, a **Warnings** list (each product running low, and each
  shipment that is late, delayed or has arrived), plus today's stock movements.
- **Inventory list**, searchable by name, NDC, barcode or shelf, with filters
  and sorting. A barcode scanner typing into the search box jumps straight to
  the product.
- **Add or remove medications**: "+ Add medication" on the Inventory page;
  "Remove medication" on a medication's page hides it from the inventory but
  keeps its stock history (needed for records), and "Restore medication"
  brings it back.
- **Products** with NDC, barcode, strength, form, pack size, category, DEA
  schedule (II–V), reorder level and quantity, supplier, prices, storage and
  shelf location.
- **Receive stock** into a batch (lot, expiry, invoice, supplier).
- **Shipments**: record an order you're expecting (supplier, order number,
  expected date, products). Mark it delayed (with a new date and reason),
  arrived or cancelled. A shipment past its expected date is flagged as late.
- **Stock out**: dispense, return to supplier, expired/destroyed, count
  adjustment, or move to another branch. Suggests the batch that expires
  first and refuses to take more than a batch holds. Schedule II adjustments
  and destruction need a pharmacist confirmation.
- **Reports**: reorder list by supplier, expiry report, stock valuation, and
  the audit log (stock movements and account activity). All download as CSV
  and print to PDF.
- **Ask AI**: a chat assistant (Google Gemini) that answers questions about
  stock, such as what is running low or expiring. See "AI assistant" below.
- **CSV import** of products, with optional opening stock.
- **Settings**: pharmacy details, expiry warning period (30 days by default),
  branches, staff, suppliers, subscription and password.
- **Patients**: basic details (name, date of birth, phone, address,
  allergies, insurance) and what has been dispensed to each patient. Start a
  dispense from the patient's page and the patient is saved with it. Hidden
  from read-only staff. See "Patient information" below before using it with
  real patients.
- **In (+) and Out (−)**: stock coming in (Receive stock) is labelled "In
  (+)" and stock going out is labelled "Out (−)" across the app.
- **Stock record with running count**: every movement in a medication's
  history, the dashboard and the audit log shows "In stock after", the number
  of units on hand right after that In or Out. In Supabase, the
  `stock_record` view shows the same.
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

## Setting up the database (Supabase)

Online, the app keeps its data in a [Supabase](https://supabase.com) database
(Supabase runs a Postgres database for you). You only need to give the app
one line of text, the *connection string*. The app creates all its tables by
itself the first time it starts.

1. Go to https://supabase.com, click **Start your project** and sign in (you
   can use your GitHub account).
2. Click **New project**. Pick a name (for example `sortmedication`), make up a
   strong **database password** and save it somewhere safe, and choose the
   region closest to your pharmacies (for the USA, **East US**). Click
   **Create new project** and wait a minute or two.
3. At the top of the project page click **Connect**. Under **Connection
   string**, choose **Transaction pooler** (port `6543`). Copy the line, which
   looks like
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`.
4. Replace `[YOUR-PASSWORD]` (including the square brackets) with the database
   password from step 2. This full line is your `DATABASE_URL`. Keep it
   private: anyone with it can read and change the data.
5. Put it in Vercel (below). To try Supabase from your own computer too, copy
   `.env.example` to `.env.local` and paste it after `DATABASE_URL=`.

**Prefer to create the tables yourself?** Open **SQL Editor** in Supabase,
paste in everything from [`docs/database.sql`](docs/database.sql) and click
**Run**. Do this on a new, empty Supabase project. The app sees the tables are
there and won't make them again. (After changing `src/lib/schema.ts`, run
`npm run db:sql` to update that file.)

When the app has started once, open **Table Editor** in Supabase and you will
see its tables (`pharmacies`, `products`, `batches`, `movements`,
`shipments`, `patients` and so on). Two read-only views are handy to look at there:
`inventory_counts` (how many units of each product are on the shelf, and
whether it is running low) and `shipment_warnings` (shipments that are late,
delayed or have just arrived).

The app talks to the database directly and does not use Supabase's own web
API, so it switches on *row level security* for every table. That keeps the
data hidden from that API; you don't need to set up any rules. Connections are
encrypted. For the strictest certificate check, download the certificate from
**Project Settings > Database > SSL configuration** and add its text as
`DATABASE_CA_CERT` (optional).

## Patient information (HIPAA)

Patient names, dates of birth, allergies and what was dispensed to whom are
*protected health information* under HIPAA, the US health privacy law. Storing
them for pharmacies makes SortMedication a "business associate", so before
real patients go in:

1. **Sign a BAA with Supabase.** A Business Associate Agreement is a contract
   saying Supabase will protect the data. Supabase only offers one on its
   **Team plan or higher, with the HIPAA add-on** (Dashboard > Organization
   settings > Billing; see supabase.com/docs/guides/security/hipaa-compliance).
   Vercel also needs a BAA (Enterprise plan or its HIPAA add-on) because
   patient details pass through it.
2. **Sign a BAA with each pharmacy** that uses the patient pages.
3. **Keep access tight.** Only owners, pharmacists and technicians can open
   Patients; give read-only to anyone who doesn't need it. Each patient
   record added or changed is written to the audit log (without the health
   details themselves).

Until then, use made-up test patients only.

## Putting it online (Vercel)

1. In Vercel, import this GitHub repository as a new project.
2. In the project's **Settings > Environment Variables**, add `DATABASE_URL`
   with your Supabase connection string from the steps above.
3. Deploy (or **Redeploy** if it was already deployed). The database tables
   are created automatically on first use.

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

## AI assistant (Google Gemini)

The **Ask AI** page lets staff ask questions about stock in plain English,
such as "What's running low?", "What expires in the next 30 days?" or "What
should I reorder?". Google Gemini writes the answers.

To switch it on:

1. Go to https://aistudio.google.com and sign in with a Google account.
2. Click **Get API key**, then **Create API key**. Copy the key. Treat it like
   a password: don't share it or put it in the code.
3. In Vercel, open the project, then **Settings > Environment Variables**.
   Add `GEMINI_API_KEY` with the key as its value, then redeploy.
   (On your own computer, put `GEMINI_API_KEY=...` in a file called
   `.env.local` and restart `npm run dev`.)
4. Optional: `GEMINI_MODEL` picks the model (default `gemini-2.5-flash`).

How it works: the page sends the question to `/api/assistant` on our own
server. The server adds a summary of this branch's stock (products, counts,
reorder levels, expiring batches, open shipments) and asks Gemini. The key
stays on the server, so it never reaches anyone's browser.

**Privacy:** the assistant never sends patient details (names, birth dates,
allergies, insurance, Rx numbers) or staff details to Gemini. Don't paste
patient information into the question box either. Sending patient data to
Gemini would first need a HIPAA business associate agreement with Google
(available on paid Google Cloud / Vertex AI, not the free AI Studio key).

Gemini can make mistakes, so staff should check the stock pages before acting.

## Where things are

- `src/lib/domain.ts`: business rules (roles, warnings, trial length, price).
- `src/lib/stock.ts`: products, batches, movements and reports.
- `src/lib/accounts.ts`: pharmacies, staff logins and sessions.
- `src/lib/google.ts` and `src/app/auth/google/`: Sign in with Google.
- `src/lib/schema.ts`: the database tables.
- `src/app/`: the pages. `src/app/actions.ts` handles every form.
