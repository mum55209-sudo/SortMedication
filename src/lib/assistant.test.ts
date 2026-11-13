// Tests for the "Ask AI" assistant, using a pretend Gemini (no internet).
// Run with: npm test

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { contextForUser, createPharmacyAccount, verifyLogin, type Ctx } from "./accounts";
import { askAssistant, cleanHistory, inventorySummary } from "./assistant";
import { parsePatientInput, savePatient } from "./patients";
import { createProduct, getBatches, parseProductInput, receiveStock, stockOut } from "./stock";

function future(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

let ctx: Ctx;

beforeAll(async () => {
  await createPharmacyAccount({ pharmacyName: "AI Pharmacy", ownerName: "Owner", email: "ai@example.com", password: "password123" });
  ctx = await contextForUser(await verifyLogin("ai@example.com", "password123"), null);
  const productId = await createProduct(
    ctx,
    parseProductInput({ name: "Metformin", strength: "500 mg", form: "Tablet", pack_size: "100", reorder_level: "200", reorder_qty: "500", location: "Bay 2" }),
  );
  await receiveStock(ctx, { productId, lotNumber: "MET-1", expiryDate: future(12), receivedDate: "", quantity: 150, supplierId: null, invoice: "" });
  const patientId = await savePatient(ctx, null, parsePatientInput({ first_name: "Zelda", last_name: "Quimby", date_of_birth: "1950-01-02", allergies: "Penicillin" }));
  const batch = (await getBatches(ctx, productId))[0];
  await stockOut(ctx, { productId, batchId: batch.id, type: "dispensed", quantity: 10, reference: "Rx 99", note: "", patientId });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe("inventory summary sent to Gemini", () => {
  it("lists stock, low-stock flags and expiring batches", async () => {
    const text = await inventorySummary(ctx);
    expect(text).toContain("Metformin | 500 mg | Tablet | 140 | 100 | 200 | 500");
    expect(text).toContain("running low");
    expect(text).toContain("MET-1");
  });

  it("never includes patient details", async () => {
    const text = await inventorySummary(ctx);
    for (const secret of ["Zelda", "Quimby", "1950-01-02", "Penicillin", "Rx 99"]) expect(text).not.toContain(secret);
  });
});

describe("askAssistant", () => {
  it("explains when no Gemini key is set", async () => {
    await expect(askAssistant(ctx, "What's low?")).rejects.toThrow("isn't switched on");
  });

  it("sends the question and stock to Gemini and returns the answer", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => Response.json({ candidates: [{ content: { parts: [{ text: "Metformin is running low." }] } }] }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await askAssistant(ctx, "What's low?", [{ role: "user", text: "hi" }, { role: "assistant", text: "Hello" }]);
    expect(answer).toBe("Metformin is running low.");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(":generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body as string);
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
    expect(body.systemInstruction.parts[0].text).toContain("Metformin");
    expect(init.body).not.toContain("Zelda");
  });

  it("gives a friendly message when Gemini says the limit is reached", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("slow down", { status: 429 })));
    await expect(askAssistant(ctx, "What's low?")).rejects.toThrow("wait a minute");
  });

  it("refuses empty or very long questions", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    await expect(askAssistant(ctx, "   ")).rejects.toThrow("type a question");
    await expect(askAssistant(ctx, "x".repeat(1001))).rejects.toThrow("under 1000");
  });
});

describe("cleanHistory", () => {
  it("keeps only valid turns, and only the last 10", () => {
    const raw = [{ role: "system", text: "x" }, { role: "user", text: 5 }, ...Array.from({ length: 12 }, (_, i) => ({ role: "user", text: `q${i}` }))];
    const out = cleanHistory(raw);
    expect(out).toHaveLength(10);
    expect(out[0].text).toBe("q2");
    expect(cleanHistory("nope")).toEqual([]);
  });
});
