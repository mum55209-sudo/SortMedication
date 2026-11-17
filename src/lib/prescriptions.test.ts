// Tests for prescriptions and removing patients, run against a fresh in-memory database.
// Run with: npm test

import { describe, expect, it } from "vitest";
import { contextForUser, createPharmacyAccount, verifyLogin, type Ctx } from "./accounts";
import { listPatients, parsePatientInput, patientDispenses, savePatient, setPatientRemoved } from "./patients";
import { cancelPrescription, createPrescription, listPrescriptions, parsePrescriptionInput, prescriptionState } from "./prescriptions";
import { createProduct, fillPrescription, getBatches, listInventory, parseProductInput, receiveStock, stockOut, transferPrescription } from "./stock";
import { planFill } from "./domain";

async function setup(email: string) {
  await createPharmacyAccount({ pharmacyName: "Rx Pharmacy", ownerName: "Owner", email, password: "password123" });
  const ctx: Ctx = await contextForUser(await verifyLogin(email, "password123"), null);
  const patientId = await savePatient(ctx, null, parsePatientInput({ first_name: "Test", last_name: "Patient", date_of_birth: "1980-01-01" }));
  const productId = await createProduct(ctx, parseProductInput({ name: "Amoxicillin", strength: "500 mg", pack_size: "1" }));
  await receiveStock(ctx, { productId, lotNumber: "L1", expiryDate: "2099-01-01", receivedDate: "", quantity: 100, supplierId: null, invoice: "" });
  const [batch] = await getBatches(ctx, productId);
  return { ctx, patientId, productId, batchId: batch.id };
}

const rxInput = (patientId: string, productId: string, extra: Record<string, string> = {}) =>
  parsePrescriptionInput({ patientId, productId, rx_number: "RX-1", prescriber_name: "Dr. Test", quantity: "21", refills_allowed: "1", ...extra });

