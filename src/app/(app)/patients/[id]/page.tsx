import Link from "next/link";
import { notFound } from "next/navigation";
import { createPrescriptionAction, removePatientAction, savePatientAction } from "@/app/actions";
import { PrescriptionTable } from "@/components/PrescriptionTable";
import { listPrescriptions } from "@/lib/prescriptions";
import { listInventory } from "@/lib/stock";
import { todayISO } from "@/lib/domain";
import { ActionForm } from "@/components/ActionForm";
import { PatientFields } from "@/components/PatientFields";
import { formatDate, formatDateTime } from "@/components/ui";
import { can } from "@/lib/domain";
import { requirePage } from "@/lib/session";
import { getPatient, patientDispenses, patientName } from "@/lib/patients";
import { productLabel } from "@/lib/stock";

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const ctx = await requirePage("patients");
  const { id } = await params;
  const { done } = await searchParams;
  const patient = await getPatient(ctx, id).catch(() => notFound());
  const [dispenses, prescriptions, medications] = await Promise.all([
    patientDispenses(ctx, id),
    listPrescriptions(ctx, { patientId: id, show: "all" }),
    listInventory(ctx),
  ]);
  const editable = ctx.writable && !patient.removed;
  return (
    <>
      <p><Link href="/patients">← All patients</Link></p>
      <div className="page-head">
        <div>
          <h1>{patientName(patient)} {patient.removed && <span className="tag plain">Removed</span>}</h1>
          <p className="subtitle">Born {formatDate(patient.date_of_birth)}{patient.phone && ` · ${patient.phone}`}</p>
        </div>
        {can(ctx.user.role, "stock.out") && editable && (
          <div className="actions">
            <Link className="button" href={`/stock-out?patient=${patient.id}`}>Out (−) Dispense to this patient</Link>
          </div>
        )}
      </div>
      {done === "dispensed" && <p className="notice">Dispense recorded.</p>}
      {patient.removed && (
        <p className="warning">
          This patient was removed. Their records are kept, but nothing new can be dispensed or prescribed until they are restored.
        </p>
      )}
      {patient.allergies && <p className="warning"><strong>Allergies:</strong> {patient.allergies}</p>}

      <div className="card">
        <h2>Prescriptions</h2>
        <PrescriptionTable rows={prescriptions} showPatient={false} canFill={can(ctx.user.role, "stock.out") && editable} canEdit={editable} />
        {editable && (
          <>
            <h3>Add a prescription</h3>
            {medications.length === 0 ? (
              <p className="muted">Add the medication to your inventory first.</p>
            ) : (
              <ActionForm action={createPrescriptionAction} resetOnSuccess>
                <input type="hidden" name="patientId" value={patient.id} />
                <div className="fields">
                  <label>Rx number<input name="rx_number" required /></label>
                  <label>
                    Medication
                    <select name="productId" required defaultValue="">
                      <option value="" disabled>Choose…</option>
                      {medications.map((m) => <option key={m.id} value={m.id}>{productLabel(m)}{m.dea_schedule !== "none" ? ` (C-${m.dea_schedule})` : ""}</option>)}
                    </select>
                  </label>
                  <label>Quantity per fill (units)<input name="quantity" type="number" min={1} step={1} required /></label>
                  <label>Refills allowed<input name="refills_allowed" type="number" min={0} max={99} step={1} defaultValue={0} /></label>
                  <label>Prescriber name<input name="prescriber_name" required placeholder="Dr. …" /></label>
                  <label>Prescriber phone<input name="prescriber_phone" type="tel" /></label>
                  <label>Date written<input name="date_written" type="date" defaultValue={todayISO()} max={todayISO()} required /></label>
                </div>
                <label>Directions<input name="directions" placeholder="e.g. Take 1 capsule 3 times a day for 7 days" /></label>
                <div className="actions"><button type="submit">Add prescription</button></div>
              </ActionForm>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Dispensed to this patient</h2>
        {dispenses.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Medication</th><th className="num">Qty</th><th>Lot</th><th>Rx / reference</th></tr></thead>
              <tbody>
                {dispenses.map((d, i) => (
                  <tr key={i}>
                    <td className="nowrap">{formatDateTime(d.created_at)}</td>
                    <td><Link href={`/products/${d.product_id}`}>{productLabel({ name: d.product_name, strength: d.strength, form: d.form })}</Link></td>
                    <td className="num">{d.quantity}</td>
                    <td>{d.lot_number}</td>
                    <td>{d.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Details</h2>
        <ActionForm action={savePatientAction}>
          <input type="hidden" name="id" value={patient.id} />
          <fieldset disabled={!ctx.writable} className="stack">
            <PatientFields p={patient} />
          </fieldset>
          {ctx.writable && <div className="actions"><button type="submit" className="secondary">Save</button></div>}
        </ActionForm>
      </div>

      {ctx.writable && (
        <ActionForm
          action={removePatientAction}
          className="actions"
          confirm={patient.removed ? undefined : "Remove this patient? They'll be hidden from the list and their active prescriptions cancelled. Their records are kept, and you can restore them later."}
        >
          <input type="hidden" name="id" value={patient.id} />
          <input type="hidden" name="removed" value={patient.removed ? "false" : "true"} />
          <button type="submit" className={patient.removed ? "secondary" : "danger"}>
            {patient.removed ? "Restore patient" : "Remove patient"}
          </button>
        </ActionForm>
      )}
    </>
  );
}
