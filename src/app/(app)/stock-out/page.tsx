import Link from "next/link";
import { notFound } from "next/navigation";
import { stockOutAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { ProductPicker } from "@/components/ProductPicker";
import { formatDate, Qty } from "@/components/ui";
import { can, expiryStatus, MOVEMENT_TYPES, STOCK_OUT_TYPES, suggestBatch, todayISO } from "@/lib/domain";
import { requirePage } from "@/lib/session";
import { getBatches, getProduct, productLabel } from "@/lib/stock";

export default async function StockOutPage({ searchParams }: { searchParams: Promise<{ product?: string; q?: string }> }) {
  const ctx = await requirePage("stock.out");
  const { product: productId, q } = await searchParams;

  if (!productId) {
    return (
      <>
        <h1>Stock out</h1>
        <p className="subtitle">Dispense, return, destroy, correct a count or move stock. First choose the product.</p>
        <ProductPicker ctx={ctx} q={q} basePath="/stock-out" />
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
      <h1>Stock out</h1>
      <p className="subtitle">{productLabel(product)}{product.ndc && ` · NDC ${product.ndc}`} · pack of {product.pack_size}</p>
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
                <select name="type" defaultValue={types[0]} required>
                  {types.map((t) => <option key={t} value={t}>{MOVEMENT_TYPES[t].label}</option>)}
                </select>
              </label>
              <label>
                Quantity
                <input name="quantity" type="number" min={0} step={1} required />
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
                <input name="reference" placeholder="Rx 44821" />
                <span className="hint">Never enter patient names.</span>
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
