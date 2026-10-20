import Link from "next/link";
import { can } from "@/lib/domain";
import { requireContext } from "@/lib/session";
import { dashboard, productLabel } from "@/lib/stock";
import { formatDateTime, MovementQty, MovementType } from "@/components/ui";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const ctx = await requireContext();
  const { welcome } = await searchParams;
  const d = await dashboard(ctx);
  const role = ctx.user.role;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{ctx.pharmacy.name}</h1>
          <p className="subtitle">{ctx.branch.name} · expiry warnings at {ctx.pharmacy.expiry_warning_days} days</p>
        </div>
        <div className="actions">
          {can(role, "stock.receive") && <Link className="button" href="/receive">Receive stock</Link>}
          {can(role, "stock.out") && <Link className="button secondary" href="/stock-out">Stock out</Link>}
        </div>
      </div>

      {welcome && d.productCount === 0 && (
        <div className="card">
          <h2>Welcome! Here&apos;s how to get started</h2>
          <ol>
            <li>Add your suppliers in <Link href="/settings/suppliers">Settings → Suppliers</Link> (optional).</li>
            <li>Add products one by one in <Link href="/products/new">Inventory → Add product</Link>, or bring in a spreadsheet with <Link href="/import">Import CSV</Link>.</li>
            <li>Record deliveries with <Link href="/receive">Receive stock</Link>, entering the lot number and expiry from the pack.</li>
            <li>Invite your team in <Link href="/settings/staff">Settings → Staff</Link>.</li>
          </ol>
        </div>
      )}

      <div className="grid">
        <Link href="/inventory" className="card stat green">
          <div className="num">{d.productCount}</div>
          <div className="label">Products</div>
        </Link>
        <Link href="/inventory?filter=low" className="card stat amber">
          <div className="num">{d.lowCount}</div>
          <div className="label">Running low</div>
        </Link>
        <Link href="/reports/expiry" className="card stat amber">
          <div className="num">{d.soonBatches}</div>
          <div className="label">Batches expiring within {ctx.pharmacy.expiry_warning_days} days</div>
        </Link>
        <Link href="/inventory?filter=expired" className="card stat red">
          <div className="num">{d.expiredBatches}</div>
          <div className="label">Expired batches still in stock</div>
        </Link>
      </div>

      <div className="card">
        <h2>Today&apos;s stock movements</h2>
        {d.todays.length === 0 ? (
          <p className="muted">Nothing yet today.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Product</th><th>What</th><th className="num">Qty</th><th>Lot</th><th>By</th><th>Reference</th></tr>
              </thead>
              <tbody>
                {d.todays.map((m) => (
                  <tr key={m.id}>
                    <td className="nowrap">{formatDateTime(m.created_at)}</td>
                    <td><Link href={`/products/${m.product_id}`}>{productLabel({ name: m.product_name, strength: m.strength, form: m.form })}</Link></td>
                    <td><MovementType type={m.type} /></td>
                    <td className="num"><MovementQty quantity={m.quantity} /></td>
                    <td>{m.lot_number}</td>
                    <td>{m.user_name}</td>
                    <td>{m.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small"><Link href="/reports/audit">See the full audit log →</Link></p>
      </div>
    </>
  );
}
