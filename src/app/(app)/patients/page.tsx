import Link from "next/link";
import { savePatientAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { PatientFields } from "@/components/PatientFields";
import { formatDate } from "@/components/ui";
import { requirePage } from "@/lib/session";
import { listPatients, patientName } from "@/lib/patients";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string; removed?: string }> }) {
  const ctx = await requirePage("patients");
  const { q, removed } = await searchParams;
  const patients = await listPatients(ctx, q, { includeRemoved: removed === "1" });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Patients</h1>
          <p className="subtitle">Basic patient details, allergies and insurance. Only staff who need them can see this page.</p>
        </div>
      </div>

      <div className="card">
        <form className="toolbar" method="get">
          <label className="grow">
            Find a patient
            <input name="q" defaultValue={q} placeholder="Name, phone or date of birth (YYYY-MM-DD)" />
          </label>
          <label className="inline">
            <input type="checkbox" name="removed" value="1" defaultChecked={removed === "1"} /> Include removed patients
          </label>
          <button type="submit">Find</button>
        </form>
        {patients.length === 0 ? (
          <p className="muted">{q ? "No patients match." : "No patients yet."}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Date of birth</th><th>Phone</th><th>Allergies</th><th>Insurance</th></tr></thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/patients/${p.id}`}>{patientName(p)}</Link>{p.removed && <span className="tag plain">Removed</span>}</td>
                    <td className="nowrap">{formatDate(p.date_of_birth)}</td>
                    <td>{p.phone}</td>
                    <td>{p.allergies ? <span className="tag low">{p.allergies}</span> : <span className="muted">None recorded</span>}</td>
                    <td>{p.insurance_provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ctx.writable && (
        <div className="card">
          <h2>Add a patient</h2>
          <ActionForm action={savePatientAction}>
            <PatientFields />
            <div className="actions"><button type="submit">Add patient</button></div>
          </ActionForm>
        </div>
      )}
    </>
  );
}
