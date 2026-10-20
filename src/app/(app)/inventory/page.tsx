import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/domain";
import { requireContext } from "@/lib/session";
import { findByCode, listInventory } from "@/lib/stock";
import { Flags, formatDate, Qty, rowClass } from "@/components/ui";

type Search = { q?: string; sort?: string; filter?: string; archived?: string };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireContext();
  const params = await searchParams;
  // A barcode scanner types the code and presses Enter: jump straight to the product.
  if (params.q) {
    const match = await findByCode(ctx, params.q);
    if (match) redirect(`/products/${match}`);
  }
  const rows = await listInventory(ctx, { ...params, includeArchived: params.archived === "1" });
  const exportQuery = new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.filter ? { filter: params.filter } : {}) });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
          <p className="subtitle">{ctx.branch.name} · {rows.length} products</p>
        </div>
        <div className="actions">
          {can(ctx.user.role, "products.edit") && <Link className="button" href="/products/new">Add product</Link>}
          {can(ctx.user.role, "products.edit") && <Link className="button secondary" href="/import">Import CSV</Link>}
          <a className="button secondary" href={`/export/inventory?${exportQuery}`}>Export CSV</a>
        </div>
      </div>

      <div className="card">
        <form className="toolbar" method="get">
          <label className="grow">
            Search or scan
            <input name="q" defaultValue={params.q} placeholder="Name, strength, NDC, barcode or shelf" autoFocus />
          </label>
          <label>
            Show
            <select name="filter" defaultValue={params.filter ?? ""}>
              <option value="">All products</option>
              <option value="low">Running low</option>
              <option value="soon">Expiring soon</option>
              <option value="expired">Has expired stock</option>
              <option value="controlled">Controlled (DEA II–V)</option>
            </select>
          </label>
          <label>
            Sort by
            <select name="sort" defaultValue={params.sort ?? "name"}>
              <option value="name">Name</option>
              <option value="stock">Stock (lowest first)</option>
              <option value="expiry">Next expiry</option>
              <option value="location">Shelf location</option>
            </select>
          </label>
          <label className="inline">
            <input type="checkbox" name="archived" value="1" defaultChecked={params.archived === "1"} /> Include archived
          </label>
          <button type="submit">Search</button>
        </form>

        {rows.length === 0 ? (
          <p className="muted">
            {params.q || params.filter ? "No products match." : "No products yet. Add your first product or import a CSV file."}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th><th>NDC</th><th className="num">On hand</th><th>Next expiry</th><th>Shelf</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.archived ? "muted" : rowClass(r)}>
                    <td>
                      <Link href={`/products/${r.id}`}><strong>{r.name}</strong></Link> {r.strength} {r.form}
                      {r.archived && <span className="tag plain">Archived</span>}
                    </td>
                    <td className="nowrap">{r.ndc}</td>
                    <td className="num nowrap"><Qty units={r.total} packSize={r.pack_size} /></td>
                    <td className="nowrap">{formatDate(r.next_expiry)}</td>
                    <td>{r.location}</td>
                    <td><Flags low={r.low} soon={r.soon} expired={r.expired} dea={r.dea_schedule} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
