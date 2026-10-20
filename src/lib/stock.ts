// Products, batches and stock movements.
//
// Stock is never stored as a number that people edit. Each batch's quantity
// is the sum of its movements (received +, dispensed -, and so on), so the
// movements table is a complete audit trail of how stock got to where it is.

import { newId, one, query, transaction, type Queryable } from "./db";
import type { Ctx } from "./accounts";
import { logActivity } from "./accounts";
import {
  CATEGORIES,
  DEA_SCHEDULES,
  MOVEMENT_TYPES,
  STOCK_OUT_TYPES,
  STORAGE,
  can,
  daysBetween,
  expiryStatus,
  isISODate,
  isValidNdc,
  productFlags,
  suggestBatch,
  todayISO,
  type MovementType,
  type Permission,
} from "./domain";
import { UserError } from "./errors";

export interface Product {
  id: string;
  pharmacy_id: string;
  branch_id: string;
  name: string;
  strength: string;
  form: string;
  pack_size: number;
  ndc: string;
  barcode: string;
  category: string;
  dea_schedule: string;
  reorder_level: number;
  reorder_qty: number;
  supplier_id: string | null;
  cost_price: number;
  sell_price: number;
  storage: string;
  location: string;
  archived: boolean;
  updated_at: Date;
}

export interface Batch {
  id: string;
  product_id: string;
  lot_number: string;
  expiry_date: string;
  received_date: string;
  supplier_id: string | null;
  supplier_name: string | null;
  invoice: string;
  quantity: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  account_number: string;
}

export function requireCan(ctx: Ctx, permission: Permission) {
  if (!can(ctx.user.role, permission)) throw new UserError("Your role doesn't allow this. Ask the pharmacy owner.");
  if (!ctx.writable) throw new UserError("Your free trial has ended, so the account is read-only. Start a subscription in Settings to keep editing.");
}

// ---------- Products ----------

export type ProductInput = Omit<Product, "id" | "pharmacy_id" | "branch_id" | "archived" | "updated_at">;

function int(value: string | undefined, field: string, { min = 0 } = {}): number {
  const text = (value ?? "").trim();
  if (text === "") return 0;
  const n = Number(text);
  if (!Number.isInteger(n) || n < min) throw new UserError(`${field} must be a whole number${min > 0 ? ` of at least ${min}` : ""}.`);
  return n;
}

function money(value: string | undefined, field: string): number {
  const text = (value ?? "").trim().replace(/^\$/, "");
  if (text === "") return 0;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) throw new UserError(`${field} must be a price like 4.50.`);
  return Math.round(n * 100) / 100;
}

// Checks and tidies product fields typed into a form or read from a CSV row.
export function parseProductInput(raw: Record<string, string | undefined>): ProductInput {
  const name = (raw.name ?? "").trim();
  if (!name) throw new UserError("Please enter the product name.");
  const ndc = (raw.ndc ?? "").trim();
  if (!isValidNdc(ndc)) throw new UserError("The NDC should be 10 or 11 digits, for example 0093-4155-73.");
  const category = (raw.category ?? "rx").trim().toLowerCase() || "rx";
  if (!(category in CATEGORIES)) throw new UserError("Category must be rx, otc or other.");
  const dea = (raw.dea_schedule ?? "none").trim().toUpperCase().replace(/^C(?=[IV])/, "") || "NONE";
  const deaSchedule = dea === "NONE" ? "none" : dea;
  if (!(DEA_SCHEDULES as readonly string[]).includes(deaSchedule)) throw new UserError("DEA schedule must be none, II, III, IV or V.");
  const storage = (raw.storage ?? "room").trim().toLowerCase() || "room";
  if (!(storage in STORAGE)) throw new UserError("Storage must be room, fridge, freezer or locked.");
  const supplierId = (raw.supplier_id ?? "").trim();

  return {
    name,
    strength: (raw.strength ?? "").trim(),
    form: (raw.form ?? "").trim(),
    pack_size: int(raw.pack_size || "1", "Pack size", { min: 1 }),
    ndc,
    barcode: (raw.barcode ?? "").trim(),
    category,
    dea_schedule: deaSchedule,
    reorder_level: int(raw.reorder_level, "Reorder level"),
    reorder_qty: int(raw.reorder_qty, "Reorder quantity"),
    supplier_id: supplierId || null,
    cost_price: money(raw.cost_price, "Cost price"),
    sell_price: money(raw.sell_price, "Selling price"),
    storage,
    location: (raw.location ?? "").trim(),
  };
}

