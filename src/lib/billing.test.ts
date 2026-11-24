// Tests for card payments with Stripe, using a pretend Stripe.
// Run with: npm test

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPharmacyAccount } from "./accounts";
import {
  confirmCheckout,
  createCheckout,
  handleStripeEvent,
  statusFromStripe,
  stripeConfigured,
  stripeForm,
  verifyStripeSignature,
} from "./billing";
import { one } from "./db";
import { canWrite } from "./domain";

const pharmacyRow = (id: string) =>
  one<{
    subscription_status: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_renews_at: Date | null;
    subscription_cancel_at_period_end: boolean;
    trial_ends_at: Date;
    name: string;
    id: string;
  }>("SELECT * FROM pharmacies WHERE id = $1", [id]);

let n = 0;
async function newPharmacy() {
  n += 1;
  const { pharmacyId } = await createPharmacyAccount({
    pharmacyName: `Pay Pharmacy ${n}`,
    ownerName: "Owner",
    email: `pay${n}-${Date.now()}@example.com`,
    password: "password123",
  });
  return pharmacyId;
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.STRIPE_PRICE_ID = "price_123";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_ID;
});

describe("Stripe settings", () => {
  it("is switched off until the key and price are set", () => {
    expect(stripeConfigured()).toBe(true);
    delete process.env.STRIPE_PRICE_ID;
    expect(stripeConfigured()).toBe(false);
  });

  it("writes nested fields the way Stripe reads them", () => {
    expect(stripeForm({ mode: "subscription", line_items: { 0: { price: "p", quantity: 1 } }, skip: undefined })).toBe(
      "mode=subscription&line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1",
    );
  });

  it("maps Stripe's statuses to ours", () => {
    expect(statusFromStripe("trialing")).toBe("active");
    expect(statusFromStripe("active")).toBe("active");
    expect(statusFromStripe("past_due")).toBe("past_due");
    expect(statusFromStripe("canceled")).toBe("cancelled");
    expect(statusFromStripe("incomplete")).toBeNull();
    const past = new Date(Date.now() - 1000);
    expect(canWrite("past_due", past)).toBe(true);
    expect(canWrite("cancelled", past)).toBe(false);
  });
});

describe("Checkout", () => {
  it("asks Stripe for a subscription checkout that keeps the free trial days", async () => {
    const id = await newPharmacy();
    const p = (await pharmacyRow(id))!;
    const fetchMock = vi.fn(async () => Response.json({ url: "https://checkout.stripe.com/c/pay/cs_test_1" }));
    vi.stubGlobal("fetch", fetchMock);

    const url = await createCheckout(p, "owner@example.com", "https://sort-medi.vercel.app/");
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_123");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("line_items[0][price]")).toBe("price_123");
    expect(body.get("client_reference_id")).toBe(id);
    expect(body.get("customer_email")).toBe("owner@example.com");
    expect(body.get("subscription_data[trial_end]")).toBe(String(Math.floor(new Date(p.trial_ends_at).getTime() / 1000)));
    expect(body.get("success_url")).toBe("https://sort-medi.vercel.app/settings/billing?checkout={CHECKOUT_SESSION_ID}");
  });

  it("skips the trial when it has run out", async () => {
    const id = await newPharmacy();
    const p = { ...(await pharmacyRow(id))!, trial_ends_at: new Date(Date.now() - 86_400_000) };
    const fetchMock = vi.fn(async () => Response.json({ url: "https://checkout.stripe.com/x" }));
    vi.stubGlobal("fetch", fetchMock);
    await createCheckout(p, "o@example.com", "https://x.test");
    const body = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.get("subscription_data[trial_end]")).toBeNull();
  });

  it("explains a wrong key or price in plain words", async () => {
    const id = await newPharmacy();
    const p = (await pharmacyRow(id))!;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Invalid API Key provided" } }, { status: 401 })));
    await expect(createCheckout(p, "o@example.com", "https://x.test")).rejects.toThrow("STRIPE_SECRET_KEY");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "No such price: 'prod_1'" } }, { status: 400 })));
    await expect(createCheckout(p, "o@example.com", "https://x.test")).rejects.toThrow("price_, not prod_");
  });

  it("marks the pharmacy subscribed when Stripe confirms the checkout", async () => {
    const id = await newPharmacy();
    const renews = Math.floor(Date.now() / 1000) + 14 * 86_400;
    const session = (ref: string, status = "complete") => ({
      client_reference_id: ref,
      status,
      subscription: { id: "sub_1", status: "trialing", customer: "cus_1", current_period_end: renews },
    });

    vi.stubGlobal("fetch", vi.fn(async () => Response.json(session("someone-else"))));
    expect(await confirmCheckout(id, "cs_test_abc")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(session(id, "open"))));
    expect(await confirmCheckout(id, "cs_test_abc")).toBe(false);
    expect(await confirmCheckout(id, "not-a-checkout/../x")).toBe(false);
    expect((await pharmacyRow(id))!.subscription_status).toBe("trialing");

    vi.stubGlobal("fetch", vi.fn(async () => Response.json(session(id))));
    expect(await confirmCheckout(id, "cs_test_abc")).toBe(true);
    expect(await pharmacyRow(id)).toMatchObject({
      subscription_status: "active",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      subscription_renews_at: new Date(renews * 1000),
    });
  });
});

describe("Webhook", () => {
  const secret = "whsec_test";
  const sign = (body: string, t: number, key = secret) =>
    `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;

  it("only trusts messages signed by Stripe, and recent ones", () => {
    const now = 1_800_000_000;
    const body = '{"id":"evt_1"}';
    expect(verifyStripeSignature(body, sign(body, now), secret, now)).toBe(true);
    expect(verifyStripeSignature(body + " ", sign(body, now), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, now, "whsec_other"), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, now - 600), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, null, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, "garbage", secret, now)).toBe(false);
  });

  it("follows the subscription from paid to cancelled", async () => {
    const id = await newPharmacy();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "sub_w", status: "active", customer: "cus_w", current_period_end: 1_900_000_000 })));
    await handleStripeEvent({
      id: "evt_a",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: id, subscription: "sub_w", customer: "cus_w" } },
    });
    expect((await pharmacyRow(id))!.subscription_status).toBe("active");

    await handleStripeEvent({
      id: "evt_b",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_w", status: "active", customer: "cus_w", cancel_at_period_end: true, current_period_end: 1_900_000_000 } },
    });
    expect((await pharmacyRow(id))!.subscription_cancel_at_period_end).toBe(true);

    await handleStripeEvent({
      id: "evt_c",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_w", status: "past_due", customer: "cus_w" } },
    });
    expect((await pharmacyRow(id))!.subscription_status).toBe("past_due");

    await handleStripeEvent({
      id: "evt_d",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_w", status: "canceled", customer: "cus_w" } },
    });
    expect((await pharmacyRow(id))!.subscription_status).toBe("cancelled");
  });

  it("ignores messages it doesn't need or can't match", async () => {
    expect(await handleStripeEvent({ id: "e", type: "invoice.paid", data: { object: {} } })).toMatch(/ignored/);
    expect(
      await handleStripeEvent({ id: "e", type: "customer.subscription.updated", data: { object: { id: "sub_nobody", status: "active" } } }),
    ).toMatch(/ignored/);
  });
});
