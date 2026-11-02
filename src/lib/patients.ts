// Basic patient records.
//
// This is protected health information (PHI) under HIPAA. Only staff whose
// role has the "patients" permission can see or change it (not read-only
// staff), every pharmacy only ever sees its own patients, and each change is
// written to the activity log.

import { newId, one, query, type Queryable } from "./db";
import type { Ctx } from "./accounts";
import { logActivity } from "./accounts";
import { can, isISODate, todayISO } from "./domain";
import { UserError } from "./errors";
import { requireCan } from "./stock";

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  address: string;
  allergies: string;
  insurance_provider: string;
  insurance_member_id: string;
  notes: string;
}

export type PatientInput = Omit<Patient, "id">;

function requireView(ctx: Ctx) {
  if (!can(ctx.user.role, "patients")) throw new UserError("Your role doesn't allow seeing patient records. Ask the pharmacy owner.");
}

export function patientName(p: Pick<Patient, "first_name" | "last_name">): string {
  return `${p.last_name}, ${p.first_name}`;
}

export function parsePatientInput(raw: Record<string, string | undefined>): PatientInput {
  const t = (k: string) => (raw[k] ?? "").trim();
  const input: PatientInput = {
    first_name: t("first_name"),
    last_name: t("last_name"),
    date_of_birth: t("date_of_birth"),
    phone: t("phone"),
    address: t("address"),
    allergies: t("allergies"),
    insurance_provider: t("insurance_provider"),
    insurance_member_id: t("insurance_member_id"),
    notes: t("notes"),
  };
  if (!input.first_name || !input.last_name) throw new UserError("Please enter the patient's first and last name.");
  if (!isISODate(input.date_of_birth) || input.date_of_birth > todayISO()) {
    throw new UserError("Please enter the patient's date of birth.");
  }
  return input;
}

const FIELDS = [
  "first_name",
  "last_name",
  "date_of_birth",
  "phone",
  "address",
  "allergies",
  "insurance_provider",
  "insurance_member_id",
  "notes",
] as const;

export async function listPatients(ctx: Ctx, q = ""): Promise<Patient[]> {
  requireView(ctx);
  const search = q.trim().toLowerCase();
  return query<Patient>(
    `SELECT * FROM patients
      WHERE pharmacy_id = $1
        AND ($2 = '' OR lower(first_name || ' ' || last_name) LIKE '%' || $2 || '%'
             OR lower(last_name || ', ' || first_name) LIKE '%' || $2 || '%'
             OR replace(phone, '-', '') LIKE '%' || replace($2, '-', '') || '%'
             OR date_of_birth::text = $2)
      ORDER BY last_name, first_name
      LIMIT 200`,
    [ctx.pharmacy.id, search],
  );
}

export async function getPatient(ctx: Ctx, id: string): Promise<Patient> {
  requireView(ctx);
  const p = await one<Patient>("SELECT * FROM patients WHERE id = $1 AND pharmacy_id = $2", [id, ctx.pharmacy.id]);
  if (!p) throw new UserError("That patient wasn't found.");
  return p;
}

export async function savePatient(ctx: Ctx, id: string | null, input: PatientInput): Promise<string> {
  requireCan(ctx, "patients");
  const values = FIELDS.map((f) => input[f]);
  if (id) {
    const rows = await query(
      `UPDATE patients SET ${FIELDS.map((f, i) => `${f} = $${i + 1}`).join(", ")}, updated_at = now()
        WHERE id = $${FIELDS.length + 1} AND pharmacy_id = $${FIELDS.length + 2} RETURNING id`,
      [...values, id, ctx.pharmacy.id],
    );
    if (rows.length === 0) throw new UserError("That patient wasn't found.");
    // Log who changed a record, but keep health details out of the log.
    await logActivity({ query }, ctx.pharmacy.id, ctx.user.id, "Patient record updated", `Patient ${id.slice(0, 8)}`);
    return id;
  }
  const newPatientId = newId();
  await query(
    `INSERT INTO patients (id, pharmacy_id, ${FIELDS.join(", ")})
     VALUES ($1, $2, ${FIELDS.map((_, i) => `$${i + 3}`).join(", ")})`,
    [newPatientId, ctx.pharmacy.id, ...values],
  );
  await logActivity({ query }, ctx.pharmacy.id, ctx.user.id, "Patient record added", `Patient ${newPatientId.slice(0, 8)}`);
  return newPatientId;
}

// Checks a patient chosen on the Stock out form belongs to this pharmacy.
export async function checkPatient(db: Queryable, ctx: Ctx, patientId: string | null | undefined): Promise<string | null> {
  if (!patientId) return null;
  requireView(ctx);
  const rows = await db.query("SELECT 1 FROM patients WHERE id = $1 AND pharmacy_id = $2", [patientId, ctx.pharmacy.id]);
  if (rows.length === 0) throw new UserError("That patient wasn't found.");
  return patientId;
}

export interface DispenseRow {
  created_at: Date;
  quantity: number;
  reference: string;
  product_id: string;
  product_name: string;
  strength: string;
  form: string;
  lot_number: string;
}

// What has been dispensed to a patient, newest first.
export async function patientDispenses(ctx: Ctx, patientId: string): Promise<DispenseRow[]> {
  requireView(ctx);
  return query<DispenseRow>(
    `SELECT m.created_at, -m.quantity AS quantity, m.reference, p.id AS product_id, p.name AS product_name,
            p.strength, p.form, b.lot_number
       FROM movements m JOIN products p ON p.id = m.product_id JOIN batches b ON b.id = m.batch_id
      WHERE m.pharmacy_id = $1 AND m.patient_id = $2
      ORDER BY m.created_at DESC
      LIMIT 200`,
    [ctx.pharmacy.id, patientId],
  );
}