async function checkSupplier(db: Queryable, ctx: Ctx, supplierId: string | null) {
  if (!supplierId) return;
  const rows = await db.query("SELECT 1 FROM suppliers WHERE id = $1 AND pharmacy_id = $2", [supplierId, ctx.pharmacy.id]);
  if (rows.length === 0) throw new UserError("Unknown supplier.");
}

const PRODUCT_COLUMNS = [
  "name", "strength", "form", "pack_size", "ndc", "barcode", "category", "dea_schedule",
  "reorder_level", "reorder_qty", "supplier_id", "cost_price", "sell_price", "storage", "location",
] as const;

async function insertProduct(db: Queryable, ctx: Ctx, branchId: string, input: ProductInput): Promise<string> {
  const id = newId();
  const values = PRODUCT_COLUMNS.map((c) => input[c]);
  await db.query(
    `INSERT INTO products (id, pharmacy_id, branch_id, ${PRODUCT_COLUMNS.join(", ")})
     VALUES ($1, $2, $3, ${PRODUCT_COLUMNS.map((_, i) => `$${i + 4}`).join(", ")})`,
    [id, ctx.pharmacy.id, branchId, ...values],
  );
  return id;
}

export async function createProduct(ctx: Ctx, input: ProductInput): Promise<string> {
  requireCan(ctx, "products.edit");
  return transaction(async (tx) => {
    await checkSupplier(tx, ctx, input.supplier_id);
    const id = await insertProduct(tx, ctx, ctx.branch.id, input);
    await logActivity(tx, ctx.pharmacy.id, ctx.user.id, "Product added", `${input.name} ${input.strength}`.trim());
    return id;
  });
}

export async function updateProduct(ctx: Ctx, productId: string, input: ProductInput) {
  requireCan(ctx, "products.edit");
  await transaction(async (tx) => {
    const before = await getProductWith(tx, ctx, productId);
    await checkSupplier(tx, ctx, input.supplier_id);
    await tx.query(
      `UPDATE products SET ${PRODUCT_COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(", ")}, updated_at = now()
        WHERE id = $${PRODUCT_COLUMNS.length + 1} AND pharmacy_id = $${PRODUCT_COLUMNS.length + 2}`,
      [...PRODUCT_COLUMNS.map((c) => input[c]), productId, ctx.pharmacy.id],
    );
    const changed = PRODUCT_COLUMNS.filter((c) => String(before[c] ?? "") !== String(input[c] ?? ""));
    if (changed.length) {
      const details = changed.map((c) => `${c}: ${before[c] ?? ""} → ${input[c] ?? ""}`).join("; ");
      await logActivity(tx, ctx.pharmacy.id, ctx.user.id, `Product edited: ${before.name}`, details);
    }
  });
}

export async function setProductArchived(ctx: Ctx, productId: string, archived: boolean) {
  requireCan(ctx, "products.edit");
  const product = await getProduct(ctx, productId);
  await query("UPDATE products SET archived = $1, updated_at = now() WHERE id = $2 AND pharmacy_id = $3", [archived, productId, ctx.pharmacy.id]);
  await logActivity({ query }, ctx.pharmacy.id, ctx.user.id, archived ? "Product archived" : "Product restored", product.name);
}

