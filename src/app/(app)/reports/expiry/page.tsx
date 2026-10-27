import Link from "next/link";
import { ReportHead } from "@/components/ReportHead";
import { formatDate, Qty } from "@/components/ui";
import { formatMoney } from "@/lib/domain";
import { requireContext } from "@/lib/session";
import { expiryReport } from "@/lib/stock";

export default async function ExpiryPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requireContext();
  const raw = Number((await searchParams).days);
  const days = Number.isInteger(raw) && raw > 0 && raw <= 730 ? raw : ctx.pharmacy.expiry_warning_days;
  const rows = await expiryReport(ctx, days);
  const value = rows.reduce((s, r) => s + r.value, 0);
  return (
    <>
      <ReportHead title="Expiry report" subtitle={`${ctx.branch.name} · expired or expiring within ${days} days`} csv={`/export/expiry?days=${days}`} />
      <div className="card">
        <form className="toolbar no-print" method="get">
          <label>Expiring within (days)<input name="days" type="number" min={1} max={730} defaultValue={days} /></label>
          <button type="submit">Update</button>
        </form>
        {rows.length === 0 ? (
          <p className="muted">No batches expire in this period.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>Lot</th><th>Expiry</th><th className="num">Days left</th><th className="num">Quantity</th><th className="num">Cost value</th><th>Shelf</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.days_left < 0 ? "red" : "amber"}>
                    <td><Link href={`/products/${r.product_id}`}>{r.product_name}</Link> {r.strength} {r.form}</td>
                    <td>{r.lot_number}</td>
                    <td className="nowrap">{formatDate(r.expiry_date)}</td>
                    <td className="num">{r.days_left < 0 ? `Expired ${-r.days_left}d ago` : r.days_left}</td>
                    <td className="num"><Qty units={r.quantity} packSize={r.pack_size} /></td>
                    <td className="num">{formatMoney(r.value)}</td>
                    <td>{r.location}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5}>Total</td><td className="num">{formatMoney(value)}</td><td /></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
