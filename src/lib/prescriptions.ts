// Prescriptions.
//
// A prescription is for one patient and one medication. Each "Dispensed"
// stock-out linked to it is a fill; it allows 1 + refills_allowed fills.
// Prescriptions are never deleted (pharmacies must keep them): they are
// cancelled instead, with a reason. Like patients, this is health
// information, so it needs the "patients" permission.

import { newId, query, transaction, type Queryable } from "./db";
import type { Ctx } from "./accounts";
import { logActivity } from "./accounts";
import { can, isISODate, todayISO } from "./domain";
import { UserError } from "./errors";
import { productLabel, requireCan } from "./stock";

export interface Prescription {
  id: string;
  patient_id: string;
  patient_first_name: string;
  patient_last_name: string;
  product_id: string;
  product_label: string;
  dea_schedule: string;
  rx_number: string;
  prescriber_name: string;
  prescriber_phone: string;
  directions: string;
  quantity: number;
  refills_allowed: number;
  date_written: string;
  status: "active" | "cancelled";
  cancel_reason: string;
  fills_used: number;
  fills_left: number;
  last_filled: Date | null;
}

export type PrescriptionState = "active" | "used_up" | "cancelled";

export function prescriptionState(p: Pick<Prescription, "status" | "fills_left">): PrescriptionState {
  if (p.status === "cancelled") return "cancelled";
  return p.fills_left > 0 ? "active" : "used_up";
}

export const STATE_LABELS: Record<PrescriptionState, string> = {
  active: "Active",
  used_up: "No refills left",
  cancelled: "Cancelled",
};

function requireView(ctx: Ctx) {
  if (!can(ctx.user.role, "patients")) throw new UserError("Your role doesn't allow seeing prescriptions. Ask the pharmacy owner.");
}

export interface PrescriptionInput {
  patientId: string;
  productId: string;
  rxNumber: string;
  prescriberName: string;
  prescriberPhone: string;
  directions: string;
  quantity: number;
  refillsAllowed: number;
  dateWritten: string;
}

export function parsePrescriptionInput(raw: Record<string, string | undefined>): PrescriptionInput {
  const t = (k: string) => (raw[k] ?? "").trim();
  const whole = (k: string) => (t(k) === "" ? NaN : Number(t(k)));
  const input: PrescriptionInput = {
    patientId: t("patientId"),
    productId: t("productId"),
    rxNumber: t("rx_number"),
    prescriberName: t("prescriber_name"),
    prescriberPhone: t("prescriber_phone"),
    directions: t("directions"),
    quantity: whole("quantity"),
    refillsAllowed: t("refills_allowed") === "" ? 0 : whole("refills_allowed"),
    dateWritten: t("date_written") || todayISO(),
  };
  if (!input.productId) throw new UserError("Please choose the medication.");
  if (!input.rxNumber) throw new UserError("Please enter the prescription (Rx) number.");
  if (!input.prescriberName) throw new UserError("Please enter the prescriber's name.");
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new UserError("Quantity must be a whole number above zero.");
  if (!Number.isInteger(input.refillsAllowed) || input.refillsAllowed < 0 || input.refillsAllowed > 99) {
    throw new UserError("Refills must be a whole number (0 if none).");
  }
  if (!isISODate(input.dateWritten) || input.dateWritten > todayISO()) throw new UserError("The date written is not a valid date.");
  return input;
}

const SELECT = `
  SELECT rx.id, rx.patient_id, pa.first_name AS patient_first_name, pa.last_name AS patient_last_name,
         rx.product_id, p.name, p.strength, p.form, p.dea_schedule,
         rx.rx_number, rx.prescriber_name, rx.prescriber_phone, rx.directions, rx.quantity, rx.refills_allowed,
         rx.date_written, rx.status, rx.cancel_reason,
         COALESCE(f.fills, 0)::int AS fills_used, f.last_filled
    FROM prescriptions rx
    JOIN patients pa ON pa.id = rx.patient_id
    JOIN products p ON p.id = rx.product_id
    LEFT JOIN (SELECT prescription_id, COUNT(*) AS fills, MAX(created_at) AS last_filled
                 FROM movements WHERE pharmacy_id = $1 AND prescription_id IS NOT NULL GROUP BY prescription_id) f
      ON f.prescription_id = rx.id
   WHERE rx.pharmacy_id = $1`;

type Row = Omit<Prescription, "product_label" | "fills_left"> & { name: string; strength: string; form: string };

function finish(r: Row): Prescription {
  const { name, strength, form, ...rest } = r;
  return {
    ...rest,
    product_label: productLabel({ name, strength, form }),
    fills_left: Math.max(0, 1 + r.refills_allowed - r.fills_used),
  };
}