async function getProductWith(db: Queryable, ctx: Ctx, productId: string): Promise<Product> {
  const product = (await db.query<Product>("SELECT * FROM products WHERE id = $1 AND pharmacy_id = $2", [productId, ctx.pharmacy.id]))[0];
  if (!product) throw new UserError("Product not found.");
  return product;
}

export function getProduct(ctx: Ctx, productId: string): Promise<Product> {
  return getProductWith({ query }, ctx, productId);
}

export function productLabel(p: Pick<Product, "name" | "strength" | "form">): string {
  return [p.name, p.strength, p.form].filter(Boolean).join(" ");
}

// ---------- Batches ----------

const BATCH_SELECT = `
  SELECT b.id, b.product_id, b.lot_number, b.expiry_date, b.received_date, b.supplier_id, b.invoice,
         s.name AS supplier_name,
         COALESCE((SELECT SUM(m.quantity) FROM movements m WHERE m.batch_id = b.id), 0)::int AS quantity
    FROM batches b LEFT JOIN suppliers s ON s.id = b.supplier_id`;

export async function getBatches(ctx: Ctx, productId: string, { includeEmpty = false } = {}): Promise<Batch[]> {
  const rows = await query<Batch>(
    `${BATCH_SELECT} WHERE b.product_id = $1 AND b.pharmacy_id = $2 ORDER BY b.expiry_date, b.received_date`,
    [productId, ctx.pharmacy.id],
  );
  return includeEmpty ? rows : rows.filter((b) => b.quantity !== 0);
}

async function batchQuantity(db: Queryable, batchId: string): Promise<number> {
  const row = (await db.query<{ q: number }>("SELECT COALESCE(SUM(quantity), 0)::int AS q FROM movements WHERE batch_id = $1", [batchId]))[0];
  return row.q;
}

async function insertMovement(
  db: Queryable,
  ctx: Ctx,
  m: { branchId: string; productId: string; batchId: string; type: MovementType; quantity: number; reference?: string; note?: string },
) {
  await db.query(
    `INSERT INTO movements (id, pharmacy_id, branch_id, product_id, batch_id, type, quantity, user_id, reference, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [newId(), ctx.pharmacy.id, m.branchId, m.productId, m.batchId, m.type, m.quantity, ctx.user.id, m.reference ?? "", m.note ?? ""],
  );
}

// Finds the batch with this lot and expiry, or creates it.
async function findOrCreateBatch(
  db: Queryable,
  ctx: Ctx,
  productId: string,
  b: { lot: string; expiry: string; received: string; supplierId: string | null; invoice: string },
): Promise<string> {
  const existing = (
    await db.query<{ id: string }>(
      "SELECT id FROM batches WHERE product_id = $1 AND pharmacy_id = $2 AND lot_number = $3 AND expiry_date = $4",
      [productId, ctx.pharmacy.id, b.lot, b.expiry],
    )
  )[0];
  if (existing) return existing.id;
  const id = newId();
  await db.query(
    `INSERT INTO batches (id, pharmacy_id, product_id, lot_number, expiry_date, received_date, supplier_id, invoice)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, ctx.pharmacy.id, productId, b.lot, b.expiry, b.received, b.supplierId, b.invoice],
  );
  return id;
}

// ---------- Receiving stock ----------

export interface ReceiveInput {
  productId: string;
  lotNumber: string;
  expiryDate: string;
  receivedDate: string;
  quantity: number; // in units
  supplierId: string | null;
  invoice: string;
  note?: string;
}

