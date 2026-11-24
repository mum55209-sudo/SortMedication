// A plain checklist of the website's settings, so the owner can see what's
// missing without reading logs. It only says whether each setting is there
// (never its value), plus the exact Google redirect address to copy.

import { headers } from "next/headers";
import Link from "next/link";
import { databaseConfigured, query } from "@/lib/db";
import { callbackUrl, googleConfigured } from "@/lib/google";
import { stripeTestMode } from "@/lib/billing";

export const dynamic = "force-dynamic";

async function databaseWorks(): Promise<{ ok: boolean; note: string }> {
  if (!databaseConfigured()) return { ok: false, note: "DATABASE_URL isn't set in Vercel." };
  try {
    await query("SELECT 1");
    return { ok: true, note: "Connected to the database." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = /password authentication failed/i.test(msg)
      ? "The password inside DATABASE_URL is wrong."
      : /ENOTFOUND|getaddrinfo/i.test(msg)
        ? "The address inside DATABASE_URL is wrong. Copy it again from Supabase > Connect > Transaction pooler."
        : /timeout|ETIMEDOUT|ECONNREFUSED/i.test(msg)
          ? "Couldn't reach Supabase. Check the project isn't paused, and use the Transaction pooler string (port 6543)."
          : "DATABASE_URL is set but the database didn't answer. Copy it again from Supabase > Connect > Transaction pooler.";
    return { ok: false, note: hint };
  }
}

export default async function SetupCheck() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const db = await databaseWorks();
  const rows: { name: string; ok: boolean; note: string }[] = [
    { name: "Database (sign up and sign in)", ...db },
    {
      name: "Google sign-in keys",
      ok: googleConfigured(),
      note: googleConfigured() ? "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set." : "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel.",
    },
    {
      name: "Website address (APP_URL)",
      ok: Boolean(process.env.APP_URL),
      note: process.env.APP_URL ? `Set to ${process.env.APP_URL}` : "Add APP_URL in Vercel: your main address, like https://sort-medi.vercel.app",
    },
    {
      name: "Ask AI (Gemini key)",
      ok: Boolean(process.env.GEMINI_API_KEY),
      note: process.env.GEMINI_API_KEY ? "GEMINI_API_KEY is set." : "Add GEMINI_API_KEY in Vercel (optional).",
    },
    {
      name: "Card payments (Stripe keys)",
      ok: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
      note: !process.env.STRIPE_SECRET_KEY
        ? "Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID in Vercel (optional)."
        : !process.env.STRIPE_PRICE_ID
          ? "Add STRIPE_PRICE_ID (starts with price_) in Vercel."
          : !/^price_/.test(process.env.STRIPE_PRICE_ID)
            ? "STRIPE_PRICE_ID should start with price_ (not prod_). Copy it from the price inside your Stripe product."
            : stripeTestMode()
              ? "Set, in test mode: no real money is taken."
              : "Set, in LIVE mode: real cards are charged.",
    },
    {
      name: "Card payments (Stripe webhook)",
      ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      note: process.env.STRIPE_WEBHOOK_SECRET
        ? "STRIPE_WEBHOOK_SECRET is set."
        : "Add STRIPE_WEBHOOK_SECRET (starts with whsec_) in Vercel, so cancellations and failed payments reach the app.",
    },
  ];
  return (
    <main className="narrow">
      <p><Link href="/">← SortMed</Link></p>
      <div className="card">
        <h1>Setup check</h1>
        <p className="muted">Which settings this website has. After changing anything in Vercel, redeploy and reload this page.</p>
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="nowrap">{r.ok ? "✅" : "❌"}</td>
                <td><strong>{r.name}</strong><br /><span className="small muted">{r.note}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>Google redirect address</h2>
        <p className="small">Paste this exactly into Google Cloud &gt; Google Auth Platform &gt; Clients &gt; your client &gt; Authorized redirect URIs:</p>
        <p><code>{callbackUrl(origin)}</code></p>
        <h2>Stripe webhook address</h2>
        <p className="small">Paste this into Stripe &gt; Developers &gt; Webhooks &gt; Add destination (endpoint URL):</p>
        <p><code>{`${(process.env.APP_URL || origin).replace(/\/+$/, "")}/api/stripe/webhook`}</code></p>
      </div>
    </main>
  );
}
