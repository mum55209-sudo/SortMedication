// The "Ask AI" inventory assistant, powered by Google Gemini.
//
// How it works: when someone asks a question, the server (never the browser)
// gathers this branch's stock list, expiring batches and open shipments into
// a short text summary, and sends that summary plus the question to Gemini.
// Gemini's answer is passed back to the page.
//
// PRIVACY: only inventory facts are sent (medicine names, strengths, stock
// counts, lots, expiry dates, suppliers, shelf locations). No patient
// records and no staff details are ever included. Sending patient
// information to Gemini would need a HIPAA business associate agreement
// with Google first.
//
// It needs one setting: GEMINI_API_KEY (from https://aistudio.google.com).
// GEMINI_MODEL is optional and picks which Gemini model to use.

import type { Ctx } from "./accounts";
import { todayISO } from "./domain";
import { UserError } from "./errors";
import { listShipments, shipmentAlert, shipmentTitle } from "./shipments";
import { expiryReport, listInventory } from "./stock";

// The address can be changed for automated tests that use a pretend Gemini.
const API_BASE = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";

export const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY = 10;
// Keeps the summary a sensible size for very large pharmacies.
const MAX_PRODUCTS = 600;

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export function assistantConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// A text summary of this branch's stock for Gemini to read.
export async function inventorySummary(ctx: Ctx): Promise<string> {
  const today = todayISO();
  const items = await listInventory(ctx);
  const expiring = await expiryReport(ctx, Math.max(ctx.pharmacy.expiry_warning_days, 90));
  const shipments = await listShipments(ctx, { open: true });

  const clean = (s: string | null | undefined) => (s ?? "").replace(/[|\n\r]+/g, " ").trim();
  const lines: string[] = [
    `Pharmacy: ${clean(ctx.pharmacy.name)}. Branch: ${clean(ctx.branch.name)}. Today: ${today}.`,
    `"Expiring soon" means within ${ctx.pharmacy.expiry_warning_days} days. Quantities are in units (tablets, capsules, mL and so on); a pack holds pack_size units.`,
    "",
    `PRODUCTS (${items.length})`,
    "name | strength | form | units on hand | pack size | reorder level | reorder qty | next expiry | flags | DEA schedule | supplier | shelf",
  ];
  for (const r of items.slice(0, MAX_PRODUCTS)) {
    const flags = [r.low && "running low", r.soon && "expiring soon", r.expired && "has expired stock"].filter(Boolean).join(", ") || "ok";
    lines.push(
      [r.name, r.strength, r.form, r.total, r.pack_size, r.reorder_level, r.reorder_qty, r.next_expiry ?? "none", flags,
        r.dea_schedule === "none" ? "-" : r.dea_schedule, r.supplier_name ?? "-", r.location || "-"]
        .map((v) => clean(String(v)))
        .join(" | "),
    );
  }
  if (items.length > MAX_PRODUCTS) lines.push(`(${items.length - MAX_PRODUCTS} more products not listed)`);

  lines.push("", "BATCHES EXPIRED OR EXPIRING WITHIN 90 DAYS", "product | lot | expiry date | days left | units");
  if (expiring.length === 0) lines.push("none");
  for (const b of expiring.slice(0, MAX_PRODUCTS)) {
    lines.push([`${b.product_name} ${b.strength} ${b.form}`, b.lot_number, b.expiry_date, b.days_left, b.quantity].map((v) => clean(String(v))).join(" | "));
  }

  lines.push("", "OPEN SHIPMENTS", "shipment | expected date | status | warning | items");
  if (shipments.length === 0) lines.push("none");
  for (const s of shipments) {
    const alert = shipmentAlert(s, today) ?? "-";
    const contents = s.items.map((i) => `${i.quantity} x ${i.product_label}`).join("; ");
    lines.push([shipmentTitle(s), s.expected_date, s.status, alert, contents].map((v) => clean(String(v))).join(" | "));
  }
  return lines.join("\n");
}

const INSTRUCTIONS = `You are the inventory assistant inside SortMedication, stock-control software used by staff at a US pharmacy.
Answer questions about the pharmacy's stock using ONLY the inventory data provided. Be short, clear and practical; use simple bullet lists when listing items.
If the data doesn't contain the answer, say so plainly. Never invent stock numbers, lots or dates.
When suggesting what to reorder, use the reorder level and reorder quantity in the data.
You do not have patient information. If asked about a patient, explain that patient details are not shared with the assistant.
Do not give medical advice about treating patients; suggest asking the pharmacist instead.`;

// Turns what the page sent into a clean, limited conversation.
export function cleanHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is ChatTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .map((t) => ({ role: t.role, text: t.text.slice(0, 4000) }))
    .slice(-MAX_HISTORY);
}

export async function askAssistant(ctx: Ctx, question: string, history: ChatTurn[] = []): Promise<string> {
  const q = question.trim();
  if (!q) throw new UserError("Please type a question.");
  if (q.length > MAX_QUESTION_LENGTH) throw new UserError(`Please keep your question under ${MAX_QUESTION_LENGTH} characters.`);
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new UserError("The AI assistant isn't switched on yet. It needs a Gemini key first (see \"AI assistant\" in the README).");

  const summary = await inventorySummary(ctx);
  const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).replace(/[^a-zA-Z0-9.\-]/g, "");
  const contents = [
    ...history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
    { role: "user", parts: [{ text: q }] },
  ];

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${INSTRUCTIONS}\n\nINVENTORY DATA\n${summary}` }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new UserError("Couldn't reach Gemini. Please try again in a moment.");
  }

  if (res.status === 429) throw new UserError("Gemini is busy or the free limit was reached. Please wait a minute and try again.");
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.error("Gemini refused the request:", res.status, (await res.text()).slice(0, 500));
    throw new UserError("Gemini didn't accept the request. Check that GEMINI_API_KEY is correct.");
  }
  if (!res.ok) throw new UserError("Gemini had a problem answering. Please try again.");

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new UserError("Gemini didn't give an answer. Try asking in a different way.");
  return text;
}
