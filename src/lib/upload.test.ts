// Tests for photos and PDFs in "Ask AI", using a pretend Gemini (no internet)
// and made-up files in evals/files. Run with: npm test

import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { contextForUser, createPharmacyAccount, verifyLogin, type Ctx } from "./accounts";
import { askAssistant } from "./assistant";
import { createProduct, parseProductInput, receiveStock } from "./stock";
import { checkUpload, MAX_UPLOAD_BYTES } from "./upload";

const fixture = (name: string) => new Uint8Array(readFileSync(`evals/files/${name}`));
let ctx: Ctx;

beforeAll(async () => {
  await createPharmacyAccount({ pharmacyName: "Photo Pharmacy", ownerName: "Owner", email: "photo@example.com", password: "password123" });
  ctx = await contextForUser(await verifyLogin("photo@example.com", "password123"), null);
  const productId = await createProduct(ctx, parseProductInput({ name: "Lisinopril", strength: "10 mg", form: "Tablet", pack_size: "30", reorder_level: "20", reorder_qty: "60", location: "A1" }));
  await receiveStock(ctx, { productId, lotNumber: "LIS-7", expiryDate: "2027-06-30", receivedDate: "", quantity: 84, supplierId: null, invoice: "" });
  process.env.GEMINI_RETRY_DELAY_MS = "1";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

/** A pretend Gemini: first reply is what it "read" from the file, second is the answer. */
function fakeGemini(read: object, answer = "We have 84 units of Lisinopril 10 mg [P1].") {
  process.env.GEMINI_API_KEY = "test-key";
  const sent: { systemInstruction: { parts: { text: string }[] }; contents: { parts: { text?: string; inlineData?: { mimeType: string } }[] }[] }[] = [];
  const replies = [JSON.stringify(read), answer];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string));
    return Response.json({ candidates: [{ content: { parts: [{ text: replies[sent.length - 1] ?? "" }] } }] });
  }));
  return sent;
}

describe("checking uploaded files", () => {
  it("accepts photos and PDFs, by their contents", () => {
    expect(checkUpload(fixture("clear-label.jpg")).mimeType).toBe("image/jpeg");
    expect(checkUpload(new TextEncoder().encode("%PDF-1.7\n...")).mimeType).toBe("application/pdf");
    expect(checkUpload(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])).mimeType).toBe("image/png");
  });

  it("refuses the wrong type with a friendly message", () => {
    expect(() => checkUpload(new TextEncoder().encode("just some text"))).toThrow("photos (JPEG, PNG, WEBP or HEIC) and PDFs");
    expect(() => checkUpload(new TextEncoder().encode("GIF89a...."))).toThrow("photos (JPEG, PNG, WEBP or HEIC) and PDFs");
    expect(() => checkUpload(new Uint8Array())).toThrow("empty");
  });

  it("refuses files that are too big", () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(() => checkUpload(big)).toThrow(/4\.0 MB.*under 4 MB/);
  });
});

// The three eval cases with files.
describe("eval cases with files", () => {
  it("1. clear photo: what Gemini reads finds our records, and the answer has sources", async () => {
    const sent = fakeGemini({ kind: "medicine_label", readable: "yes", text: "Lisinopril Tablets USP 10 mg, 30 tablets, NDC 12345-678-90, LOT LIS-7, EXP 2027-06" });
    const res = await askAssistant(ctx, "Do we have this in stock?", [], checkUpload(fixture("clear-label.jpg")));

    // The photo went to Gemini inside the request (inline), not stored anywhere.
    expect(sent[0].contents[0].parts[0].inlineData?.mimeType).toBe("image/jpeg");
    // The second call has the matching record and what was read, but not the photo again.
    expect(sent[1].systemInstruction.parts[0].text).toContain("Lisinopril 10 mg Tablet: 84 units on hand");
    expect(JSON.stringify(sent[1])).toContain("LOT LIS-7");
    expect(JSON.stringify(sent[1])).not.toContain("inlineData");
    // Same fields as a typed question.
    expect(Object.keys(res).sort()).toEqual(["answer", "sources"]);
    expect(res.sources.map((s) => s.label)).toEqual(["Lisinopril 10 mg Tablet"]);
  });

  it("2. blurry or dark photo: asks for a better photo instead of guessing", async () => {
    const sent = fakeGemini({ kind: "medicine_label", readable: "no", text: "" });
    await expect(askAssistant(ctx, "", [], checkUpload(fixture("blurry-label.jpg")))).rejects.toThrow("too blurry or dark to read");
    expect(sent).toHaveLength(1); // stopped before answering
  });

  it("3. wrong kind of thing: says what it can read instead", async () => {
    const sent = fakeGemini({ kind: "other", readable: "yes", text: "" });
    await expect(askAssistant(ctx, "", [], checkUpload(fixture("wrong-kind-park.jpg")))).rejects.toThrow("doesn't look like a medicine label, delivery slip or invoice");
    expect(sent).toHaveLength(1);
  });

  it("refuses files that show patient details", async () => {
    fakeGemini({ kind: "patient_document", readable: "yes", text: "" });
    await expect(askAssistant(ctx, "", [], checkUpload(fixture("clear-label.jpg")))).rejects.toThrow("patient details");
  });
});
