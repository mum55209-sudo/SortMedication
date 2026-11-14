// Tests for prescriptions and removing patients, run against a fresh in-memory database.
// Run with: npm test

import { describe, expect, it } from "vitest";
import { contextForUser, createPharmacyAccount, verifyLogin, type Ctx } from "./accounts";
import { listPatients, parsePatientInput, patientDispenses, savePatient, setPatientRemoved } from "./patients";
import { cancelPrescription, createPrescription, listPrescriptions, parsePrescriptionInput, prescriptionState } from "./prescriptions";
import { createProduct, getBatches, parseProductInput, receiveStock, stockOut } from "./stock";

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
