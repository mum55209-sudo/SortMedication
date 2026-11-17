// Finding the records that answer a question, for "Ask AI".
//
// Before Ask AI calls Gemini, this file looks through the signed-in
// pharmacy's own data (for the branch they're working in) and picks out only
// the records that match the question: medications, batches, shipments and
// the drug reference. Each record gets a short ID like [P1] so the answer can
// point back to it, and the page can show it as a source.
//
// Everything here goes through the same functions the rest of the app uses,
// and those always filter by ctx.pharmacy.id and ctx.branch.id, so another
// pharmacy's data can never be picked.
//
// PRIVACY: patients, prescriptions, staff and the activity log are never
// read here, so they can never be sent to Gemini.

import type { Ctx } from "./accounts";
import { todayISO } from "./domain";
import { dailyMedUrl, DRUG_INFO, findDrugInfo, normalizeDrugName, type DrugInfo } from "./drug-info";
import { listShipments, shipmentAlert, shipmentTitle } from "./shipments";
import { expiryReport, listInventory, productLabel, type InventoryRow } from "./stock";

export type SourceKind = "summary" | "product" | "batch" | "shipment" | "drug";

export interface Source {
  /** Short ID the AI cites, e.g. "P3". */
  id: string;
  kind: SourceKind;
  /** What the page shows under the answer. */
  label: string;
  /** Where clicking the source goes. */
  href: string;
  /** The facts given to the AI. */
  text: string;
}

const LIMITS = { product: 40, batch: 60, shipment: 20, drug: 10 };

const STOP_WORDS = new Set(
  ("the a an and or of for to in on at is are was were be do does did we our us you your it its this that these those " +
    "what which who whom how many much any some all have has had with from by about there their them they me my i " +
    "can could should would will shall may might please tell show list give get find need want know left " +
    "mg mcg ml tablet tablets capsule capsules stock stocks units unit pack packs item items medication medications " +
    "medicine medicines drug drugs product products").split(" "),
);

