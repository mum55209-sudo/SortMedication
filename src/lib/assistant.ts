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
// Tried in order. "gemini-flash-latest" always points at Google's current
// Flash model, so it keeps working when older names are retired.
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];

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

const INSTRUCTIONS = `You are the inventory assistant inside SortMed, stock-control software used by staff at a US pharmacy.
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
  const contents = [
    ...history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
    { role: "user", parts: [{ text: q }] },
  ];
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: `${INSTRUCTIONS}\n\nINVENTORY DATA\n${summary}` }] },
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  });

  // Google retires model names from time to time. If the chosen one is gone
  // (404), try the next one so the assistant keeps working.
  const models = [...new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean) as string[])]
    .map((m) => m.replace(/^models\//, "").replace(/[^a-zA-Z0-9.\-]/g, ""));

  let res: Response | undefined;
  let detail = "";
  for (const model of models) {
    try {
      res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw new UserError("Couldn't reach Gemini (no answer within 45 seconds). Please try again in a moment.");
    }
    // Newer AI Studio keys start with "AQ." instead of "AIza". Some setups
    // reject them in the header (401), so try once more with ?key= instead.
    if (res.status === 401) {
      try {
        res = await fetch(`${API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(45_000),
        });
      } catch {
        throw new UserError("Couldn't reach Gemini (no answer within 45 seconds). Please try again in a moment.");
      }
    }
    if (res.ok) break;
    detail = await geminiErrorText(res);
    console.error(`Gemini error with model ${model}:`, res.status, detail);
    if (res.status !== 404) break;
  }
  if (!res) throw new UserError("Gemini had a problem answering. Please try again.");
  if (!res.ok) throw new UserError(explainGeminiError(res.status, detail));

  const data = (await res.json()) as {
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) {
    throw new UserError(`Gemini refused this question (${data.promptFeedback.blockReason}). Try asking in a different way.`);
  }
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
  if (!text) {
    const why = candidate?.finishReason ? ` (reason: ${candidate.finishReason})` : "";
    throw new UserError(`Gemini didn't give an answer${why}. Try asking in a different way.`);
  }
  return text;
}

// Google's own explanation, e.g. "API key not valid. Please pass a valid API key."
async function geminiErrorText(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  try {
    const msg = (JSON.parse(raw) as { error?: { message?: string } }).error?.message;
    if (msg) return msg.slice(0, 300);
  } catch {
    // not JSON
  }
  return raw.slice(0, 300);
}

// A plain reason for each kind of failure, plus Google's own words.
export function explainGeminiError(status: number, detail: string): string {
  const said = detail ? ` Google said: "${detail}"` : "";
  if (/api key not valid|API_KEY_INVALID|api key expired/i.test(detail)) {
    return `Your Gemini key isn't valid. Copy it again from aistudio.google.com, update GEMINI_API_KEY in Vercel and redeploy.${said}`;
  }
  if (status === 429) return `The Gemini free limit was reached or too many questions came at once. Wait a minute and try again.${said}`;
  if (status === 403) {
    return `Your Gemini key isn't allowed to use Gemini. Make a new key at aistudio.google.com (Get API key), update GEMINI_API_KEY in Vercel and redeploy.${said}`;
  }
  if (status === 400 && /location|region|country/i.test(detail)) return `Gemini isn't available from where the website runs.${said}`;
  if (status === 400) return `Gemini didn't accept the request.${said}`;
  if (status === 401) {
    return `Your Gemini key wasn't accepted. Check GEMINI_API_KEY in Vercel has the whole key (keys from AI Studio start with "AQ." or "AIza"), with no spaces.${said}`;
  }
  if (status === 404) return `None of the Gemini models the app tried are available to your key. Set GEMINI_MODEL in Vercel to a model listed in aistudio.google.com.${said}`;
  if (status >= 500) return `Gemini is having trouble right now (Google's side). Please try again in a few minutes.${said}`;
  return `Gemini had a problem answering (error ${status}).${said}`;
}
