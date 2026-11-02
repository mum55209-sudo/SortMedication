import Link from "next/link";
import { createShipmentAction, updateShipmentAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { formatDate, formatDateTime } from "@/components/ui";
import { can, todayISO } from "@/lib/domain";
import { requireContext } from "@/lib/session";
import { alertText, listShipments, SHIPMENT_STATUS, shipmentAlert, shipmentTitle } from "@/lib/shipments";
import { listInventory, listSuppliers, productLabel } from "@/lib/stock";

const ITEM_ROWS = 5;

export default async function ShipmentsPage() {
  const ctx = await requireContext();
  const editable = can(ctx.user.role, "stock.receive") && ctx.writable;
  const [shipments, suppliers, products] = await Promise.all([
    listShipments(ctx),
    listSuppliers(ctx),
    listInventory(ctx),
  ]);
  const today = todayISO();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Shipments</h1>
          <p className="subtitle">Orders on their way to {ctx.branch.name}. You&apos;re warned when one is late or has arrived.</p>
        </div>
      </div>

      {editable && (
        <div className="card">
          <h2>Add a shipment</h2>
          {products.length === 0 ? (
            <p className="muted">Add products first in <Link href="/products/new">Inventory → Add product</Link>.</p>
          ) : (
            <ActionForm action={createShipmentAction} resetOnSuccess>
              <div className="fields">
                <label>
                  Supplier
                  <select name="supplierId" defaultValue="">
                    <option value="">None</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label>Order or tracking number<input name="reference" /></label>
                <label>Expected on<input name="expectedDate" type="date" required defaultValue={today} /></label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Product</th><th className="num">Units ordered</th></tr></thead>
                  <tbody>
                    {Array.from({ length: ITEM_ROWS }, (_, i) => (
                      <tr key={i}>
                        <td>
                          <select name="itemProduct" defaultValue="" required={i === 0} aria-label={`Product ${i + 1}`}>
                            <option value="">{i === 0 ? "Choose a product" : "(none)"}</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{productLabel(p)}</option>)}
                          </select>
                        </td>
                        <td className="num">
                          <input name="itemQuantity" type="number" min={1} step={1} aria-label={`Units ${i + 1}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label>Note (optional)<input name="note" /></label>
              <div className="actions"><button type="submit">Add shipment</button></div>
            </ActionForm>
          )}
        </div>
      )}

      {shipments.length === 0 && <div className="card"><p className="muted">No shipments yet.</p></div>}

      {shipments.map((s) => {
        const alert = shipmentAlert(s, today);
        const open = s.status === "ordered" || s.status === "delayed";
        return (
          <div className="card" key={s.id}>
            <h2>
              {shipmentTitle(s)}{" "}
              <span className={`tag ${s.status === "arrived" ? "ok" : alert ? "low" : "plain"}`}>
                {alert === "late" ? "Late" : SHIPMENT_STATUS[s.status]}
              </span>
            </h2>
            {alert && <p className={alert === "arrived" ? "notice" : "warning"}>{alertText(s, alert, today)}</p>}
            <dl className="details">
              <dt>Expected</dt><dd>{formatDate(s.expected_date)}</dd>
              {s.arrived_at && <><dt>Arrived</dt><dd>{formatDateTime(s.arrived_at)}</dd></>}
              {s.note && <><dt>Note</dt><dd>{s.note}</dd></>}
            </dl>
            <ul>
              {s.items.map((i) => (
                <li key={i.product_id}>
                  {i.quantity} × <Link href={`/products/${i.product_id}`}>{i.product_label}</Link>
                  {s.status === "arrived" && editable && (
                    <> · <Link href={`/receive?product=${i.product_id}`}>Receive stock</Link></>
                  )}
                </li>
              ))}
            </ul>
            {editable && open && (
              <div className="actions">
                <ActionForm action={updateShipmentAction} className="inline">
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" name="do" value="arrived">It has arrived</button>
                </ActionForm>
                <ActionForm action={updateShipmentAction} className="inline">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="status" value="delayed" />
                  <input name="expectedDate" type="date" aria-label="New expected date" required min={today} />
                  <input name="delayReason" placeholder="Why (optional)" aria-label="Reason for delay" />
                  <button type="submit" className="secondary">Mark delayed</button>
                </ActionForm>
                <ActionForm action={updateShipmentAction} className="inline" confirm="Cancel this shipment?">
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" name="do" value="cancelled" className="danger">Cancel</button>
                </ActionForm>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
