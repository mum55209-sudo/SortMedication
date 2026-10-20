import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveProductAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { ExpiryTag, Flags, formatDate, formatDateTime, MovementQty, MovementType, Qty } from "@/components/ui";
import { CATEGORIES, can, formatMoney, productFlags, STORAGE, suggestBatch, todayISO } from "@/lib/domain";
import { requireContext } from "@/lib/session";
import { getBatches, getProduct, listSuppliers, movementLog, productLabel } from "@/lib/stock";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;
  const { done } = await searchParams;
  const product = await getProduct(ctx, id).catch(() => notFound());
  const [batches, history, suppliers] = await Promise.all([
    getBatches(ctx, id),
    movementLog(ctx, { productId: id, limit: 200 }),
    listSuppliers(ctx),
  ]);
  const today = todayISO();
  const flags = productFlags(product.reorder_level, batches, today, ctx.pharmacy.expiry_warning_days);
  const suggested = suggestBatch(batches, today);
  const supplier = suppliers.find((s) => s.id === product.supplier_id);
  const branch = ctx.branches.find((b) => b.id === product.branch_id);
  const role = ctx.user.role;

  return (
    <>
      <p><Link href="/inventory">← Inventory</Link></p>
      {done === "received" && <p className="notice">Stock received and recorded.</p>}
      {done === "updated" && <p className="notice">Stock updated and recorded.</p>}
      <div className="page-head">
        <div>
          <h1>{productLabel(product)}</h1>
          <p className="subtitle">
            {product.ndc && <>NDC {product.ndc} · </>}
            {branch?.name} · <Flags {...flags} dea={product.dea_schedule} />
            {product.archived && <span className="tag plain">Archived</span>}
          </p>
        </div>
        <div className="actions">
          {can(role, "stock.receive") && !product.archived && <Link className="button" href={`/receive?product=${id}`}>Receive stock</Link>}
          {can(role, "stock.out") && !product.archived && <Link className="button secondary" href={`/stock-out?product=${id}`}>Stock out</Link>}
          {can(role, "products.edit") && <Link className="button secondary" href={`/products/${id}/edit`}>Edit</Link>}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>On hand</h2>
          <div className="stat"><div className="num"><Qty units={flags.total} packSize={product.pack_size} /></div></div>
          <p className="muted">Reorder at {product.reorder_level} units; order {product.reorder_qty} units.</p>
        </div>
        <div className="card">
          <h2>Details</h2>
          <dl className="details">
            <dt>Pack size</dt><dd>{product.pack_size} units</dd>
            <dt>Category</dt><dd>{CATEGORIES[product.category as keyof typeof CATEGORIES] ?? product.category}</dd>
            <dt>DEA schedule</dt><dd>{product.dea_schedule === "none" ? "Not controlled" : `Schedule ${product.dea_schedule}`}</dd>
            <dt>Barcode</dt><dd>{product.barcode || "—"}</dd>
            <dt>Supplier</dt><dd>{supplier?.name ?? "—"}</dd>
            <dt>Cost / sell</dt><dd>{formatMoney(product.cost_price)} / {formatMoney(product.sell_price)} per pack</dd>
            <dt>Storage</dt><dd>{STORAGE[product.storage as keyof typeof STORAGE] ?? product.storage}</dd>
            <dt>Shelf</dt><dd>{product.location || "—"}</dd>
          </dl>
        </div>
      </div>

      <div className="card">
        <h2>Batches</h2>
        {batches.length === 0 ? (
          <p className="muted">No stock. Use Receive stock when a delivery arrives.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lot number</th><th>Expiry</th><th className="num">Quantity</th><th>Received</th><th>Supplier / invoice</th><th></th></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.lot_number}</strong></td>
                    <td className="nowrap">{formatDate(b.expiry_date)} <ExpiryTag date={b.expiry_date} warningDays={ctx.pharmacy.expiry_warning_days} /></td>
                    <td className="num"><Qty units={b.quantity} packSize={product.pack_size} /></td>
                    <td className="nowrap">{formatDate(b.received_date)}</td>
                    <td>{[b.supplier_name, b.invoice].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{suggested?.id === b.id && <span className="tag ok">Use first</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Movement history</h2>
        {history.length === 0 ? (
          <p className="muted">No movements yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>What</th><th className="num">Qty</th><th>Lot</th><th>By</th><th>Reference</th><th>Note</th></tr></thead>
              <tbody>
                {history.map((m) => (
                  <tr key={m.id}>
                    <td className="nowrap">{formatDateTime(m.created_at)}</td>
                    <td><MovementType type={m.type} /></td>
                    <td className="num"><MovementQty quantity={m.quantity} /></td>
                    <td>{m.lot_number}</td>
                    <td>{m.user_name}</td>
                    <td>{m.reference}</td>
                    <td>{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {can(role, "products.edit") && (
        <ActionForm
          action={archiveProductAction}
          className="actions"
          confirm={product.archived ? undefined : "Archive this product? It will be hidden from the inventory list, but its history is kept."}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="archived" value={product.archived ? "false" : "true"} />
          <button type="submit" className={product.archived ? "secondary" : "danger"}>
            {product.archived ? "Restore product" : "Archive product"}
          </button>
        </ActionForm>
      )}
    </>
  );
}
