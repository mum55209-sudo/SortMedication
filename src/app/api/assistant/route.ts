// The "Ask AI" page sends questions here. This runs on the server, so the
// Gemini key is never sent to anyone's browser.

import { askAssistant, cleanHistory } from "@/lib/assistant";
import { UserError } from "@/lib/errors";
import { getContext } from "@/lib/session";

export async function POST(request: Request) {
  const ctx = await getContext();
  if (!ctx) return Response.json({ error: "Please log in again." }, { status: 401 });

  // Only accept questions sent from this website's own pages.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Not allowed." }, { status: 403 });

  let body: { question?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Please type a question." }, { status: 400 });
  }
  try {
    const answer = await askAssistant(ctx, typeof body.question === "string" ? body.question : "", cleanHistory(body.history));
    return Response.json({ answer });
  } catch (err) {
    if (err instanceof UserError) return Response.json({ error: err.message }, { status: 400 });
    console.error("AI assistant failed:", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
