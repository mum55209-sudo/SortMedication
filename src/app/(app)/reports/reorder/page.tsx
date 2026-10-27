import Link from "next/link";
import { ReportHead } from "@/components/ReportHead";
import { Qty } from "@/components/ui";
import { requireContext } from "@/lib/session";
import { reorderReport } from "@/lib/stock";

export default async function ReorderPage() {
  const ctx = await requireContext();
  const groups = await reorderReport(ctx);
  return (
    <>
      <ReportHead title="Reorder list" subtitle={`${ctx.branch.name} · products at or below their reorder level`} csv="/export/reorder" />
      {groups.length === 0 && <div className="card"><p className="muted">Nothing needs reordering.</p></div>}
      {groups.map((g) => (
        <div className="card" key={g.supplier}>
          <h2>{g.supplier}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>NDC</th><th className="num">On hand</th><th className="num">Reorder level</th><th className="num">Suggested order</th></tr></thead>
              <tbody>
                {g.items.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/products/${r.id}`}>{r.name}</Link> {r.strength} {r.form}</td>
                    <td>{r.ndc}</td>
                    <td className="num"><Qty units={r.total} packSize={r.pack_size} /></td>
                    <td className="num">{r.reorder_level}</td>
                    <td className="num"><Qty units={r.reorder_qty} packSize={r.pack_size} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