describe("prescriptions", () => {
  it("checks the required fields", () => {
    expect(() => parsePrescriptionInput({ productId: "x", prescriber_name: "Dr", quantity: "1" })).toThrow(/Rx/);
    expect(() => parsePrescriptionInput({ productId: "x", rx_number: "1", prescriber_name: "Dr", quantity: "0" })).toThrow(/Quantity/);
  });

  it("allows 1 + refills fills, then stops", async () => {
    const { ctx, patientId, productId, batchId } = await setup("rx1@example.com");
    const rxId = await createPrescription(ctx, rxInput(patientId, productId));
    await expect(createPrescription(ctx, rxInput(patientId, productId))).rejects.toThrow(/already a prescription/);

    const fill = () => stockOut(ctx, { productId, batchId, type: "dispensed", quantity: 21, reference: "", note: "", prescriptionId: rxId });
    await fill();
    await fill();
    await expect(fill()).rejects.toThrow(/no refills left/);

    const [rx] = await listPrescriptions(ctx, { patientId, show: "all" });
    expect(rx).toMatchObject({ fills_used: 2, fills_left: 0 });
    expect(prescriptionState(rx)).toBe("used_up");
    expect(await listPrescriptions(ctx, { patientId })).toEqual([]);
    const history = await patientDispenses(ctx, patientId);
    expect(history.map((h) => h.reference)).toEqual(["Rx RX-1", "Rx RX-1"]);
  });

  it("can be cancelled with a reason, and then can't be filled", async () => {
    const { ctx, patientId, productId, batchId } = await setup("rx2@example.com");
    const rxId = await createPrescription(ctx, rxInput(patientId, productId));
    await expect(cancelPrescription(ctx, rxId, " ")).rejects.toThrow(/reason/);
    await cancelPrescription(ctx, rxId, "Prescriber changed dose");
    await expect(
      stockOut(ctx, { productId, batchId, type: "dispensed", quantity: 21, reference: "", note: "", prescriptionId: rxId }),
    ).rejects.toThrow(/cancelled/);
  });

  it("refuses refills on Schedule II and keeps pharmacies apart", async () => {
    const { ctx, patientId } = await setup("rx3@example.com");
    const cii = await createProduct(ctx, parseProductInput({ name: "Oxycodone", pack_size: "1", dea_schedule: "II" }));
    await expect(createPrescription(ctx, rxInput(patientId, cii))).rejects.toThrow(/Schedule II/);
    await createPrescription(ctx, rxInput(patientId, cii, { refills_allowed: "0" }));

    const other = await setup("rx4@example.com");
    expect(await listPrescriptions(other.ctx, { show: "all" })).toHaveLength(0);
    await expect(createPrescription(other.ctx, rxInput(patientId, other.productId, { rx_number: "RX-9" }))).rejects.toThrow(/patient wasn't found/);
  });
});

describe("removing a patient", () => {
  it("hides them, cancels their prescriptions, blocks dispensing, and can be undone", async () => {
    const { ctx, patientId, productId, batchId } = await setup("rm@example.com");
    const rxId = await createPrescription(ctx, rxInput(patientId, productId));
    await setPatientRemoved(ctx, patientId, true);

    expect(await listPatients(ctx)).toEqual([]);
    expect((await listPatients(ctx, "", { includeRemoved: true }))[0].removed).toBe(true);
    const [rx] = await listPrescriptions(ctx, { patientId, show: "all" });
    expect(rx).toMatchObject({ status: "cancelled", cancel_reason: "Patient removed" });
    await expect(
      stockOut(ctx, { productId, batchId, type: "dispensed", quantity: 1, reference: "", note: "", patientId }),
    ).rejects.toThrow(/removed/);
    await expect(createPrescription(ctx, rxInput(patientId, productId, { rx_number: "RX-2" }))).rejects.toThrow(/removed/);
    expect(rxId).toBeTruthy();

    await setPatientRemoved(ctx, patientId, false);
    expect(await listPatients(ctx)).toHaveLength(1);
  });
});

describe("filling a prescription takes it out of stock", () => {
  const onHand = async (ctx: Ctx, productId: string) =>
    (await getBatches(ctx, productId)).reduce((sum, b) => sum + b.quantity, 0);

  it("plans soonest-expiring batches first and never uses expired stock", () => {
    const batches = [
      { id: "late", expiry_date: "2099-06-01", quantity: 50 },
      { id: "old", expiry_date: "2000-01-01", quantity: 100 },
      { id: "soon", expiry_date: "2098-01-01", quantity: 10 },
    ];
    const plan = planFill(batches, 25, "2026-11-17");
    expect(plan.picks?.map((p) => [p.batch.id, p.quantity])).toEqual([["soon", 10], ["late", 15]]);
    expect(planFill(batches, 61, "2026-11-17")).toMatchObject({ picks: null, usable: 60, expired: 100 });
  });

  it("deducts the prescribed quantity across batches, linked to the patient, and counts one fill", async () => {
    const { ctx, patientId, productId } = await setup("fill1@example.com");
    // setup() received 100 units expiring 2099; add 10 that expire sooner.
    await receiveStock(ctx, { productId, lotNumber: "SOON", expiryDate: "2098-01-01", receivedDate: "", quantity: 10, supplierId: null, invoice: "" });
    const rxId = await createPrescription(ctx, rxInput(patientId, productId));

    const result = await fillPrescription(ctx, rxId);
    expect(result.batches).toEqual([{ lot: "SOON", quantity: 10 }, { lot: "L1", quantity: 11 }]);
    expect(result.leftInStock).toBe(89);
    expect(await onHand(ctx, productId)).toBe(89);
    const [row] = (await listInventory(ctx, {})).filter((r) => r.id === productId);
    expect(row.total).toBe(89);

    const [rx] = await listPrescriptions(ctx, { patientId, show: "all" });
    expect(rx).toMatchObject({ fills_used: 1, fills_left: 1, in_stock: 89 });
    const history = await patientDispenses(ctx, patientId);
    expect(history.reduce((sum, h) => sum + h.quantity, 0)).toBe(21);

    await fillPrescription(ctx, rxId);
    await expect(fillPrescription(ctx, rxId)).rejects.toThrow(/no refills left/);
    expect(await onHand(ctx, productId)).toBe(68);
  });

  it("blocks the fill and takes nothing when there isn't enough usable stock", async () => {
    const { ctx, patientId, productId } = await setup("fill2@example.com");
    const rxId = await createPrescription(ctx, rxInput(patientId, productId, { quantity: "150" }));
    await expect(fillPrescription(ctx, rxId)).rejects.toThrow(/needs 150 units but only 100/);
    expect(await onHand(ctx, productId)).toBe(100);
    const [rx] = await listPrescriptions(ctx, { patientId, show: "all" });
    expect(rx.fills_used).toBe(0);
  });
});

describe("transferring a prescription to another pharmacy", () => {
  it("stops it here and puts the last, not picked up, fill back in stock", async () => {
    const { ctx, patientId, productId } = await setup("move1@example.com");
    await receiveStock(ctx, { productId, lotNumber: "SOON", expiryDate: "2098-01-01", receivedDate: "", quantity: 10, supplierId: null, invoice: "" });
    const rxId = await createPrescription(ctx, rxInput(patientId, productId, { refills_allowed: "2" }));
    await fillPrescription(ctx, rxId); // picked up: 10 from SOON, 11 from L1
    await fillPrescription(ctx, rxId); // prepared for next month: 21 from L1
    const total = async () => (await getBatches(ctx, productId)).reduce((sum, b) => sum + b.quantity, 0);
    expect(await total()).toBe(68);

    await expect(transferPrescription(ctx, rxId, { toPharmacy: " ", putBackLastFill: true })).rejects.toThrow(/pharmacy/);
    const result = await transferPrescription(ctx, rxId, { toPharmacy: "Main St Pharmacy", putBackLastFill: true });
    expect(result.putBack).toBe(21);
    expect(await total()).toBe(89);

    const [rx] = await listPrescriptions(ctx, { patientId, show: "all" });
    expect(rx).toMatchObject({ status: "transferred", transferred_to: "Main St Pharmacy", fills_used: 1 });
    expect(prescriptionState(rx)).toBe("transferred");
    await expect(fillPrescription(ctx, rxId)).rejects.toThrow(/transferred to Main St Pharmacy/);
    await expect(transferPrescription(ctx, rxId, { toPharmacy: "X", putBackLastFill: false })).rejects.toThrow(/already/);
  });

  it("can transfer without touching stock", async () => {
    const { ctx, patientId, productId } = await setup("move2@example.com");
    const rxId = await createPrescription(ctx, rxInput(patientId, productId));
    await fillPrescription(ctx, rxId);
    await transferPrescription(ctx, rxId, { toPharmacy: "Elm Pharmacy", putBackLastFill: false });
    expect((await getBatches(ctx, productId))[0].quantity).toBe(79);
  });
});