export async function receiveStock(ctx: Ctx, input: ReceiveInput, db?: Queryable): Promise<string> {
  requireCan(ctx, "stock.receive");
  const lot = input.lotNumber.trim();
  if (!lot) throw new UserError("Please enter the batch (lot) number from the pack.");
  if (!isISODate(input.expiryDate)) throw new UserError("Please enter the expiry date.");
  const received = input.receivedDate || todayISO();
  if (!isISODate(received)) throw new UserError("The received date is not a valid date.");
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new UserError("Quantity must be a whole number above zero.");

  const run = async (tx: Queryable) => {
    const product = await getProductWith(tx, ctx, input.productId);
    if (product.archived) throw new UserError("This product is archived. Restore it before receiving stock.");
    await checkSupplier(tx, ctx, input.supplierId);
    const batchId = await findOrCreateBatch(tx, ctx, product.id, {
      lot,
      expiry: input.expiryDate,
      received,
      supplierId: input.supplierId ?? product.supplier_id,
      invoice: input.invoice.trim(),
    });
    await insertMovement(tx, ctx, {
      branchId: product.branch_id,
      productId: product.id,
      batchId,
      type: "received",
      quantity: input.quantity,
      reference: input.invoice.trim(),
      note: input.note?.trim(),
    });
    return batchId;
  };
  return db ? run(db) : transaction(run);
}

// ---------- Taking stock out (dispense, return, destroy, adjust, transfer) ----------

export interface StockOutInput {
  productId: string;
  batchId: string;
  type: MovementType;
  // For a count adjustment this is the number actually counted on the shelf;
  // for everything else it is how many units leave.
  quantity: number;
  reference: string;
  note: string;
  targetBranchId?: string;
}

export async function stockOut(ctx: Ctx, input: StockOutInput): Promise<void> {
  if (!STOCK_OUT_TYPES.includes(input.type)) throw new UserError("Please choose what is happening to the stock.");
  requireCan(ctx, MOVEMENT_TYPES[input.type].permission);
  if (!Number.isInteger(input.quantity) || input.quantity < 0 || (input.type !== "adjusted" && input.quantity === 0)) {
    throw new UserError(input.type === "adjusted" ? "Enter the number you counted (0 or more)." : "Quantity must be a whole number above zero.");
  }
  const note = input.note.trim();
  if ((input.type === "adjusted" || input.type === "expired_destroyed") && !note) {
    throw new UserError("Please add a note explaining the reason.");
  }

  await transaction(async (tx) => {
    const product = await getProductWith(tx, ctx, input.productId);
    // Lock the batch so two people can't take the same stock at once.
    const batch = (
      await tx.query<{ id: string; lot_number: string; expiry_date: string; received_date: string; supplier_id: string | null; invoice: string }>(
        "SELECT * FROM batches WHERE id = $1 AND product_id = $2 AND pharmacy_id = $3 FOR UPDATE",
        [input.batchId, product.id, ctx.pharmacy.id],
      )
    )[0];
    if (!batch) throw new UserError("Please choose a batch.");
    const onHand = await batchQuantity(tx, batch.id);

    if (input.type === "adjusted") {
      const delta = input.quantity - onHand;
      if (delta === 0) throw new UserError(`The count matches what the system has (${onHand}), so nothing needs changing.`);
      await insertMovement(tx, ctx, {
        branchId: product.branch_id,
        productId: product.id,
        batchId: batch.id,
        type: "adjusted",
        quantity: delta,
        reference: input.reference.trim(),
        note: `${note} (system had ${onHand}, counted ${input.quantity})`,
      });
      return;
    }

    if (input.quantity > onHand) {
      throw new UserError(`Batch ${batch.lot_number} only has ${onHand} units. Choose another batch or a smaller quantity.`);
    }

    if (input.type === "transfer_out") {
      const target = ctx.branches.find((b) => b.id === input.targetBranchId);
      if (!target) throw new UserError("Please choose the branch the stock is moving to.");
      if (target.id === product.branch_id) throw new UserError("The stock is already in that branch.");
      const targetProductId = await findOrCopyProduct(tx, ctx, product, target.id);
      const targetBatchId = await findOrCreateBatch(tx, ctx, targetProductId, {
        lot: batch.lot_number,
        expiry: batch.expiry_date,
        received: todayISO(),
        supplierId: batch.supplier_id,
        invoice: batch.invoice,
      });
      const fromBranch = ctx.branches.find((b) => b.id === product.branch_id)?.name ?? "";
      await insertMovement(tx, ctx, {
        branchId: product.branch_id, productId: product.id, batchId: batch.id, type: "transfer_out",
        quantity: -input.quantity, reference: input.reference.trim(), note: [`To ${target.name}`, note].filter(Boolean).join(". "),
      });
      await insertMovement(tx, ctx, {
        branchId: target.id, productId: targetProductId, batchId: targetBatchId, type: "transfer_in",
        quantity: input.quantity, reference: input.reference.trim(), note: [`From ${fromBranch}`, note].filter(Boolean).join(". "),
      });
      return;
    }

    await insertMovement(tx, ctx, {
      branchId: product.branch_id,
      productId: product.id,
      batchId: batch.id,
      type: input.type,
      quantity: -input.quantity,
      reference: input.reference.trim(),
      note,
    });
  });
}

