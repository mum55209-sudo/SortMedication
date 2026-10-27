import Link from "next/link";
import { ReportHead } from "@/components/ReportHead";
import { Qty } from "@/components/ui";
import { formatMoney } from "@/lib/domain";
import { requireContext } from "@/lib/session";
import { valuationReport } from "@/lib/stock";

export default async function ValuationPage() {
  const ctx = await requireContext();
  const { items, totalCost, totalSell } = await valuationReport(ctx);
  return (
    <>
      <ReportHead title="Stock valuation" subtitle={`${ctx.branch.name} · stock on hand at cost and selling price`} csv="/export/valuation" />
      <div className="grid">
        <div className="card stat"><div className="num">{formatMoney(totalCost)}</div><div className="label">At cost</div></div>
        <div className="card stat"><div className="num">{formatMoney(totalSell)}</div><div className="label">At selling price</div></div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Product</th><th className="num">On hand</th><th className="num">Cost / pack</th><th className="num">Cost value</th><th className="num">Sell value</th></tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/products/${r.id}`}>{r.name}</Link> {r.strength} {r.form}</td>
                  <td className="num"><Qty units={r.total} packSize={r.pack_size} /></td>
                  <td className="num">{formatMoney(r.cost_price)}</td>
                  <td className="num">{formatMoney(r.cost_value)}</td>
                  <td className="num">{formatMoney(r.sell_value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Total</td><td className="num">{formatMoney(totalCost)}</td><td className="num">{formatMoney(totalSell)}</td></tr></tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
