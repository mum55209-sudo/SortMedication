import Link from "next/link";
import { requireContext } from "@/lib/session";

const REPORTS = [
  { href: "/reports/reorder", title: "Reorder list", text: "Products at or below their reorder level, grouped by supplier." },
  { href: "/reports/expiry", title: "Expiry report", text: "Batches that have expired or will expire soon, soonest first." },
  { href: "/reports/valuation", title: "Stock valuation", text: "What the stock on hand is worth at cost and selling price." },
  { href: "/reports/audit", title: "Audit log", text: "Every stock movement and account change: who, when, what and why." },
];

export default async function ReportsPage() {
  const ctx = await requireContext();
  return (
    <>
      <h1>Reports</h1>
      <p className="subtitle">{ctx.branch.name}. Each report can be downloaded as a CSV spreadsheet, or printed / saved as PDF from your browser.</p>
      <div className="grid">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="card stat">
            <h2>{r.title}</h2>
            <p className="muted">{r.text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
