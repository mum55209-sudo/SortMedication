// Stripe calls this address when a subscription changes (paid, card failed,
// cancelled). Add it in Stripe > Developers > Webhooks as
// https://<your site>/api/stripe/webhook. Each message is signed with
// STRIPE_WEBHOOK_SECRET, and unsigned or changed messages are refused.

import { handleStripeEvent, verifyStripeSignature } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "STRIPE_WEBHOOK_SECRET isn't set." }, { status: 503 });
  // The signature covers the exact text Stripe sent, so read it unchanged.
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return Response.json({ error: "Bad signature." }, { status: 400 });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Not JSON." }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event);
    console.log(`Stripe ${event.type} (${event.id}): ${result}`);
  } catch (err) {
    console.error(`Stripe ${event.type} (${event.id}) failed`, err);
    // A 500 makes Stripe try again later.
    return Response.json({ error: "Couldn't save it." }, { status: 500 });
  }
  return Response.json({ received: true });
}
