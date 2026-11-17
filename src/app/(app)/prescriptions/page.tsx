import Link from "next/link";
import { PrescriptionTable } from "@/components/PrescriptionTable";
import { can } from "@/lib/domain";
import { requirePage } from "@/lib/session";
import { listPrescriptions } from "@/lib/prescriptions";

export default async function PrescriptionsPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const ctx = await requirePage("patients");
  const { q, show } = await searchParams;
  const all = show === "all";
  const rows = await listPrescriptions(ctx, { q, show: all ? "all" : "active" });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Prescriptions</h1>
          <p className="subtitle">
            To add one, open the patient in <Link href="/patients">Patients</Link>. Cancelled prescriptions are kept for your records.
          </p>
        </div>
      </div>
      <div className="card">
        <form className="toolbar" method="get">
          <label className="grow">
            Find a prescription
            <input name="q" defaultValue={q} placeholder="Rx number, patient or medication" />
          </label>
          <label>
            Show
            <select name="show" defaultValue={all ? "all" : "active"}>
              <option value="active">Active only</option>
              <option value="all">All, including cancelled and used up</option>
            </select>
          </label>
          <button type="submit">Find</button>
        </form>
        <PrescriptionTable
          rows={rows}
          showPatient
          canFill={can(ctx.user.role, "stock.out") && ctx.writable}
          canEdit={ctx.writable}
        />
      </div>
    </>
  );
}
