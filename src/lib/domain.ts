// Business rules that don't need the database: roles, movement types,
// warning flags and dates. Kept here so they are easy to read and test.

export const TRIAL_DAYS = 14;
export const PRICE_PER_MONTH_USD = 40;
export const DEFAULT_EXPIRY_WARNING_DAYS = 30;

// ---------- Staff roles ----------

export const ROLES = ["owner", "pharmacist", "technician", "readonly"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  pharmacist: "Pharmacist",
  technician: "Technician",
  readonly: "Read-only",
};

// What each role may do. Anyone logged in can view stock and reports.
export type Permission =
  | "stock.receive" // receive deliveries
  | "stock.out" // dispense, sell, return to supplier
  | "stock.adjust" // count corrections, expired/destroyed, transfers
  | "products.edit" // add and edit products, import CSV
  | "suppliers.edit"
  | "settings.edit" // pharmacy details, branches, staff, billing
  ;

const PERMISSIONS: Record<Role, Permission[]> = {
  owner: ["stock.receive", "stock.out", "stock.adjust", "products.edit", "suppliers.edit", "settings.edit"],
  pharmacist: ["stock.receive", "stock.out", "stock.adjust", "products.edit", "suppliers.edit"],
  technician: ["stock.receive", "stock.out"],
  readonly: [],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

// ---------- Products ----------

export const CATEGORIES = { rx: "Prescription (Rx)", otc: "Over the counter", other: "Other" } as const;
export type Category = keyof typeof CATEGORIES;

export const DEA_SCHEDULES = ["none", "II", "III", "IV", "V"] as const;
export type DeaSchedule = (typeof DEA_SCHEDULES)[number];

export const STORAGE = { room: "Room temperature", fridge: "Fridge", freezer: "Freezer", locked: "Locked cabinet" } as const;
export type Storage = keyof typeof STORAGE;

export const FORMS = ["Tablet", "Capsule", "Liquid", "Injection", "Cream", "Inhaler", "Drops", "Patch", "Other"];

// ---------- Stock movements ----------

// sign: +1 adds stock, -1 removes it, 0 means the user chooses (adjustment).
export const MOVEMENT_TYPES = {
  received: { label: "Received", sign: 1, permission: "stock.receive" },
  dispensed: { label: "Dispensed / sold", sign: -1, permission: "stock.out" },
  returned_to_supplier: { label: "Returned to supplier", sign: -1, permission: "stock.out" },
  expired_destroyed: { label: "Expired / destroyed", sign: -1, permission: "stock.adjust" },
  adjusted: { label: "Count adjustment", sign: 0, permission: "stock.adjust" },
  transfer_out: { label: "Moved to another branch", sign: -1, permission: "stock.adjust" },
  transfer_in: { label: "Moved from another branch", sign: 1, permission: "stock.adjust" },
} as const satisfies Record<string, { label: string; sign: -1 | 0 | 1; permission: Permission }>;
export type MovementType = keyof typeof MOVEMENT_TYPES;

// The kinds of stock-out a person can pick on the "Stock out" screen.
export const STOCK_OUT_TYPES: MovementType[] = ["dispensed", "returned_to_supplier", "expired_destroyed", "adjusted", "transfer_out"];

export function movementLabel(type: string): string {
  return (MOVEMENT_TYPES as Record<string, { label: string }>)[type]?.label ?? type;
}

// ---------- Dates and warnings ----------

// Today's date as YYYY-MM-DD in the pharmacy's local time zone.
// v1 assumes US Eastern time unless APP_TIME_ZONE is set.
export function todayISO(now: Date = new Date()): string {
  const tz = process.env.APP_TIME_ZONE ?? "America/New_York";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const ms = Date.parse(toISO + "T00:00:00Z") - Date.parse(fromISO + "T00:00:00Z");
  return Math.round(ms / 86_400_000);
}

export type ExpiryStatus = "expired" | "soon" | "ok";

export function expiryStatus(expiryISO: string, todayIso: string, warningDays: number): ExpiryStatus {
  const days = daysBetween(todayIso, expiryISO);
  if (days < 0) return "expired";
  if (days <= warningDays) return "soon";
  return "ok";
}

export interface BatchLike {
  id: string;
  expiry_date: string;
  quantity: number;
}

// Flags for a product, worked out from its batches that still hold stock.
export function productFlags(
  reorderLevel: number,
  batches: BatchLike[],
  todayIso: string,
  warningDays: number,
): { total: number; low: boolean; soon: boolean; expired: boolean } {
  const inStock = batches.filter((b) => b.quantity > 0);
  const total = inStock.reduce((sum, b) => sum + b.quantity, 0);
  const statuses = inStock.map((b) => expiryStatus(b.expiry_date, todayIso, warningDays));
  return {
    total,
    low: total <= reorderLevel,
    soon: statuses.includes("soon"),
    expired: statuses.includes("expired"),
  };
}

// The batch to take stock from first: the one expiring soonest that has not
// expired yet ("first expiry, first out").
export function suggestBatch<T extends BatchLike>(batches: T[], todayIso: string): T | undefined {
  return batches
    .filter((b) => b.quantity > 0 && daysBetween(todayIso, b.expiry_date) >= 0)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))[0];
}

// ---------- Subscription ----------

export function trialDaysLeft(trialEndsAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000));
}

// A pharmacy can change data while its trial runs or once it has paid.
// After that its data stays viewable and exportable, but read-only.
export function canWrite(status: string, trialEndsAt: Date, now: Date = new Date()): boolean {
  if (status === "active") return true;
  if (status === "trialing") return trialEndsAt.getTime() > now.getTime();
  return false;
}

// ---------- Small helpers ----------

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

// NDCs are 10 or 11 digits, often written with dashes (e.g. 0093-4155-73).
export function isValidNdc(ndc: string): boolean {
  if (!ndc) return true;
  const digits = ndc.replace(/-/g, "");
  return /^\d{10,11}$/.test(digits) && /^[\d-]+$/.test(ndc);
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