export async function listPrescriptions(
  ctx: Ctx,
  opts: { patientId?: string; q?: string; show?: "active" | "all" } = {},
): Promise<Prescription[]> {
  requireView(ctx);
  const params: unknown[] = [ctx.pharmacy.id];
  let where = "";
  if (opts.patientId) {
    params.push(opts.patientId);
    where += ` AND rx.patient_id = $${params.length}`;
  }
  const q = opts.q?.trim().toLowerCase();
  if (q) {
    params.push(q);
    where += ` AND (lower(rx.rx_number) LIKE '%' || $${params.length} || '%'
                 OR lower(pa.first_name || ' ' || pa.last_name) LIKE '%' || $${params.length} || '%'
                 OR lower(pa.last_name || ', ' || pa.first_name) LIKE '%' || $${params.length} || '%'
                 OR lower(p.name) LIKE '%' || $${params.length} || '%')`;
  }
  if (opts.show !== "all") where += " AND rx.status = 'active'";
  const rows = (await query<Row>(`${SELECT}${where} ORDER BY rx.date_written DESC, rx.created_at DESC LIMIT 500`, params)).map(finish);
  return opts.show === "all" ? rows : rows.filter((r) => prescriptionState(r) === "active");
}

export async function getPrescription(ctx: Ctx, id: string, db: Queryable = { query }): Promise<Prescription> {
  requireView(ctx);
  const row = (await db.query<Row>(`${SELECT} AND rx.id = $2`, [ctx.pharmacy.id, id]))[0];
  if (!row) throw new UserError("That prescription wasn't found.");
  return finish(row);
}

export async function createPrescription(ctx: Ctx, input: PrescriptionInput): Promise<string> {
  requireCan(ctx, "patients");
  const id = newId();
  await transaction(async (tx) => {
    const patient = (await tx.query<{ removed: boolean }>("SELECT removed FROM patients WHERE id = $1 AND pharmacy_id = $2", [input.patientId, ctx.pharmacy.id]))[0];
    if (!patient) throw new UserError("That patient wasn't found.");
    if (patient.removed) throw new UserError("This patient was removed. Restore them before adding a prescription.");
    const product = (await tx.query<{ dea_schedule: string; archived: boolean }>(
      "SELECT dea_schedule, archived FROM products WHERE id = $1 AND pharmacy_id = $2",
      [input.productId, ctx.pharmacy.id],
    ))[0];
    if (!product || product.archived) throw new UserError("That medication wasn't found.");
    // Federal law: Schedule II prescriptions can't have refills.
    if (product.dea_schedule === "II" && input.refillsAllowed > 0) {
      throw new UserError("Schedule II prescriptions can't have refills. Set refills to 0.");
    }
    const dup = await tx.query("SELECT 1 FROM prescriptions WHERE pharmacy_id = $1 AND rx_number = $2", [ctx.pharmacy.id, input.rxNumber]);
    if (dup.length > 0) throw new UserError(`There is already a prescription with Rx number ${input.rxNumber}.`);
    await tx.query(
      `INSERT INTO prescriptions (id, pharmacy_id, patient_id, product_id, rx_number, prescriber_name, prescriber_phone,
                                  directions, quantity, refills_allowed, date_written, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, ctx.pharmacy.id, input.patientId, input.productId, input.rxNumber, input.prescriberName, input.prescriberPhone,
       input.directions, input.quantity, input.refillsAllowed, input.dateWritten, ctx.user.id],
    );
    await logActivity(tx, ctx.pharmacy.id, ctx.user.id, "Prescription added", `Rx ${input.rxNumber}`);
  });
  return id;
}

export async function cancelPrescription(ctx: Ctx, id: string, reason: string) {
  requireCan(ctx, "patients");
  const why = reason.trim();
  if (!why) throw new UserError("Please give a reason for cancelling.");
  const rows = await query<{ rx_number: string }>(
    `UPDATE prescriptions SET status = 'cancelled', cancel_reason = $1, updated_at = now()
      WHERE id = $2 AND pharmacy_id = $3 AND status = 'active' RETURNING rx_number`,
    [why, id, ctx.pharmacy.id],
  );
  if (rows.length === 0) throw new UserError("That prescription wasn't found or is already cancelled.");
  await logActivity({ query }, ctx.pharmacy.id, ctx.user.id, "Prescription cancelled", `Rx ${rows[0].rx_number}: ${why}`);
}

// Used by Stock out: checks a fill against the prescription and returns the
// patient it is for.
export async function checkFill(db: Queryable, ctx: Ctx, prescriptionId: string, productId: string): Promise<{ patientId: string; rxNumber: string }> {
  // Lock the prescription so two people can't use the last refill at once.
  await db.query("SELECT id FROM prescriptions WHERE id = $1 AND pharmacy_id = $2 FOR UPDATE", [prescriptionId, ctx.pharmacy.id]);
  const rx = await getPrescription(ctx, prescriptionId, db);
  if (rx.product_id !== productId) throw new UserError("This prescription is for a different medication.");
  const state = prescriptionState(rx);
  if (state === "cancelled") throw new UserError("This prescription was cancelled.");
  if (state === "used_up") throw new UserError("This prescription has no refills left. Contact the prescriber for a new one.");
  const patient = (await db.query<{ removed: boolean }>("SELECT removed FROM patients WHERE id = $1", [rx.patient_id]))[0];
  if (patient?.removed) throw new UserError("This patient was removed. Restore them before dispensing.");
  return { patientId: rx.patient_id, rxNumber: rx.rx_number };
}
