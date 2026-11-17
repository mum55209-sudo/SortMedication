// "What it's for and typical dose" card on the medication page.
// Reference text lives in src/lib/drug-info.ts.

import { dailyMedUrl, DRUG_INFO_DISCLAIMER, findDrugInfo } from "@/lib/drug-info";

export function DrugInfoCard({ name }: { name: string }) {
  const info = findDrugInfo(name);
  const label = (
    <a href={dailyMedUrl(name)} target="_blank" rel="noopener noreferrer">
      Full label on DailyMed (FDA) ↗
    </a>
  );
  return (
    <div className="card">
      <h2>What it&apos;s for and typical dose</h2>
      {info ? (
        <>
          <dl className="details">
            <dt>Used for</dt><dd>{info.usedFor}</dd>
            <dt>{info.supply ? "How it's used" : "Typical dose"}</dt><dd>{info.dose}</dd>
            {info.caution && (<><dt>Take care</dt><dd>{info.caution}</dd></>)}
          </dl>
          <p className="muted small drug-info-note">{DRUG_INFO_DISCLAIMER} {label}</p>
        </>
      ) : (
        <p className="muted">
          No reference info for this name yet. {label}
        </p>
      )}
    </div>
  );
}

/** One-line "used for" text, for tables and lists. */
export function UsedFor({ name }: { name: string }) {
  const info = findDrugInfo(name);
  if (!info) return null;
  return <div className="muted small">{info.usedFor}</div>;
}
