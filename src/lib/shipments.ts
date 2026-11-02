// Shipments: orders on their way from a supplier.
//
// A shipment is "ordered" until someone marks it delayed, arrived or
// cancelled. The app warns about a shipment when it is marked delayed, when
// its expected date has passed and it still hasn't arrived, and for a week
// after it arrives (as a reminder to record the stock with Receive stock).

import { newId, query, transaction } from "./db";
import type { Ctx } from "./accounts";
import { logActivity } from "./accounts";
import { daysBetween, isISODate, todayISO } from "./domain";
import { UserError } from "./errors";
import { productLabel, requireCan } from "./stock";

export const SHIPMENT_STATUS = {
  ordered: "On its way",
  delayed: "Delayed",
  arrived: "Arrived",
  cancelled: "Cancelled",
} as const;
export type ShipmentStatus = keyof typeof SHIPMENT_STATUS;

// How long an "arrived" shipment keeps showing on the dashboard.
export const ARRIVED_NOTICE_DAYS = 7;

export interface ShipmentItem {
  product_id: string;
  product_label: string;
  quantity: number;
}

export interface Shipment {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  reference: string;
  expected_date: string;
  status: ShipmentStatus;
  delay_reason: string;
  arrived_at: Date | null;
  note: string;
  created_at: Date;
  items: ShipmentItem[];
}

export type ShipmentAlert = "late" | "delayed" | "arrived" | null;

// Which warning, if any, a shipment should show today.
export function shipmentAlert(
  s: Pick<Shipment, "status" | "expected_date" | "arrived_at">,
  todayIso: string,
  now: Date = new Date(),
): ShipmentAlert {
  if (s.status === "delayed") return "delayed";
  if (s.status === "ordered" && s.expected_date < todayIso) return "late";
  if (s.status === "arrived" && s.arrived_at && now.getTime() - new Date(s.arrived_at).getTime() < ARRIVED_NOTICE_DAYS * 86_400_000) {
    return "arrived";
  }
  return null;
}

export function alertText(s: Shipment, alert: ShipmentAlert, todayIso: string): string {
  const what = shipmentTitle(s);
  if (alert === "delayed") return `${what} is delayed${s.delay_reason ? `: ${s.delay_reason}` : ""}. Now expected ${s.expected_date}.`;
  if (alert === "late") {
    const days = daysBetween(s.expected_date, todayIso);
    return `${what} was due ${days === 1 ? "yesterday" : `${days} days ago`} and hasn't arrived.`;
  }
  if (alert === "arrived") return `${what} has arrived. Record each item with Receive stock.`;
  return "";
}

export function shipmentTitle(s: Pick<Shipment, "supplier_name" | "reference">): string {
  const from = s.supplier_name ? `Shipment from ${s.supplier_name}` : "Shipment";
  return s.reference ? `${from} (${s.reference})` : from;
}

export async function listShipments(ctx: Ctx, { open = false } = {}): Promise<Shipment[]> {
  const rows = await query<Omit<Shipment, "items">>(
    `SELECT s.id, s.supplier_id, sup.name AS supplier_name, s.reference, s.expected_date, s.status,
            s.delay_reason, s.arrived_at, s.note, s.created_at
       FROM shipments s LEFT JOIN suppliers sup ON sup.id = s.supplier_id
      WHERE s.pharmacy_id = $1 AND s.branch_id = $2
        ${open ? `AND (s.status IN ('ordered', 'delayed') OR (s.status = 'arrived' AND s.arrived_at > now() - INTERVAL '${ARRIVED_NOTICE_DAYS} days'))` : ""}
      ORDER BY CASE s.status WHEN 'delayed' THEN 0 WHEN 'ordered' THEN 1 WHEN 'arrived' THEN 2 ELSE 3 END,
               s.expected_date, s.created_at`,
    [ctx.pharmacy.id, ctx.branch.id],
  );
  if (rows.length === 0) return [];
  const items = await query<ShipmentItem & { shipment_id: string; name: string; strength: string; form: string }>(
    `SELECT i.shipment_id, i.product_id, i.quantity, p.name, p.strength, p.form
       FROM shipment_items i JOIN products p ON p.id = i.product_id
      WHERE i.pharmacy_id = $1 AND i.shipment_id = ANY($2)
      ORDER BY p.name`,
    [ctx.pharmacy.id, rows.map((r) => r.id)],
  );
  return rows.map((r) => ({
    ...r,
    items: items
      .filter((i) => i.shipment_id === r.id)
      .map((i) => ({ product_id: i.product_id, quantity: i.quantity, product_label: productLabel(i) })),
  }));
}

