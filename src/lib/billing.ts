// Card payments for the $80/month subscription, using Stripe.
//
// How it works:
// 1. The owner presses "Subscribe" on Settings > Subscription. We ask Stripe
//    for a checkout page and send the owner there. Card details are typed on
//    Stripe's own page, so they never reach our app or our database.
// 2. Stripe sends the owner back to /settings/billing. We ask Stripe whether
//    that checkout finished and, if so, mark the pharmacy as subscribed.
// 3. Stripe also calls our "webhook" (/api/stripe/webhook) whenever the
//    subscription changes: paid, card failed, cancelled. We update the
//    pharmacy to match, so it stays right even if nobody opens the app.
//
// It needs these settings (see "Card payments (Stripe)" in the README):
//   STRIPE_SECRET_KEY      sk_test_... while practising, sk_live_... for real money
//   STRIPE_PRICE_ID        price_... for the $80/month price
//   STRIPE_WEBHOOK_SECRET  whsec_... from the webhook you add in Stripe
//
// We talk to Stripe with plain web requests, so no extra package is needed.

import { createHmac, timingSafeEqual } from "node:crypto";
import { one, query } from "./db";
import { UserError } from "./errors";

// Can be changed for automated tests that use a pretend Stripe.
const API_URL = () => process.env.STRIPE_API_URL || "https://api.stripe.com/v1";

// Stripe won't accept a trial that ends less than 2 days from now.
const MIN_TRIAL_MS = 2 * 86_400_000 + 3_600_000;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

// True while using Stripe's practice keys: nobody is really charged.
export function stripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_") || (process.env.STRIPE_SECRET_KEY ?? "").startsWith("rk_test_");
}

// Turns { a: 1, b: { c: 2 } } into a=1&b[c]=2, the form Stripe reads.
export function stripeForm(data: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") {
      const inner = stripeForm(value as Record<string, unknown>, name);
      if (inner) parts.push(inner);
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join("&");
}