// The same product in another branch: matched by NDC, or by name, strength
// and form. Copied there if that branch doesn't stock it yet.
async function findOrCopyProduct(db: Queryable, ctx: Ctx, product: Product, branchId: string): Promise<string> {
  const match = (
    await db.query<{ id: string }>(
      `SELECT id FROM products
        WHERE pharmacy_id = $1 AND branch_id = $2 AND archived = false
          AND (($3 <> '' AND ndc = $3) OR ($3 = '' AND lower(name) = lower($4) AND strength = $5 AND form = $6))
        LIMIT 1`,
      [ctx.pharmacy.id, branchId, product.ndc, product.name, product.strength, product.form],
    )
  )[0];
  if (match) return match.id;
  return insertProduct(db, ctx, branchId, product);
}

// ---------- Inventory list and dashboard ----------

export interface InventoryRow extends Product {
  total: number;
  low: boolean;
  soon: boolean;
  expired: boolean;
  next_expiry: string | null;
  supplier_name: string | null;
}

async function branchBatches(ctx: Ctx, branchId: string) {
  return query<{ id: string; product_id: string; expiry_date: string; quantity: number }>(
    `SELECT b.id, b.product_id, b.expiry_date, q.quantity::int AS quantity
       FROM batches b
       JOIN (SELECT batch_id, SUM(quantity) AS quantity FROM movements WHERE pharmacy_id = $1 AND branch_id = $2 GROUP BY batch_id) q
         ON q.batch_id = b.id
      WHERE b.pharmacy_id = $1`,
    [ctx.pharmacy.id, branchId],
  );
}

export async function listInventory(
  ctx: Ctx,
  opts: { q?: string; sort?: string; filter?: string; includeArchived?: boolean } = {},
): Promise<InventoryRow[]> {
  const products = await query<Product & { supplier_name: string | null }>(
    `SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.pharmacy_id = $1 AND p.branch_id = $2 ${opts.includeArchived ? "" : "AND p.archived = false"}`,
    [ctx.pharmacy.id, ctx.branch.id],
  );
  const batches = await branchBatches(ctx, ctx.branch.id);
  const byProduct = new Map<string, typeof batches>();
  for (const b of batches) byProduct.set(b.product_id, [...(byProduct.get(b.product_id) ?? []), b]);
  const today = todayISO();
  const warn = ctx.pharmacy.expiry_warning_days;

  let rows: InventoryRow[] = products.map((p) => {
    const list = byProduct.get(p.id) ?? [];
    const flags = productFlags(p.reorder_level, list, today, warn);
    const nextExpiry = list.filter((b) => b.quantity > 0).map((b) => b.expiry_date).sort()[0] ?? null;
    return { ...p, ...flags, next_expiry: nextExpiry };
  });

  const q = opts.q?.trim().toLowerCase();
  if (q) {
    const digits = q.replace(/-/g, "");
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.strength.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        (digits.length > 0 && /^\d+$/.test(digits) && (r.ndc.replace(/-/g, "").includes(digits) || r.barcode.includes(digits))),
    );
  }
  if (opts.filter === "low") rows = rows.filter((r) => r.low);
  if (opts.filter === "soon") rows = rows.filter((r) => r.soon);
  if (opts.filter === "expired") rows = rows.filter((r) => r.expired);
  if (opts.filter === "controlled") rows = rows.filter((r) => r.dea_schedule !== "none");

  const sorters: Record<string, (a: InventoryRow, b: InventoryRow) => number> = {
    name: (a, b) => a.name.localeCompare(b.name) || a.strength.localeCompare(b.strength),
    stock: (a, b) => a.total - b.total,
    expiry: (a, b) => (a.next_expiry ?? "9999").localeCompare(b.next_expiry ?? "9999"),
    location: (a, b) => a.location.localeCompare(b.location),
  };
  rows.sort(sorters[opts.sort ?? "name"] ?? sorters.name);
  return rows;
}