// Shipments that need a warning today, most urgent first.
export async function shipmentAlerts(ctx: Ctx) {
  const today = todayISO();
  return (await listShipments(ctx, { open: true }))
    .map((s) => ({ shipment: s, alert: shipmentAlert(s, today) }))
    .filter((a) => a.alert !== null)
    .map((a) => ({ ...a, text: alertText(a.shipment, a.alert, today) }));
}

export interface ShipmentInput {
  supplierId: string | null;
  reference: string;
  expectedDate: string;
  note: string;
  items: { productId: string; quantity: number }[];
}

export async function createShipment(ctx: Ctx, input: ShipmentInput): Promise<string> {
  requireCan(ctx, "stock.receive");
  if (!isISODate(input.expectedDate)) throw new UserError("Please enter the date the shipment is expected.");
  const items = input.items.filter((i) => i.productId);
  if (items.length === 0) throw new UserError("Add at least one product to the shipment.");
  for (const i of items) {
    if (!Number.isInteger(i.quantity) || i.quantity <= 0) throw new UserError("Each quantity must be a whole number above zero.");
  }
  const id = newId();
  await transaction(async (tx) => {
    if (input.supplierId) {
      const ok = await tx.query("SELECT 1 FROM suppliers WHERE id = $1 AND pharmacy_id = $2", [input.supplierId, ctx.pharmacy.id]);
      if (ok.length === 0) throw new UserError("That supplier wasn't found.");
    }
    const productIds = [...new Set(items.map((i) => i.productId))];
    const found = await tx.query(
      "SELECT id FROM products WHERE pharmacy_id = $1 AND branch_id = $2 AND id = ANY($3)",
      [ctx.pharmacy.id, ctx.branch.id, productIds],
    );
    if (found.length !== productIds.length) throw new UserError("One of the products wasn't found in this branch.");
    await tx.query(
      `INSERT INTO shipments (id, pharmacy_id, branch_id, supplier_id, reference, expected_date, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, ctx.pharmacy.id, ctx.branch.id, input.supplierId, input.reference.trim(), input.expectedDate, input.note.trim(), ctx.user.id],
    );
    for (const i of items) {
      await tx.query(
        "INSERT INTO shipment_items (id, pharmacy_id, shipment_id, product_id, quantity) VALUES ($1, $2, $3, $4, $5)",
        [newId(), ctx.pharmacy.id, id, i.productId, i.quantity],
      );
    }
    await logActivity(tx, ctx.pharmacy.id, ctx.user.id, "Shipment added", `${input.reference.trim() || "No reference"}, expected ${input.expectedDate}`);
  });
  return id;
}

export async function updateShipmentStatus(
  ctx: Ctx,
  shipmentId: string,
  change: { status: ShipmentStatus; expectedDate?: string; delayReason?: string },
) {
  requireCan(ctx, "stock.receive");
  if (!(change.status in SHIPMENT_STATUS)) throw new UserError("Unknown shipment status.");
  if (change.status === "delayed" && change.expectedDate && !isISODate(change.expectedDate)) {
    throw new UserError("The new expected date is not a valid date.");
  }
  await transaction(async (tx) => {
    const rows = await tx.query<{ reference: string; status: string }>(
      "SELECT reference, status FROM shipments WHERE id = $1 AND pharmacy_id = $2 AND branch_id = $3",
      [shipmentId, ctx.pharmacy.id, ctx.branch.id],
    );
    if (rows.length === 0) throw new UserError("That shipment wasn't found.");
    await tx.query(
      `UPDATE shipments
          SET status = $1,
              expected_date = CASE WHEN $2::text <> '' THEN $2::date ELSE expected_date END,
              delay_reason = CASE WHEN $1 = 'delayed' THEN $3 ELSE delay_reason END,
              arrived_at = CASE WHEN $1 = 'arrived' THEN now() ELSE NULL END,
              updated_at = now()
        WHERE id = $4 AND pharmacy_id = $5`,
      [change.status, change.status === "delayed" ? change.expectedDate ?? "" : "", (change.delayReason ?? "").trim(), shipmentId, ctx.pharmacy.id],
    );
    await logActivity(
      tx,
      ctx.pharmacy.id,
      ctx.user.id,
      `Shipment ${SHIPMENT_STATUS[change.status].toLowerCase()}`,
      [rows[0].reference || "No reference", change.delayReason?.trim()].filter(Boolean).join(": "),
    );
  });
}