async function stripe<T>(method: "GET" | "POST", path: string, data?: Record<string, unknown>): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new UserError("Card payments aren't switched on yet.");
  let res: Response;
  try {
    res = await fetch(`${API_URL()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
      },
      body: method === "POST" && data ? stripeForm(data) : undefined,
    });
  } catch (err) {
    console.error("Couldn't reach Stripe", err);
    throw new UserError("Couldn't reach Stripe just now. Please try again in a minute.");
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; type?: string } };
  if (!res.ok) {
    const said = body.error?.message ?? "";
    console.error("Stripe error", res.status, said);
    throw new UserError(explainStripeError(res.status, said));
  }
  return body;
}

export function explainStripeError(status: number, said: string): string {
  if (status === 401) {
    return "Stripe didn't accept the secret key. Copy it again from Stripe > Developers > API keys (it starts with sk_test_), update STRIPE_SECRET_KEY in Vercel and redeploy.";
  }
  if (/no such price/i.test(said)) {
    return "Stripe doesn't know that price. Copy the price ID (it starts with price_, not prod_) from your product in Stripe, update STRIPE_PRICE_ID in Vercel and redeploy.";
  }
  if (/test mode.*live mode|live mode.*test mode/i.test(said)) {
    return "The secret key and the price come from different modes (test and live). Make sure both are from Test mode in Stripe.";
  }
  if (/portal|configuration/i.test(said)) {
    return "Stripe's customer portal isn't switched on yet. In Stripe, open Settings > Billing > Customer portal and click Save, then try again.";
  }
  return `Stripe had a problem${said ? `: ${said}` : "."}`;
}

// ---------- Subscription status ----------

// What a Stripe subscription status means for us. Our own statuses:
//   trialing   our free trial, no card yet (set at sign up)
//   active     subscribed with a card, including Stripe's own trial period
//   past_due   a payment failed; Stripe is retrying
//   cancelled  the subscription has ended
export function statusFromStripe(stripeStatus: string): string | null {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "cancelled";
    default:
      // "incomplete" and "paused": nothing has changed yet, so leave it.
      return null;
  }
}

interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  items?: { data?: { current_period_end?: number }[] };
}

async function saveSubscription(pharmacyId: string, sub: StripeSubscription) {
  const status = statusFromStripe(sub.status);
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  await query(
    `UPDATE pharmacies SET
       subscription_status = COALESCE($2, subscription_status),
       stripe_customer_id = $3,
       stripe_subscription_id = $4,
       subscription_renews_at = $5,
       subscription_cancel_at_period_end = $6
     WHERE id = $1`,
    [pharmacyId, status, sub.customer, sub.id, periodEnd ? new Date(periodEnd * 1000) : null, Boolean(sub.cancel_at_period_end)],
  );
}

// ---------- Checkout ----------

export interface BillingPharmacy {
  id: string;
  name: string;
  trial_ends_at: Date;
  stripe_customer_id?: string | null;
}

// Makes a Stripe checkout page for this pharmacy and returns its address.
export async function createCheckout(pharmacy: BillingPharmacy, ownerEmail: string, baseUrl: string, now = new Date()): Promise<string> {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripeConfigured() || !priceId) throw new UserError("Card payments aren't switched on yet.");
  const base = baseUrl.replace(/\/+$/, "");
  // Any free-trial days left carry over, so subscribing early costs nothing extra.
  const trialEnd = new Date(pharmacy.trial_ends_at);
  const keepTrial = trialEnd.getTime() - now.getTime() > MIN_TRIAL_MS;
  const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    line_items: { 0: { price: priceId, quantity: 1 } },
    client_reference_id: pharmacy.id,
    ...(pharmacy.stripe_customer_id ? { customer: pharmacy.stripe_customer_id } : { customer_email: ownerEmail }),
    subscription_data: {
      metadata: { pharmacy_id: pharmacy.id, pharmacy_name: pharmacy.name },
      ...(keepTrial ? { trial_end: Math.floor(trialEnd.getTime() / 1000) } : {}),
    },
    metadata: { pharmacy_id: pharmacy.id },
    success_url: `${base}/settings/billing?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/settings/billing?cancelled=1`,
  });
  return session.url;
}

// When Stripe sends the owner back, check with Stripe that the checkout
// really finished (the address bar alone can't be trusted).
export async function confirmCheckout(pharmacyId: string, checkoutId: string): Promise<boolean> {
  if (!stripeConfigured() || !/^cs_[A-Za-z0-9_]+$/.test(checkoutId)) return false;
  const session = await stripe<{ client_reference_id: string | null; status: string; subscription: StripeSubscription | string | null }>(
    "GET",
    `/checkout/sessions/${checkoutId}?expand[]=subscription`,
  );
  if (session.client_reference_id !== pharmacyId || session.status !== "complete") return false;
  if (!session.subscription || typeof session.subscription === "string") return false;
  await saveSubscription(pharmacyId, session.subscription);
  return true;
}

// Stripe's own page where the owner can change card, see invoices or cancel.
export async function createPortal(customerId: string, baseUrl: string): Promise<string> {
  const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
    customer: customerId,
    return_url: `${baseUrl.replace(/\/+$/, "")}/settings/billing`,
  });
  return session.url;
}

// ---------- Webhook ----------

// Checks the Stripe-Signature header, which proves the message came from
// Stripe and wasn't changed. Messages older than 5 minutes are refused, so an
// old one can't be sent again.
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k?.trim() === "t") timestamp = (v ?? "").trim();
    if (k?.trim() === "v1" && v) signatures.push(v.trim());
  }
  const t = Number(timestamp);
  if (!timestamp || !Number.isFinite(t) || Math.abs(nowSeconds - t) > 300) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"));
  return signatures.some((sig) => {
    const given = Buffer.from(sig);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

// Updates the pharmacy for one webhook message. Returns what it did, for the logs.
export async function handleStripeEvent(event: StripeEvent): Promise<string> {
  const obj = event.data?.object ?? {};
  if (event.type === "checkout.session.completed") {
    const pharmacyId = obj.client_reference_id as string | null;
    const subId = obj.subscription as string | null;
    if (!pharmacyId || !subId) return "ignored: not a subscription checkout";
    const pharmacy = await one<{ id: string }>("SELECT id FROM pharmacies WHERE id = $1", [pharmacyId]);
    if (!pharmacy) return "ignored: unknown pharmacy";
    const sub = await stripe<StripeSubscription>("GET", `/subscriptions/${encodeURIComponent(subId)}`);
    await saveSubscription(pharmacyId, sub);
    return `pharmacy ${pharmacyId} subscribed (${sub.status})`;
  }
  if (event.type.startsWith("customer.subscription.")) {
    const sub = obj as unknown as StripeSubscription;
    const pharmacy =
      (await one<{ id: string }>("SELECT id FROM pharmacies WHERE stripe_subscription_id = $1", [sub.id])) ??
      (sub.metadata?.pharmacy_id
        ? await one<{ id: string }>("SELECT id FROM pharmacies WHERE id = $1", [sub.metadata.pharmacy_id])
        : null);
    if (!pharmacy) return "ignored: no pharmacy for this subscription";
    await saveSubscription(pharmacy.id, sub);
    return `pharmacy ${pharmacy.id} now ${sub.status}`;
  }
  return `ignored: ${event.type}`;
}
