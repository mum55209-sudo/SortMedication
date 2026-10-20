// Small display pieces shared by many pages.

import { expiryStatus, movementLabel, todayISO } from "@/lib/domain";

const TZ = process.env.APP_TIME_ZONE ?? "America/New_York";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "63 (3 packs)" — quantities are stored in single units.
export function Qty({ units, packSize }: { units: number; packSize: number }) {
  if (packSize <= 1) return <>{units}</>;
  const packs = units / packSize;
  const packText = Number.isInteger(packs) ? `${packs} ${packs === 1 ? "pack" : "packs"}` : `${packs.toFixed(1)} packs`;
  return (
    <>
      {units} <span className="muted small">({packText})</span>
    </>
  );
}

export function Flags({ low, soon, expired, dea }: { low?: boolean; soon?: boolean; expired?: boolean; dea?: string }) {
  return (
    <>
      {dea && dea !== "none" && <span className="tag dea">C-{dea}</span>}
      {expired && <span className="tag expired">Expired stock</span>}
      {soon && <span className="tag soon">Expiring soon</span>}
      {low && <span className="tag low">Running low</span>}
    </>
  );
}

export function ExpiryTag({ date, warningDays }: { date: string; warningDays: number }) {
  const status = expiryStatus(date, todayISO(), warningDays);
  if (status === "expired") return <span className="tag expired">Expired</span>;
  if (status === "soon") return <span className="tag soon">Expires soon</span>;
  return null;
}

export function MovementQty({ quantity }: { quantity: number }) {
  return <span className={quantity > 0 ? "plus" : "minus"}>{quantity > 0 ? `+${quantity}` : quantity}</span>;
}

export function MovementType({ type }: { type: string }) {
  return <>{movementLabel(type)}</>;
}

export function rowClass(flags: { low?: boolean; soon?: boolean; expired?: boolean }): string {
  if (flags.expired) return "red";
  if (flags.low || flags.soon) return "amber";
  return "";
}
