import Link from "next/link";
import { notFound } from "next/navigation";
import { stockOutAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { ProductPicker } from "@/components/ProductPicker";
import { formatDate, Qty } from "@/components/ui";
import { can, expiryStatus, MOVEMENT_TYPES, STOCK_OUT_TYPES, suggestBatch, todayISO } from "@/lib/domain";
import { requirePage } from "@/lib/session";
import { getBatches, getProduct, productLabel } from "@/lib/stock";
import { getPatient, patientName } from "@/lib/patients";
import { getPrescription, prescriptionState } from "@/lib/prescriptions";

export default async function StockOutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; q?: string; patient?: string; prescription?: string }>;
}) {
  const ctx = await requirePage("stock.out");
  const { product: productId, q, patient: patientId, prescription: prescriptionId } = await searchParams;
  const canSeePatients = can(ctx.user.role, "patients");
  const patient = patientId && canSeePatients ? await getPatient(ctx, patientId).catch(() => null) : null;
  const rx = prescriptionId && canSeePatients ? await getPrescription(ctx, prescriptionId).catch(() => null) : null;
  const rxState = rx ? prescriptionState(rx) : null;
  const forPatient = patient && (
    <>
      <p className="notice">
        Dispensing to <Link href={`/patients/${patient.id}`}>{patientName(patient)}</Link> (born {formatDate(patient.date_of_birth)})
      </p>
      {patient.allergies && <p className="warning"><strong>Check allergies:</strong> {patient.allergies}</p>}
      {rx && rxState === "active" && (
        <p className="notice">
          Filling <strong>Rx {rx.rx_number}</strong> from {rx.prescriber_name}: {rx.quantity} units
          {rx.directions && <>, &ldquo;{rx.directions}&rdquo;</>}. This is fill {rx.fills_used + 1} of {1 + rx.refills_allowed}.
        </p>
      )}
      {rx && rxState !== "active" && (
        <p className="error">
          Rx {rx.rx_number} {rxState === "cancelled" ? "was cancelled" : "has no refills left"}, so it can&apos;t be filled.
        </p>
      )}
    </>
  );

  if (!productId) {
    return (
      <>
        <h1>Stock out (−)</h1>
        <p className="subtitle">Dispense, return, destroy, correct a count or move stock. First choose the product.</p>
        {forPatient}
        <ProductPicker ctx={ctx} q={q} basePath="/stock-out" keep={patient ? { patient: patient.id } : {}} />
      </>
    );
  }

  const product = await getProduct(ctx, productId).catch(() => notFound());
  const batches = (await getBatches(ctx, productId)).filter((b) => b.quantity > 0);
  const today = todayISO();
  const suggested = suggestBatch(batches, today);
  const types = STOCK_OUT_TYPES.filter((t) => can(ctx.user.role, MOVEMENT_TYPES[t].permission));
  const otherBranches = ctx.branches.filter((b) => b.id !== product.branch_id);

  return (
    <>
      <p><Link href={`/products/${product.id}`}>← {productLabel(product)}</Link></p>
      <h1>Stock out (−)</h1>
      <p className="subtitle">{productLabel(product)}{product.ndc && ` · NDC ${product.ndc}`} · pack of {product.pack_size}</p>
      {forPatient}
      {product.dea_schedule !== "none" && (
        <p className="warning">
          <strong>Controlled substance, Schedule {product.dea_schedule}.</strong>{" "}
          {product.dea_schedule === "II"
            ? "Adjustments and destruction must be checked by a pharmacist and recorded in your DEA records too."
            : "Remember to keep your DEA records up to date."}
        </p>
      )}
      {batches.length === 0 ? (
        <div className="card"><p className="muted">There is no stock of this product. <Link href={`/receive?product=${product.id}`}>Receive stock</Link>.</p></div>
      ) : (
        <div className="card">
          <ActionForm action={stockOutAction}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="packSize" value={product.pack_size} />
            <input type="hidden" name="deaSchedule" value={product.dea_schedule} />
            {patient && <input type="hidden" name="patientId" value={patient.id} />}
            {rx && <input type="hidden" name="prescriptionId" value={rx.id} />}
            <fieldset className="group">
              <legend>Which batch?</legend>
              {batches.map((b) => {
                const status = expiryStatus(b.expiry_date, today, ctx.pharmacy.expiry_warning_days);
                return (
                  <label key={b.id} className="inline">
                    <input type="radio" name="batchId" value={b.id} defaultChecked={b.id === (suggested ?? batches[0]).id} required />
                    <span>
                      <strong>{b.lot_number}</strong> · expires {formatDate(b.expiry_date)} · <Qty units={b.quantity} packSize={product.pack_size} />{" "}
                      {b.id === suggested?.id && <span className="tag ok">Expires first, use this</span>}
                      {status === "expired" && <span className="tag expired">Expired</span>}
                      {status === "soon" && <span className="tag soon">Expires soon</span>}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="fields">
              <label>
                What is happening?
                <select name="type" defaultValue={rx && types.includes("dispensed") ? "dispensed" : types[0]} required>
                  {types.map((t) => <option key={t} value={t}>{MOVEMENT_TYPES[t].label}</option>)}
                </select>
              </label>
              <label>
                Quantity
                <input name="quantity" type="number" min={0} step={1} required defaultValue={rx?.quantity} />
                <span className="hint">For a count adjustment, enter the number you actually counted in this batch.</span>
              </label>
              <label>
                Counted in
                <select name="unit" defaultValue="units">
                  <option value="units">Single units</option>
                  {product.pack_size > 1 && <option value="packs">Packs of {product.pack_size}</option>}
                </select>
              </label>
              <label>
                Prescription number or reference
                <input name="reference" placeholder="Rx 44821" defaultValue={rx ? `Rx ${rx.rx_number}` : undefined} />
                <span className="hint">
                  {rx
                    ? "This dispense counts as a fill of the prescription."
                    : patient
                      ? "The patient is saved with this dispense."
                      : "To link a patient, start from their page in Patients."}
                </span>
              </label>
              {otherBranches.length > 0 && types.includes("transfer_out") && (
                <label>
                  Move to branch
                  <select name="targetBranchId" defaultValue="">
                    <option value="">Only for &quot;Moved to another branch&quot;</option>
                    {otherBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            <label>
              Note
              <input name="note" />
              <span className="hint">Required for count adjustments and expired or destroyed stock.</span>
            </label>
            {product.dea_schedule === "II" && (
              <label className="inline">
                <input type="checkbox" name="confirmCii" value="yes" />
                <span>A pharmacist has checked this Schedule II adjustment or destruction.</span>
              </label>
            )}
            <div className="actions"><button type="submit">Record</button></div>
          </ActionForm>
        </div>
      )}
    </>
  );
}
