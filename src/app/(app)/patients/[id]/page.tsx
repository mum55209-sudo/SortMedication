import Link from "next/link";
import { notFound } from "next/navigation";
import { savePatientAction } from "@/app/actions";
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
  const dispenses = await patientDispenses(ctx, id);
  return (
    <>
      <p><Link href="/patients">← All patients</Link></p>
      <div className="page-head">
        <div>
          <h1>{patientName(patient)}</h1>
          <p className="subtitle">Born {formatDate(patient.date_of_birth)}{patient.phone && ` · ${patient.phone}`}</p>
        </div>
        {can(ctx.user.role, "stock.out") && ctx.writable && (
          <div className="actions">
            <Link className="button" href={`/stock-out?patient=${patient.id}`}>Out (−) Dispense to this patient</Link>
          </div>
        )}
      </div>
      {done === "dispensed" && <p className="notice">Dispense recorded.</p>}
      {patient.allergies && <p className="warning"><strong>Allergies:</strong> {patient.allergies}</p>}

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
    </>
  );
}
