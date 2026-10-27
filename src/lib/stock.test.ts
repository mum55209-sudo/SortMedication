// Tests for the stock rules, run against a fresh in-memory database.
// Run with: npm test

import { beforeAll, describe, expect, it } from "vitest";
import { addBranch, contextForUser, createPharmacyAccount, verifyLogin, type Ctx } from "./accounts";
import { one, query } from "./db";
import { productFlags, suggestBatch, canWrite, isValidNdc } from "./domain";
import { parseCsv, toCsv } from "./csv";
import {
  createProduct,
  dashboard,
  getBatches,
  importProducts,
  listInventory,
  movementLog,
  parseProductInput,
  receiveStock,
  stockOut,
} from "./stock";

async function newPharmacy(email: string): Promise<Ctx> {
  await createPharmacyAccount({ pharmacyName: "Test Pharmacy", ownerName: "Owner", email, password: "password123" });
  const user = await verifyLogin(email, "password123");
  return contextForUser(user, null);
}

function future(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

let ctx: Ctx;
let productId: string;

beforeAll(async () => {
  ctx = await newPharmacy("owner@example.com");
  productId = await createProduct(
    ctx,
    parseProductInput({ name: "Amoxicillin", strength: "500 mg", form: "Capsule", pack_size: "21", ndc: "0093-4155-73", reorder_level: "42" }),
  );
});

describe("receiving and taking out stock", () => {
  it("adds stock as a received movement", async () => {
    await receiveStock(ctx, { productId, lotNumber: "LATE", expiryDate: future(300), receivedDate: "", quantity: 63, supplierId: null, invoice: "INV-1" });
    await receiveStock(ctx, { productId, lotNumber: "EARLY", expiryDate: future(10), receivedDate: "", quantity: 21, supplierId: null, invoice: "INV-2" });
    const batches = await getBatches(ctx, productId);
    expect(batches.map((b) => [b.lot_number, b.quantity])).toEqual([["EARLY", 21], ["LATE", 63]]);
  });

  it("merges a delivery with the same lot and expiry into one batch", async () => {
    const batches = await getBatches(ctx, productId);
    const late = batches.find((b) => b.lot_number === "LATE")!;
    await receiveStock(ctx, { productId, lotNumber: "LATE", expiryDate: late.expiry_date, receivedDate: "", quantity: 21, supplierId: null, invoice: "INV-3" });
    const after = await getBatches(ctx, productId);
    expect(after.length).toBe(2);
    expect(after.find((b) => b.lot_number === "LATE")!.quantity).toBe(84);
  });

  it("refuses to take more than a batch holds", async () => {
    const early = (await getBatches(ctx, productId)).find((b) => b.lot_number === "EARLY")!;
    await expect(
      stockOut(ctx, { productId, batchId: early.id, type: "dispensed", quantity: 22, reference: "Rx 1", note: "" }),
    ).rejects.toThrow(/only has 21/);
  });

  it("dispenses and records who did it", async () => {
    const early = (await getBatches(ctx, productId)).find((b) => b.lot_number === "EARLY")!;
    await stockOut(ctx, { productId, batchId: early.id, type: "dispensed", quantity: 21, reference: "Rx 44821", note: "" });
    const log = await movementLog(ctx, { productId });
    expect(log[0]).toMatchObject({ type: "dispensed", quantity: -21, reference: "Rx 44821", user_name: "Owner" });
    expect((await getBatches(ctx, productId)).map((b) => b.lot_number)).toEqual(["LATE"]);
  });

  it("turns a count into an adjustment for the difference", async () => {
    const late = (await getBatches(ctx, productId))[0];
    await expect(stockOut(ctx, { productId, batchId: late.id, type: "adjusted", quantity: 80, reference: "", note: "" })).rejects.toThrow(/note/);
    await stockOut(ctx, { productId, batchId: late.id, type: "adjusted", quantity: 80, reference: "", note: "Shelf count" });
    const log = await movementLog(ctx, { productId });
    expect(log[0]).toMatchObject({ type: "adjusted", quantity: -4 });
    expect((await getBatches(ctx, productId))[0].quantity).toBe(80);
  });

  it("moves stock to another branch", async () => {
    await addBranch(ctx, "Second store", "");
    const fresh = await contextForUser(ctx.user, ctx.branch.id);
    const second = fresh.branches.find((b) => b.name === "Second store")!;
    const late = (await getBatches(fresh, productId))[0];
    await stockOut(fresh, { productId, batchId: late.id, type: "transfer_out", quantity: 30, reference: "", note: "", targetBranchId: second.id });
    expect((await getBatches(fresh, productId))[0].quantity).toBe(50);
    const there = await listInventory(await contextForUser(ctx.user, second.id));
    expect(there.map((r) => [r.name, r.total])).toEqual([["Amoxicillin", 30]]);
  });
});

describe("warnings", () => {
  it("flags low stock, expiring soon and expired", () => {
    const today = "2026-10-20";
    const flags = productFlags(
      50,
      [
        { id: "a", expiry_date: "2026-10-01", quantity: 5 },
        { id: "b", expiry_date: "2026-11-05", quantity: 10 },
        { id: "c", expiry_date: "2027-11-05", quantity: 0 },
      ],
      today,
      30,
    );
    expect(flags).toEqual({ total: 15, low: true, soon: true, expired: true });
  });

  it("suggests the earliest batch that has not expired", () => {
    const pick = suggestBatch(
      [
        { id: "expired", expiry_date: "2026-10-01", quantity: 5 },
        { id: "later", expiry_date: "2027-05-01", quantity: 5 },
        { id: "first", expiry_date: "2026-12-01", quantity: 5 },
        { id: "empty", expiry_date: "2026-11-01", quantity: 0 },
      ],
      "2026-10-20",
    );
    expect(pick?.id).toBe("first");
  });

  it("counts the dashboard numbers", async () => {
    const d = await dashboard(ctx);
    expect(d.productCount).toBe(1);
    expect(d.lowCount).toBe(0);
  });
});

describe("accounts", () => {
  it("keeps each pharmacy's data private", async () => {
    const other = await newPharmacy("other@example.com");
    expect(await listInventory(other)).toEqual([]);
    await expect(receiveStock(other, { productId, lotNumber: "X", expiryDate: future(100), receivedDate: "", quantity: 1, supplierId: null, invoice: "" })).rejects.toThrow(/not found/);
  });

  it("blocks changes after the trial ends until subscribed", async () => {
    const past = new Date(Date.now() - 1000);
    expect(canWrite("trialing", past)).toBe(false);
    expect(canWrite("active", past)).toBe(true);
    const row = await one<{ id: string }>("SELECT id FROM pharmacies WHERE id = $1", [ctx.pharmacy.id]);
    await query("UPDATE pharmacies SET trial_ends_at = now() - interval '1 day' WHERE id = $1", [row!.id]);
    const expired = await contextForUser(ctx.user, null);
    expect(expired.writable).toBe(false);
    await expect(createProduct(expired, parseProductInput({ name: "Ibuprofen" }))).rejects.toThrow(/trial has ended/);
    await query("UPDATE pharmacies SET trial_ends_at = now() + interval '14 days' WHERE id = $1", [row!.id]);
  });

  it("does not let a read-only user change stock", async () => {
    const readonly: Ctx = { ...ctx, user: { ...ctx.user, role: "readonly" } };
    await expect(createProduct(readonly, parseProductInput({ name: "Ibuprofen" }))).rejects.toThrow(/role/);
  });
});

describe("CSV", () => {
  it("round-trips quotes and commas, and neutralises formulas", () => {
    const csv = toCsv(["name", "note"], [["Cream, 30 g", '=HYPERLINK("x")']]);
    expect(parseCsv(csv)).toEqual([{ name: "Cream, 30 g", note: `'=HYPERLINK("x")` }]);
  });

  it("imports products with opening stock, or nothing if a row is wrong", async () => {
    const bad = parseCsv("name,ndc,lot_number,expiry_date,quantity\nMetformin,0093-1048-01,M1,2027-01-31,100\nBroken,12,,,\n");
    expect((await importProducts(ctx, bad)).errors).toEqual(["Row 3: The NDC should be 10 or 11 digits, for example 0093-4155-73."]);
    const good = parseCsv("name,strength,ndc,dea_schedule,lot_number,expiry_date,quantity\nMetformin,500 mg,0093-1048-01,,M1,2027-01-31,100\nOxycodone,5 mg,,CII,OX1,2027-06-30,50\n");
    const result = await importProducts(ctx, good);
    expect(result).toEqual({ created: 2, stocked: 2, errors: [] });
    const inv = await listInventory(ctx, { filter: "controlled" });
    expect(inv.map((r) => [r.name, r.dea_schedule, r.total])).toEqual([["Oxycodone", "II", 50]]);
  });

  it("validates NDCs", () => {
    expect(isValidNdc("0093-4155-73")).toBe(true);
    expect(isValidNdc("12345")).toBe(false);
  });
});