function words(text: string): string[] {
  return normalizeDrugName(text)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

const has = (q: string, re: RegExp) => re.test(q.toLowerCase());
const wantsLow = (q: string) => has(q, /\b(low|reorder|re-order|restock|run(ning)? out|out of stock|order more|short)\b/);
const wantsExpiry = (q: string) => has(q, /\b(expir\w*|out of date|best before|use by|soon)\b/);
const wantsShipments = (q: string) => has(q, /\b(ship\w*|deliver\w*|arriv\w*|late|delay\w*|on order|incoming|coming)\b/);
const wantsDrugInfo = (q: string) => has(q, /\b(used for|use for|for what|what is .* for|treat\w*|dose|dosage|dosing|how much .* take|caution|warning|side effect\w*)\b/);
const wantsOverview = (q: string) => has(q, /\b(how many (products|medications|items)|overview|summary|everything|total)\b/);

function productText(r: InventoryRow): string {
  const flags = [r.low && "running low", r.soon && "has a batch expiring soon", r.expired && "has expired stock"].filter(Boolean).join(", ") || "ok";
  return [
    `${productLabel(r)}: ${r.total} units on hand (pack size ${r.pack_size})`,
    `reorder level ${r.reorder_level}, reorder quantity ${r.reorder_qty}`,
    `next expiry ${r.next_expiry ?? "none in stock"}`,
    `status: ${flags}`,
    r.dea_schedule !== "none" ? `DEA schedule ${r.dea_schedule}` : "",
    `supplier ${r.supplier_name ?? "not set"}`,
    `shelf ${r.location || "not set"}`,
    r.ndc ? `NDC ${r.ndc}` : "",
  ].filter(Boolean).join("; ");
}

function drugText(info: DrugInfo): string {
  return [`${info.name}: used for ${info.usedFor}`, `typical dose: ${info.dose}`, info.caution ? `caution: ${info.caution}` : ""]
    .filter(Boolean)
    .join("; ");
}

/**
 * Pick the records that match a question. `earlier` is the previous question
 * in the chat, so follow-ups like "and when does it expire?" still find it.
 */
export async function findRelevantRecords(ctx: Ctx, question: string, earlier = ""): Promise<Source[]> {
  const today = todayISO();
  const warnDays = ctx.pharmacy.expiry_warning_days;
  const inventory = await listInventory(ctx);
  const qWords = words(`${question} ${earlier}`);

  // Medications whose name, strength, supplier, shelf or NDC matches a word in
  // the question, or whose drug reference entry matches (so "Tylenol" finds
  // Acetaminophen).
  const mentionedInfo = new Set(
    DRUG_INFO.filter((d) => [d.name, ...(d.aliases ?? [])].some((n) => words(n).length > 0 && words(n).every((w) => qWords.includes(w)))),
  );
  const matches = (r: InventoryRow) => {
    const hay = words(`${r.name} ${r.strength} ${r.form} ${r.supplier_name ?? ""} ${r.location}`);
    const info = findDrugInfo(r.name);
    return (
      qWords.some((w) => hay.some((h) => h === w || (w.length >= 4 && h.startsWith(w)))) ||
      (r.ndc && qWords.includes(r.ndc.replace(/-/g, ""))) ||
      (info !== undefined && mentionedInfo.has(info))
    );
  };

  const picked = new Map<string, InventoryRow>();
  for (const r of inventory) if (matches(r)) picked.set(r.id, r);
  if (wantsLow(question)) for (const r of inventory) if (r.low) picked.set(r.id, r);

  const sources: Source[] = [];
  const add = (kind: SourceKind, prefix: string, label: string, href: string, text: string) => {
    const id = `${prefix}${sources.filter((s) => s.kind === kind).length + 1}`;
    sources.push({ id, kind, label, href, text: text.replace(/[\r\n]+/g, " ") });
  };

  // A one-line overview, so general questions ("how many products?") work.
  const lowCount = inventory.filter((r) => r.low).length;
  const allBatches = await expiryReport(ctx, 36_500);
  const expiring = allBatches.filter((b) => b.days_left <= warnDays);
  add(
    "summary",
    "O",
    "Dashboard summary",
    "/dashboard",
    `Pharmacy ${ctx.pharmacy.name}, branch ${ctx.branch.name}, today ${today}. ${inventory.length} medications on file; ` +
      `${lowCount} running low; ${expiring.filter((b) => b.days_left < 0).length} batches expired and ` +
      `${expiring.filter((b) => b.days_left >= 0).length} expiring within ${warnDays} days. Quantities are in units.`,
  );

  for (const r of [...picked.values()].slice(0, LIMITS.product)) {
    add("product", "P", productLabel(r), `/products/${r.id}`, productText(r));
  }

  // Batches: for the medications picked above, and every expiring batch when
  // the question is about expiry.
  const batchList = allBatches.filter((b) => picked.has(b.product_id) || (wantsExpiry(question) && b.days_left <= Math.max(warnDays, 90)));
  for (const b of batchList.slice(0, LIMITS.batch)) {
    const when = b.days_left < 0 ? `expired ${-b.days_left} days ago` : `expires in ${b.days_left} days`;
    add(
      "batch",
      "B",
      `${b.product_name} ${b.strength} lot ${b.lot_number}`,
      `/products/${b.product_id}`,
      `${b.product_name} ${b.strength} ${b.form}, lot ${b.lot_number}: ${b.quantity} units, expiry date ${b.expiry_date} (${when}), shelf ${b.location || "not set"}`,
    );
  }

  // Shipments: when asked about deliveries, or when they carry a picked medication.
  const shipments = await listShipments(ctx, { open: true });
  for (const s of shipments) {
    if (!wantsShipments(question) && !s.items.some((i) => picked.has(i.product_id))) continue;
    if (sources.filter((x) => x.kind === "shipment").length >= LIMITS.shipment) break;
    const warning = shipmentAlert(s, today);
    add(
      "shipment",
      "S",
      shipmentTitle(s),
      "/shipments",
      `${shipmentTitle(s)}: status ${s.status}${warning ? ` (${warning})` : ""}, expected ${s.expected_date}` +
        `${s.delay_reason ? `, delay reason: ${s.delay_reason}` : ""}; items: ${s.items.map((i) => `${i.quantity} x ${i.product_label}`).join("; ") || "none listed"}`,
    );
  }

  // Drug reference: for medications named in the question (in stock or not).
  if (wantsDrugInfo(question) || mentionedInfo.size > 0) {
    const infos = new Set<DrugInfo>(mentionedInfo);
    for (const r of picked.values()) {
      const info = findDrugInfo(r.name);
      if (info) infos.add(info);
    }
    for (const info of [...infos].slice(0, LIMITS.drug)) {
      add("drug", "D", `Drug reference: ${info.name}`, dailyMedUrl(info.name), drugText(info));
    }
  }

  // Nothing specific matched but the question is broad: give the flagged items.
  if (sources.length === 1 && (wantsOverview(question) || wantsLow(question))) {
    for (const r of inventory.filter((x) => x.low || x.soon || x.expired).slice(0, LIMITS.product)) {
      add("product", "P", productLabel(r), `/products/${r.id}`, productText(r));
    }
  }
  return sources;
}

/** The records as text for the AI, one per line with its ID. */
export function recordsText(sources: Source[]): string {
  return sources.map((s) => `[${s.id}] ${s.text}`).join("\n");
}

/** The sources the answer actually cited, in the order first cited. */
export function citedSources(answer: string, sources: Source[]): Source[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const seen = new Set<string>();
  for (const m of answer.matchAll(/\[([A-Z]\d+(?:\s*,\s*[A-Z]\d+)*)\]/g)) {
    for (const id of m[1].split(/\s*,\s*/)) if (byId.has(id)) seen.add(id);
  }
  return [...seen].map((id) => byId.get(id)!);
}

export const NOT_FOUND = "I couldn't find this";
