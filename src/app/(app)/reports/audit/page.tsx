import Link from "next/link";
import { ReportHead } from "@/components/ReportHead";
import { formatDateTime, MovementQty, MovementType } from "@/components/ui";
import { listActivity } from "@/lib/accounts";
import { MOVEMENT_TYPES, todayISO } from "@/lib/domain";
import { requireContext } from "@/lib/session";
import { movementLog, productLabel } from "@/lib/stock";

type Search = { from?: string; to?: string; type?: string; view?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireContext();
  const s = await searchParams;
  const today = todayISO();
  const from = s.from ?? new Date(Date.parse(today) - 30 * 86_400_000).toISOString().slice(0, 10);
  const to = s.to ?? today;
  const view = s.view === "activity" ? "activity" : "stock";
  const query = new URLSearchParams({ from, to, ...(s.type ? { type: s.type } : {}) });

  return (
    <>
      <ReportHead
        title="Audit log"
        subtitle={view === "stock" ? "Every stock movement in all branches. Entries can't be edited or deleted." : "Account changes: products, staff, settings."}
        csv={view === "stock" ? `/export/audit?${query}` : "/export/activity"}
      />
      <div className="tabs no-print">
        <Link href="/reports/audit" className={view === "stock" ? "active" : ""}>Stock movements</Link>
        <Link href="/reports/audit?view=activity" className={view === "activity" ? "active" : ""}>Account activity</Link>
      </div>
      {view === "stock" ? <StockLog ctx={ctx} from={from} to={to} type={s.type} /> : <ActivityLog ctx={ctx} />}
    </>
  );
}

async function StockLog({ ctx, from, to, type }: { ctx: Awaited<ReturnType<typeof requireContext>>; from: string; to: string; type?: string }) {
  const rows = await movementLog(ctx, { from, to, type: type || undefined, limit: 2000 });
  return (
    <div className="card">
      <form className="toolbar no-print" method="get">
        <label>From<input type="date" name="from" defaultValue={from} /></label>
        <label>To<input type="date" name="to" defaultValue={to} /></label>
        <label>
          Type
          <select name="type" defaultValue={type ?? ""}>
            <option value="">All</option>
            {Object.entries(MOVEMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <button type="submit">Show</button>
      </form>
      {rows.length === 0 ? (
        <p className="muted">No movements in this period.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Branch</th><th>Product</th><th>What</th><th className="num">Qty</th><th>Lot</th><th>By</th><th>Reference</th><th>Note</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="nowrap">{formatDateTime(m.created_at)}</td>
                  <td>{m.branch_name}</td>
                  <td>
                    <Link href={`/products/${m.product_id}`}>{productLabel({ name: m.product_name, strength: m.strength, form: m.form })}</Link>
                    {m.dea_schedule !== "none" && <span className="tag dea">C-{m.dea_schedule}</span>}
                  </td>
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
  );
}

async function ActivityLog({ ctx }: { ctx: Awaited<ReturnType<typeof requireContext>> }) {
  const rows = await listActivity(ctx, 500);
  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="nowrap">{formatDateTime(a.created_at)}</td>
                <td>{a.user_name ?? "—"}</td>
                <td>{a.action}</td>
                <td>{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
