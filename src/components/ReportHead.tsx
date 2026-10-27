import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";

export function ReportHead({ title, subtitle, csv }: { title: string; subtitle: string; csv: string }) {
  return (
    <>
      <p className="no-print"><Link href="/reports">← Reports</Link></p>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="actions">
          <a className="button secondary" href={csv}>Download CSV</a>
          <PrintButton />
        </div>
      </div>
    </>
  );
}
