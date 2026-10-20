import Link from "next/link";
import { redirect } from "next/navigation";
import type { Ctx } from "@/lib/accounts";
import { findByCode, listInventory } from "@/lib/stock";
import { Flags, Qty } from "@/components/ui";

// Step 1 of Receive stock and Stock out: find the product by scanning its
// barcode or searching by name.
export async function ProductPicker({ ctx, q, basePath }: { ctx: Ctx; q?: string; basePath: string }) {
  if (q) {
    const match = await findByCode(ctx, q);
    if (match) redirect(`${basePath}?product=${match}`);
  }
  const rows = (await listInventory(ctx, { q })).slice(0, 50);
  return (
    <div className="card">
      <form className="toolbar" method="get">
        <label className="grow">
          Scan a barcode or search for the product
          <input name="q" defaultValue={q} autoFocus placeholder="Name, NDC or barcode" />
        </label>
        <button type="submit">Find</button>
      </form>
      {rows.length === 0 ? (
        <p className="muted">
          No products found. <Link href="/products/new">Add a new product</Link>.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>NDC</th><th className="num">On hand</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong> {r.strength} {r.form}</td>
                  <td>{r.ndc}</td>
                  <td className="num"><Qty units={r.total} packSize={r.pack_size} /></td>
                  <td><Flags low={r.low} soon={r.soon} expired={r.expired} dea={r.dea_schedule} /></td>
                  <td className="right"><Link className="button small" href={`${basePath}?product=${r.id}`}>Choose</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
