import Link from "next/link";
import { cancelPrescriptionAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { formatDate, formatDateTime } from "@/components/ui";
import { patientName } from "@/lib/patients";
import { prescriptionState, STATE_LABELS, type Prescription } from "@/lib/prescriptions";

// A list of prescriptions with "Fill" (Out −) and "Cancel" for active ones.
export function PrescriptionTable({
  rows,
  showPatient,
  canFill,
  canEdit,
}: {
  rows: Prescription[];
  showPatient: boolean;
  canFill: boolean;
  canEdit: boolean;
}) {
  if (rows.length === 0) return <p className="muted">No prescriptions.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rx number</th>
            {showPatient && <th>Patient</th>}
            <th>Medication and directions</th>
            <th>Prescriber</th>
            <th className="num">Qty</th>
            <th>Fills</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((rx) => {
            const state = prescriptionState(rx);
            return (
              <tr key={rx.id} className={state === "active" ? "" : "muted"}>
                <td className="nowrap"><strong>{rx.rx_number}</strong><br /><span className="small muted">Written {formatDate(rx.date_written)}</span></td>
                {showPatient && (
                  <td><Link href={`/patients/${rx.patient_id}`}>{patientName({ first_name: rx.patient_first_name, last_name: rx.patient_last_name })}</Link></td>
                )}
                <td>
                  <Link href={`/products/${rx.product_id}`}>{rx.product_label}</Link>
                  {rx.dea_schedule !== "none" && <span className="tag dea">C-{rx.dea_schedule}</span>}
                  {rx.directions && <><br /><span className="small">{rx.directions}</span></>}
                </td>
                <td>{rx.prescriber_name}{rx.prescriber_phone && <><br /><span className="small muted">{rx.prescriber_phone}</span></>}</td>
                <td className="num">{rx.quantity}</td>
                <td className="nowrap">
                  {rx.fills_used} of {1 + rx.refills_allowed} used
                  {rx.last_filled && <><br /><span className="small muted">Last {formatDateTime(rx.last_filled)}</span></>}
                </td>
                <td>
                  <span className={`tag ${state === "active" ? "ok" : state === "used_up" ? "low" : "plain"}`}>{STATE_LABELS[state]}</span>
                  {rx.cancel_reason && <><br /><span className="small muted">{rx.cancel_reason}</span></>}
                </td>
                <td className="right">
                  {state === "active" && (
                    <div className="actions">
                      {canFill && (
                        <Link className="button small" href={`/stock-out?product=${rx.product_id}&patient=${rx.patient_id}&prescription=${rx.id}`}>
                          Out (−) Fill
                        </Link>
                      )}
                      {canEdit && (
                        <ActionForm action={cancelPrescriptionAction} className="inline">
                          <input type="hidden" name="id" value={rx.id} />
                          <input name="reason" placeholder="Reason" aria-label="Reason for cancelling" required size={10} />
                          <button type="submit" className="danger small">Cancel</button>
                        </ActionForm>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
