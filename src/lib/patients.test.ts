// Tests for patient records, run against a fresh in-memory database.
// Run with: npm test

import { describe, expect, it } from "vitest";
import { addStaff, contextForUser, createPharmacyAccount, verifyLogin, type Ctx } from "./accounts";
import { getPatient, listPatients, parsePatientInput, patientDispenses, savePatient } from "./patients";
import { createProduct, getBatches, parseProductInput, receiveStock, stockOut } from "./stock";

async function newPharmacy(email: string): Promise<Ctx> {
  await createPharmacyAccount({ pharmacyName: "Test Pharmacy", ownerName: "Owner", email, password: "password123" });
  return contextForUser(await verifyLogin(email, "password123"), null);
}

const jane = { first_name: "Jane", last_name: "Doe", date_of_birth: "1980-04-12", allergies: "Penicillin", phone: "555-0100" };

describe("patients", () => {
  it("checks the required fields", () => {
    expect(() => parsePatientInput({ first_name: "Jane" })).toThrow(/first and last name/);
    expect(() => parsePatientInput({ first_name: "Jane", last_name: "Doe", date_of_birth: "2999-01-01" })).toThrow(/date of birth/);
  });

  it("saves, finds and updates a patient, and links a dispense to them", async () => {
    const ctx = await newPharmacy("pat@example.com");
    const id = await savePatient(ctx, null, parsePatientInput(jane));
    expect((await listPatients(ctx, "doe")).map((p) => p.id)).toEqual([id]);
    expect((await listPatients(ctx, "1980-04-12")).map((p) => p.id)).toEqual([id]);
    expect(await listPatients(ctx, "smith")).toEqual([]);

    await savePatient(ctx, id, parsePatientInput({ ...jane, allergies: "Penicillin, sulfa" }));
    expect((await getPatient(ctx, id)).allergies).toBe("Penicillin, sulfa");

    const productId = await createProduct(ctx, parseProductInput({ name: "Amoxicillin", pack_size: "1" }));
    await receiveStock(ctx, { productId, lotNumber: "L1", expiryDate: "2099-01-01", receivedDate: "", quantity: 30, supplierId: null, invoice: "" });
    const [batch] = await getBatches(ctx, productId);
    await stockOut(ctx, { productId, batchId: batch.id, type: "dispensed", quantity: 10, reference: "Rx 1", note: "", patientId: id });
    const history = await patientDispenses(ctx, id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ quantity: 10, reference: "Rx 1", product_name: "Amoxicillin" });
  });

  it("keeps patients private to their pharmacy and from read-only staff", async () => {
    const a = await newPharmacy("pat-a@example.com");
    const b = await newPharmacy("pat-b@example.com");
    const id = await savePatient(a, null, parsePatientInput(jane));
    expect(await listPatients(b)).toEqual([]);
    await expect(getPatient(b, id)).rejects.toThrow(/wasn't found/);
    await expect(savePatient(b, id, parsePatientInput(jane))).rejects.toThrow(/wasn't found/);

    await addStaff(a, { name: "Viewer", email: "viewer@example.com", password: "password123", role: "readonly" });
    const viewer = await contextForUser(await verifyLogin("viewer@example.com", "password123"), null);
    await expect(listPatients(viewer)).rejects.toThrow(/role/);
  });
});
