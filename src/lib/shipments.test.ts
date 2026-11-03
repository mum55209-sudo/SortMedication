// Tests for shipments and their warnings, run against a fresh in-memory database.
// Run with: npm test

import { describe, expect, it } from "vitest";
import { contextForUser, createPharmacyAccount, verifyLogin, type Ctx } from "./accounts";
import { one } from "./db";
import { createShipment, shipmentAlert, shipmentAlerts, updateShipmentStatus } from "./shipments";
import { createProduct, parseProductInput } from "./stock";

async function newPharmacy(email: string): Promise<Ctx> {
  await createPharmacyAccount({ pharmacyName: "Test Pharmacy", ownerName: "Owner", email, password: "password123" });
  return contextForUser(await verifyLogin(email, "password123"), null);
}

function day(offset: number) {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

describe("shipmentAlert", () => {
  const today = "2026-11-02";
  it("warns about delayed and overdue shipments", () => {
    expect(shipmentAlert({ status: "delayed", expected_date: "2026-11-10", arrived_at: null }, today)).toBe("delayed");
    expect(shipmentAlert({ status: "ordered", expected_date: "2026-11-01", arrived_at: null }, today)).toBe("late");
    expect(shipmentAlert({ status: "ordered", expected_date: "2026-11-02", arrived_at: null }, today)).toBeNull();
  });
  it("shows an arrived shipment for a week", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    expect(shipmentAlert({ status: "arrived", expected_date: today, arrived_at: new Date("2026-10-30T12:00:00Z") }, today, now)).toBe("arrived");
    expect(shipmentAlert({ status: "arrived", expected_date: today, arrived_at: new Date("2026-10-20T12:00:00Z") }, today, now)).toBeNull();
    expect(shipmentAlert({ status: "cancelled", expected_date: "2026-10-01", arrived_at: null }, today)).toBeNull();
  });
});

describe("shipments", () => {
  it("tracks a shipment from ordered to delayed to arrived", async () => {
    const ctx = await newPharmacy("ship@example.com");
    const productId = await createProduct(ctx, parseProductInput({ name: "Amoxicillin", strength: "500 mg", form: "Capsule", pack_size: "21" }));

    await expect(createShipment(ctx, { supplierId: null, reference: "PO-1", expectedDate: day(3), note: "", items: [] })).rejects.toThrow(/at least one product/);

    const id = await createShipment(ctx, { supplierId: null, reference: "PO-1", expectedDate: day(-2), note: "", items: [{ productId, quantity: 100 }] });
    let alerts = await shipmentAlerts(ctx);
    expect(alerts.map((a) => a.alert)).toEqual(["late"]);
    expect(alerts[0].shipment.items[0]).toMatchObject({ product_id: productId, quantity: 100, product_label: "Amoxicillin 500 mg Capsule" });

    await updateShipmentStatus(ctx, id, { status: "delayed", expectedDate: day(5), delayReason: "Supplier out of stock" });
    alerts = await shipmentAlerts(ctx);
    expect(alerts[0].alert).toBe("delayed");
    expect(alerts[0].text).toContain("Supplier out of stock");

    await updateShipmentStatus(ctx, id, { status: "arrived" });
    alerts = await shipmentAlerts(ctx);
    expect(alerts[0].alert).toBe("arrived");

    // The database view shows the same warning.
    const row = await one<{ alert: string }>("SELECT alert FROM shipment_warnings WHERE shipment_id = $1", [id]);
    expect(row?.alert).toBe("arrived");
  });

  it("can't see another pharmacy's shipments", async () => {
    const a = await newPharmacy("ship-a@example.com");
    const b = await newPharmacy("ship-b@example.com");
    const productId = await createProduct(a, parseProductInput({ name: "Ibuprofen", pack_size: "1" }));
    const id = await createShipment(a, { supplierId: null, reference: "", expectedDate: day(-1), note: "", items: [{ productId, quantity: 5 }] });
    expect(await shipmentAlerts(b)).toEqual([]);
    await expect(updateShipmentStatus(b, id, { status: "arrived" })).rejects.toThrow(/wasn't found/);
    await expect(createShipment(b, { supplierId: null, reference: "", expectedDate: day(1), note: "", items: [{ productId, quantity: 5 }] })).rejects.toThrow(/wasn't found/);
  });
});

describe("inventory_counts view", () => {
  it("adds up stock and flags products running low", async () => {
    const ctx = await newPharmacy("counts@example.com");
    const productId = await createProduct(ctx, parseProductInput({ name: "Metformin", pack_size: "1", reorder_level: "50" }));
    const row = await one<{ on_hand: number; running_low: boolean }>("SELECT on_hand, running_low FROM inventory_counts WHERE product_id = $1", [productId]);
    expect(row).toEqual({ on_hand: 0, running_low: true });
  });
});
