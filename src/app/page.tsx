import Link from "next/link";
import { redirect } from "next/navigation";
import { PRICE_PER_MONTH_USD, TRIAL_DAYS } from "@/lib/domain";
import { getContext } from "@/lib/session";

export default async function Home() {
  if (await getContext()) redirect("/inventory");
  return (
    <>
      <header className="topbar">
        <span className="logo">SortMedication</span>
        <nav />
        <div className="who">
          <Link href="/login">Sign in</Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <h1>Stock control for independent pharmacies</h1>
          <p>
            Track every product and every batch by lot number and expiry date. Get warned before stock runs low or
            expires, and keep a complete record of every stock change for inspections and recalls.
          </p>
          <div className="actions" style={{ justifyContent: "center" }}>
            <Link className="button" href="/signup">Start your {TRIAL_DAYS}-day free trial</Link>
            <Link className="button secondary" href="/login">Sign in</Link>
          </div>
          <p className="small muted">No card needed for the trial.</p>
        </section>
        <div className="grid">
          <div className="card">
            <h2>Batches and expiry</h2>
            <p>Each delivery is a batch with its lot number and expiry. The app suggests the batch that expires first.</p>
          </div>
          <div className="card">
            <h2>NDC and DEA schedule</h2>
            <p>Products carry their NDC and barcode for scanning, and are flagged by DEA schedule II to V.</p>
          </div>
          <div className="card">
            <h2>Full audit trail</h2>
            <p>Stock only changes through recorded movements: who, when, how many, which batch and why.</p>
          </div>
          <div className="card">
            <h2>Your whole team</h2>
            <p>Owner, pharmacist, technician and read-only logins, with stock kept per branch.</p>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="price">${PRICE_PER_MONTH_USD}<span className="muted" style={{ fontSize: "1rem" }}> / month per pharmacy</span></div>
          <p className="muted">All branches and staff included. Larger groups: ask us about custom pricing.</p>
        </div>
      </main>
    </>
  );
}
