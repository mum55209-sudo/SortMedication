# SortMedication

Stock-control software for independent US pharmacies, sold as a subscription
($40/month per pharmacy, 14-day free trial).

Each pharmacy gets its own private account with staff logins. The app tracks
every product and every batch (lot number and expiry date), warns when stock
runs low or is about to expire, and records every stock change in an audit
trail. It stores no patient details.

## What's in version 1

- **Sign up and log in.** A pharmacy signs up, gets a 14-day free trial (no
  card) and a "Main store" branch. The owner adds staff with one of four roles:
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

## Where things are

- `src/lib/domain.ts`: business rules (roles, warnings, trial length, price).
- `src/lib/stock.ts`: products, batches, movements and reports.
- `src/lib/accounts.ts`: pharmacies, staff logins and sessions.
- `src/lib/schema.ts`: the database tables.
- `src/app/`: the pages. `src/app/actions.ts` handles every form.