// If a scanned barcode or NDC matches exactly one product, return it.
export async function findByCode(ctx: Ctx, code: string): Promise<string | null> {
  const digits = code.trim().replace(/-/g, "");
  if (!/^\d{6,14}$/.test(digits)) return null;
  const rows = await query<{ id: string }>(
    `SELECT id FROM products WHERE pharmacy_id = $1 AND branch_id = $2 AND archived = false
       AND (barcode = $3 OR replace(ndc, '-', '') = $3 OR ($4 <> '' AND barcode LIKE '%' || $4 || '%'))`,
    // Package barcodes on US drugs usually contain the NDC digits inside them.
    [ctx.pharmacy.id, ctx.branch.id, digits, digits.length >= 12 ? digits.slice(2, 12) : ""],
  );
  return rows.length === 1 ? rows[0].id : null;
}

export async function dashboard(ctx: Ctx) {
  const rows = await listInventory(ctx);
  const batches = await branchBatches(ctx, ctx.branch.id);
  const today = todayISO();
  const inStock = batches.filter((b) => b.quantity > 0);
  const soonBatches = inStock.filter((b) => expiryStatus(b.expiry_date, today, ctx.pharmacy.expiry_warning_days) === "soon").length;
  const expiredBatches = inStock.filter((b) => expiryStatus(b.expiry_date, today, ctx.pharmacy.expiry_warning_days) === "expired").length;
  const todays = await movementLog(ctx, { from: today, to: today, branchOnly: true, limit: 50 });
  return {
    productCount: rows.length,
    lowCount: rows.filter((r) => r.low).length,
    soonBatches,
    expiredBatches,
    todays,
  };
}

// ---------- Movement history (the audit trail) ----------

export interface MovementRow {
  id: string;
  created_at: Date;
  type: string;
  quantity: number;
  reference: string;
  note: string;
  user_name: string;
  product_id: string;
  product_name: string;
  strength: string;
  form: string;
  ndc: string;
  dea_schedule: string;
  lot_number: string;
  expiry_date: string;
  branch_name: string;
}

