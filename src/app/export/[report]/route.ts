// CSV downloads for the inventory and every report: /export/<report>

import { listActivity } from "@/lib/accounts";
import { toCsv } from "@/lib/csv";
import { movementLabel, todayISO } from "@/lib/domain";
import { getContext } from "@/lib/session";
import { expiryReport, listInventory, movementLog, reorderReport, valuationReport } from "@/lib/stock";

const PRODUCT_HEADERS = [
  "name", "strength", "form", "pack_size", "ndc", "barcode", "category", "dea_schedule",
  "reorder_level", "reorder_qty", "supplier", "cost_price", "sell_price", "storage", "location",
];

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const ctx = await getContext();
  if (!ctx) return new Response("Please log in.", { status: 401 });
  const { report } = await params;
  const url = new URL(request.url);
  const q = url.searchParams;
  let headers: string[];
  let rows: (string | number | null)[][];

  switch (report) {
    case "inventory": {
      const items = await listInventory(ctx, { q: q.get("q") ?? undefined, filter: q.get("filter") ?? undefined });
      headers = [...PRODUCT_HEADERS, "on_hand_units", "next_expiry", "running_low", "expiring_soon", "has_expired"];
      rows = items.map((r) => [
        r.name, r.strength, r.form, r.pack_size, r.ndc, r.barcode, r.category, r.dea_schedule,
        r.reorder_level, r.reorder_qty, r.supplier_name, r.cost_price, r.sell_price, r.storage, r.location,
        r.total, r.next_expiry, r.low ? "yes" : "", r.soon ? "yes" : "", r.expired ? "yes" : "",
      ]);
      break;
    }
    case "import-template": {
      headers = [...PRODUCT_HEADERS, "lot_number", "expiry_date", "quantity"];
      rows = [
        ["Amoxicillin", "500 mg", "Capsule", 21, "0093-4155-73", "", "rx", "none", 63, 210, "", 2.1, 4.5, "room", "Bay 4, shelf 2", "AMX24051", "2027-03-31", 63],
        ["Oxycodone", "5 mg", "Tablet", 100, "", "", "rx", "II", 100, 200, "", 12, 30, "locked", "Safe", "", "", ""],
      ];
      break;
    }
    case "reorder": {
      const groups = await reorderReport(ctx);
      headers = ["supplier", "name", "strength", "form", "ndc", "on_hand_units", "reorder_level", "suggested_order_units", "suggested_order_packs"];
      rows = groups.flatMap((g) =>
        g.items.map((r) => [g.supplier, r.name, r.strength, r.form, r.ndc, r.total, r.reorder_level, r.reorder_qty, Math.ceil(r.reorder_qty / r.pack_size)]),
      );
      break;
    }
    case "expiry": {
      const days = Number(q.get("days")) || ctx.pharmacy.expiry_warning_days;
      const items = await expiryReport(ctx, Math.min(Math.max(days, 1), 730));
      headers = ["name", "strength", "form", "ndc", "lot_number", "expiry_date", "days_left", "quantity_units", "cost_value", "location"];
      rows = items.map((r) => [r.product_name, r.strength, r.form, r.ndc, r.lot_number, r.expiry_date, r.days_left, r.quantity, r.value.toFixed(2), r.location]);
      break;
    }
    case "valuation": {
      const { items } = await valuationReport(ctx);
      headers = ["name", "strength", "form", "ndc", "on_hand_units", "pack_size", "cost_price_per_pack", "cost_value", "sell_value"];
      rows = items.map((r) => [r.name, r.strength, r.form, r.ndc, r.total, r.pack_size, r.cost_price, r.cost_value.toFixed(2), r.sell_value.toFixed(2)]);
      break;
    }
    case "audit": {
      const items = await movementLog(ctx, {
        from: q.get("from") ?? undefined,
        to: q.get("to") ?? undefined,
        type: q.get("type") || undefined,
        limit: 100_000,
      });
      headers = ["time_utc", "branch", "name", "strength", "form", "ndc", "dea_schedule", "lot_number", "expiry_date", "type", "quantity_units", "by", "reference", "note"];
      rows = items.map((m) => [
        new Date(m.created_at).toISOString(), m.branch_name, m.product_name, m.strength, m.form, m.ndc, m.dea_schedule,
        m.lot_number, m.expiry_date, movementLabel(m.type), m.quantity, m.user_name, m.reference, m.note,
      ]);
      break;
    }
    case "activity": {
      const items = await listActivity(ctx, 100_000);
      headers = ["time_utc", "by", "action", "details"];
      rows = items.map((a) => [new Date(a.created_at).toISOString(), a.user_name, a.action, a.details]);
      break;
    }
    default:
      return new Response("Unknown report.", { status: 404 });
  }

  const filename = `sortmedication-${report}-${todayISO()}.csv`;
  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
