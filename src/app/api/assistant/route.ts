// The "Ask AI" page sends questions here. This runs on the server, so the
// Gemini key is never sent to anyone's browser. A question can come with a
// photo or PDF (sent as a form upload); the file is checked here, passed to
// Gemini from this server, and never saved.

import { askAssistant, cleanHistory } from "@/lib/assistant";
import { UserError } from "@/lib/errors";
import { checkUpload, checkUploadSize, MAX_UPLOAD_BYTES, type UploadedFile } from "@/lib/upload";
import { getContext } from "@/lib/session";

// Gemini can be slow when busy, and the app may try a few models.
export const maxDuration = 60;

export async function POST(request: Request) {
  const ctx = await getContext();
  if (!ctx) return Response.json({ error: "Please log in again." }, { status: 401 });

  // Only accept questions sent from this website's own pages.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Not allowed." }, { status: 403 });

  let question: unknown;
  let history: unknown;
  let file: UploadedFile | undefined;
  try {
    if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      // Refuse very big uploads before reading them.
      const length = Number(request.headers.get("content-length") ?? 0);
      if (length > MAX_UPLOAD_BYTES + 64 * 1024) checkUploadSize(length);
      const form = await request.formData();
      question = form.get("question") ?? "";
      history = JSON.parse(String(form.get("history") ?? "[]"));
      const upload = form.get("file");
      if (upload instanceof Blob && upload.size > 0) {
        checkUploadSize(upload.size);
        file = checkUpload(new Uint8Array(await upload.arrayBuffer()));
      }
    } else {
      const body = (await request.json()) as { question?: unknown; history?: unknown };
      question = body.question;
      history = body.history;
    }
  } catch (err) {
    if (err instanceof UserError) return Response.json({ error: err.message }, { status: 400 });
    return Response.json({ error: "Please type a question." }, { status: 400 });
  }
  try {
    const { answer, sources } = await askAssistant(ctx, typeof question === "string" ? question : "", cleanHistory(history), file);
    // Only what the page needs to show each source: its name and link.
    return Response.json({ answer, sources: sources.map(({ id, label, href }) => ({ id, label, href })) });
  } catch (err) {
    if (err instanceof UserError) return Response.json({ error: err.message }, { status: 400 });
    console.error("AI assistant failed:", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