export async function movementLog(
  ctx: Ctx,
  opts: { productId?: string; from?: string; to?: string; branchOnly?: boolean; type?: string; limit?: number } = {},
): Promise<MovementRow[]> {
  const where = ["m.pharmacy_id = $1"];
  const params: unknown[] = [ctx.pharmacy.id];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };
  if (opts.productId) add("m.product_id = ?", opts.productId);
  if (opts.branchOnly) add("m.branch_id = ?", ctx.branch.id);
  if (opts.type) add("m.type = ?", opts.type);
  // Day boundaries use the pharmacy's time zone, like todayISO().
  const tz = process.env.APP_TIME_ZONE ?? "America/New_York";
  if (opts.from && isISODate(opts.from)) add(`(m.created_at AT TIME ZONE '${tz.replace(/'/g, "")}')::date >= ?::date`, opts.from);
  if (opts.to && isISODate(opts.to)) add(`(m.created_at AT TIME ZONE '${tz.replace(/'/g, "")}')::date <= ?::date`, opts.to);
  params.push(opts.limit ?? 1000);
  return query<MovementRow>(
    `SELECT m.id, m.created_at, m.type, m.quantity, m.reference, m.note,
            u.name AS user_name, p.id AS product_id, p.name AS product_name, p.strength, p.form, p.ndc, p.dea_schedule,
            b.lot_number, b.expiry_date, br.name AS branch_name
       FROM movements m
       JOIN users u ON u.id = m.user_id
       JOIN products p ON p.id = m.product_id
       JOIN batches b ON b.id = m.batch_id
       JOIN branches br ON br.id = m.branch_id
      WHERE ${where.join(" AND ")}
      ORDER BY m.created_at DESC, m.id
      LIMIT $${params.length}`,
    params,
  );
}

// ---------- Reports ----------

export async function reorderReport(ctx: Ctx) {
  const rows = (await listInventory(ctx)).filter((r) => r.low);
  const groups = new Map<string, InventoryRow[]>();
  for (const r of rows) {
    const key = r.supplier_name ?? "No supplier set";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([supplier, items]) => ({ supplier, items }));
}

export async function expiryReport(ctx: Ctx, withinDays: number) {
  const today = todayISO();
  const rows = await query<Batch & { product_name: string; strength: string; form: string; ndc: string; location: string; pack_size: number; cost_price: number }>(
    `SELECT x.*, p.name AS product_name, p.strength, p.form, p.ndc, p.location, p.pack_size, p.cost_price
       FROM (${BATCH_SELECT} WHERE b.pharmacy_id = $1) x
       JOIN products p ON p.id = x.product_id
      WHERE p.branch_id = $2 AND x.quantity > 0
      ORDER BY x.expiry_date`,
    [ctx.pharmacy.id, ctx.branch.id],
  );
  return rows
    .map((r) => ({ ...r, days_left: daysBetween(today, r.expiry_date), value: (r.quantity / r.pack_size) * r.cost_price }))
    .filter((r) => r.days_left <= withinDays);
}

export async function valuationReport(ctx: Ctx) {
  const rows = (await listInventory(ctx)).filter((r) => r.total > 0);
  const items = rows.map((r) => ({
    ...r,
    cost_value: (r.total / r.pack_size) * r.cost_price,
    sell_value: (r.total / r.pack_size) * r.sell_price,
  }));
  return {
    items,
    totalCost: items.reduce((s, r) => s + r.cost_value, 0),
    totalSell: items.reduce((s, r) => s + r.sell_value, 0),
  };
}

// ---------- Suppliers ----------

export function listSuppliers(ctx: Ctx): Promise<Supplier[]> {
  return query<Supplier>("SELECT * FROM suppliers WHERE pharmacy_id = $1 ORDER BY name", [ctx.pharmacy.id]);
}

function parseSupplier(raw: Record<string, string | undefined>) {
  const name = (raw.name ?? "").trim();
  if (!name) throw new UserError("Please enter the supplier name.");
  return {
    name,
    contact_name: (raw.contact_name ?? "").trim(),
    phone: (raw.phone ?? "").trim(),
    email: (raw.email ?? "").trim(),
    account_number: (raw.account_number ?? "").trim(),
  };
}

