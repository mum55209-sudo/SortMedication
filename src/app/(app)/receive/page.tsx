import Link from "next/link";
import { notFound } from "next/navigation";
import { receiveAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { ProductPicker } from "@/components/ProductPicker";
import { todayISO } from "@/lib/domain";
import { requirePage } from "@/lib/session";
import { getProduct, listSuppliers, productLabel } from "@/lib/stock";

export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ product?: string; q?: string }> }) {
  const ctx = await requirePage("stock.receive");
  const { product: productId, q } = await searchParams;

  if (!productId) {
    return (
      <>
        <h1>Receive stock</h1>
        <p className="subtitle">Record a delivery. First choose the product.</p>
        <ProductPicker ctx={ctx} q={q} basePath="/receive" />
      </>
    );
  }

  const product = await getProduct(ctx, productId).catch(() => notFound());
  const suppliers = await listSuppliers(ctx);
  return (
    <>
      <p><Link href="/receive">← Choose another product</Link></p>
      <h1>Receive stock</h1>
      <p className="subtitle">{productLabel(product)}{product.ndc && ` · NDC ${product.ndc}`} · pack of {product.pack_size}</p>
      <div className="card">
        <ActionForm action={receiveAction}>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="packSize" value={product.pack_size} />
          <div className="fields">
            <label>Batch (lot) number<input name="lotNumber" required autoFocus /></label>
            <label>Expiry date<input name="expiryDate" type="date" required min={todayISO()} /></label>
            <label>
              Quantity
              <input name="quantity" type="number" min={1} step={1} required />
            </label>
            <label>
              Counted in
              <select name="unit" defaultValue={product.pack_size > 1 ? "packs" : "units"}>
                <option value="packs">Packs of {product.pack_size}</option>
                <option value="units">Single units</option>
              </select>
            </label>
            <label>Received on<input name="receivedDate" type="date" defaultValue={todayISO()} max={todayISO()} /></label>
            <label>
              Supplier
              <select name="supplierId" defaultValue={product.supplier_id ?? ""}>
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Invoice number<input name="invoice" /></label>
          </div>
          <label>Note (optional)<input name="note" /></label>
          <div className="actions"><button type="submit">Record delivery</button></div>
        </ActionForm>
      </div>
    </>
  );
}
