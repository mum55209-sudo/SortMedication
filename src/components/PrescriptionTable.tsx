import Link from "next/link";
import { cancelPrescriptionAction, fillPrescriptionAction, transferPrescriptionAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { formatDate, formatDateTime } from "@/components/ui";
import { patientName } from "@/lib/patients";
import { prescriptionState, STATE_LABELS, type Prescription } from "@/lib/prescriptions";

// A fill from the last 2 weeks may still be waiting on the shelf, so
// "put it back" starts ticked for those.
function recentlyFilled(last: Date | null): boolean {
  return last !== null && Date.now() - new Date(last).getTime() < 14 * 86_400_000;
}

// A list of prescriptions with "Fill" and "Cancel" for active ones. Fill
// takes the prescribed quantity out of stock, soonest-expiring batches first.
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
            <th className="num">In stock</th>
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
                <td className="num">
                  {rx.in_stock}
                  {state === "active" && rx.in_stock < rx.quantity && <><br /><span className="tag low">Not enough</span></>}
                </td>
                <td className="nowrap">
                  {rx.fills_used} of {1 + rx.refills_allowed} used
                  {rx.last_filled && <><br /><span className="small muted">Last {formatDateTime(rx.last_filled)}</span></>}
                </td>
                <td>
                  <span className={`tag ${state === "active" ? "ok" : state === "used_up" ? "low" : "plain"}`}>{STATE_LABELS[state]}</span>
                  {rx.cancel_reason && <><br /><span className="small muted">{rx.cancel_reason}</span></>}
                  {rx.transferred_to && <><br /><span className="small muted">To {rx.transferred_to}</span></>}
                </td>
                <td className="right">
                  {state === "active" && (
                    <div className="actions">
                      {canFill && (
                        <ActionForm
                          action={fillPrescriptionAction}
                          className="inline"
                          confirm={`Fill Rx ${rx.rx_number}? This takes ${rx.quantity} units of ${rx.product_label} out of stock.`}
                        >
                          <input type="hidden" name="id" value={rx.id} />
                          <input type="hidden" name="patientId" value={rx.patient_id} />
                          <button type="submit" className="small">Fill (−{rx.quantity})</button>
                        </ActionForm>
                      )}
                      {canFill && (
                        <Link className="small" href={`/stock-out?product=${rx.product_id}&patient=${rx.patient_id}&prescription=${rx.id}`}>
                          Choose batch
                        </Link>
                      )}
                      {canEdit && (
                        <details>
                          <summary className="small">Patient moving to another pharmacy?</summary>
                          <ActionForm
                            action={transferPrescriptionAction}
                            className="stack"
                            confirm={`Transfer Rx ${rx.rx_number} out? It can't be filled here after this.`}
                          >
                            <input type="hidden" name="id" value={rx.id} />
                            <input type="hidden" name="patientId" value={rx.patient_id} />
                            <input name="toPharmacy" placeholder="New pharmacy's name" aria-label="Pharmacy the patient is moving to" required size={16} />
                            {canFill && rx.fills_used > 0 && (
                              <label className="inline small">
                                <input
                                  type="checkbox"
                                  name="putBack"
                                  value="yes"
                                  defaultChecked={recentlyFilled(rx.last_filled)}
                                />
                                <span>Put the last fill ({rx.quantity} units) back in stock, it wasn&apos;t picked up</span>
                              </label>
                            )}
                            <button type="submit" className="small">Transfer out</button>
                          </ActionForm>
                        </details>
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