export async function saveSupplier(ctx: Ctx, supplierId: string | null, raw: Record<string, string | undefined>) {
  requireCan(ctx, "suppliers.edit");
  const s = parseSupplier(raw);
  if (supplierId) {
    await query(
      "UPDATE suppliers SET name = $1, contact_name = $2, phone = $3, email = $4, account_number = $5 WHERE id = $6 AND pharmacy_id = $7",
      [s.name, s.contact_name, s.phone, s.email, s.account_number, supplierId, ctx.pharmacy.id],
    );
  } else {
    await query(
      "INSERT INTO suppliers (id, pharmacy_id, name, contact_name, phone, email, account_number) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [newId(), ctx.pharmacy.id, s.name, s.contact_name, s.phone, s.email, s.account_number],
    );
    await logActivity({ query }, ctx.pharmacy.id, ctx.user.id, "Supplier added", s.name);
  }
}

// ---------- CSV import ----------

// Each row is a product. Optional lot_number, expiry_date and quantity
// columns add opening stock as a "received" movement.
export async function importProducts(ctx: Ctx, rows: Record<string, string>[]) {
  requireCan(ctx, "products.edit");
  requireCan(ctx, "stock.receive");
  if (rows.length === 0) throw new UserError("The file has no rows. The first row must be the column names.");
  if (rows.length > 5000) throw new UserError("Please import at most 5,000 rows at a time.");
  const suppliers = await listSuppliers(ctx);
  const errors: string[] = [];
  const parsed: { input: ProductInput; stock: ReceiveInput | null }[] = [];

  rows.forEach((row, i) => {
    const line = i + 2; // +1 for the header row, +1 because people count from 1
    try {
      const supplierName = (row.supplier ?? "").trim().toLowerCase();
      const supplier = supplierName ? suppliers.find((s) => s.name.toLowerCase() === supplierName) : undefined;
      if (supplierName && !supplier) throw new UserError(`supplier "${row.supplier}" is not in Settings → Suppliers`);
      const input = parseProductInput({ ...row, supplier_id: supplier?.id ?? "" });
      let stock: ReceiveInput | null = null;
      if (row.quantity || row.lot_number || row.expiry_date) {
        const quantity = Number(row.quantity);
        if (!row.lot_number) throw new UserError("lot_number is needed when adding stock");
        if (!isISODate(row.expiry_date ?? "")) throw new UserError("expiry_date must look like 2027-03-31");
        if (!Number.isInteger(quantity) || quantity <= 0) throw new UserError("quantity must be a whole number above zero");
        stock = { productId: "", lotNumber: row.lot_number, expiryDate: row.expiry_date, receivedDate: todayISO(), quantity, supplierId: supplier?.id ?? null, invoice: "", note: "Opening stock (CSV import)" };
      }
      parsed.push({ input, stock });
    } catch (err) {
      if (!(err instanceof UserError)) throw err;
      errors.push(`Row ${line}: ${err.message}`);
    }
  });
  if (errors.length) return { created: 0, stocked: 0, errors };

  // Nothing is saved unless every row is valid.
  let created = 0;
  let stocked = 0;
  await transaction(async (tx) => {
    const existing = await tx.query<{ id: string; ndc: string; name: string; strength: string; form: string }>(
      "SELECT id, ndc, name, strength, form FROM products WHERE pharmacy_id = $1 AND branch_id = $2 AND archived = false",
      [ctx.pharmacy.id, ctx.branch.id],
    );
    for (const { input, stock } of parsed) {
      const key = (p: { ndc: string; name: string; strength: string; form: string }) =>
        p.ndc ? `ndc:${p.ndc.replace(/-/g, "")}` : `name:${p.name.toLowerCase()}|${p.strength}|${p.form}`;
      let productId = existing.find((p) => key(p) === key(input))?.id;
      if (!productId) {
        productId = await insertProduct(tx, ctx, ctx.branch.id, input);
        existing.push({ id: productId, ...input });
        created++;
      }
      if (stock) {
        await receiveStock(ctx, { ...stock, productId }, tx);
        stocked++;
      }
    }
    await logActivity(tx, ctx.pharmacy.id, ctx.user.id, "CSV import", `${created} products added, ${stocked} batches of opening stock`);
  });
  return { created, stocked, errors };
}

export { suggestBatch };
