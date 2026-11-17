"use client";

// The chat box on the "Ask AI" page. It sends each question to
// /api/assistant on our own server, which asks Gemini. Under each answer it
// lists the records the answer came from, each linking to that record.
// Staff can also attach a photo (on a phone, "Take photo" opens the camera)
// or a PDF. Big photos are shrunk in the browser first, because the website
// only accepts uploads under 4 MB. The file goes to our server, never
// straight to Google.

import { useRef, useState } from "react";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

type Source = { id: string; label: string; href: string };
type Turn = { role: "user" | "assistant"; text: string; sources?: Source[]; attachment?: string };

/** Makes a big photo smaller (longest side 2000 px, JPEG), so it uploads quickly and fits. */
async function shrinkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // e.g. a HEIC photo this browser can't open: send it as it is
  }
}

const EXAMPLES = [
  "What's running low?",
  "What expires in the next 30 days?",
  "What should I reorder, and how much?",
  "Are any shipments late?",
];

export function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type) && !/\.(heic|heif)$/i.test(f.name)) {
      setError("Ask AI can read photos (JPEG, PNG, WEBP or HEIC) and PDFs. Please choose one of those.");
      return;
    }
    if (f.type === "application/pdf" && f.size > MAX_UPLOAD_BYTES) {
      setError(`That PDF is ${(f.size / 1024 / 1024).toFixed(1)} MB. Please use one under 4 MB (try sending just the pages you need).`);
      return;
    }
    setFile(f);
  }

  async function ask(text: string) {
    const q = text.trim();
    const attached = file;
    if ((!q && !attached) || pending) return;
    setError(null);
    setPending(true);
    const history = turns;
    const asked: Turn = { role: "user", text: q, attachment: attached?.name || (attached ? "Photo" : undefined) };
    setTurns([...history, asked]);
    setQuestion("");
    setFile(null);
    const plainHistory = history.map(({ role, text }) => ({ role, text }));
    const restore = () => {
      setTurns(history);
      setQuestion(q);
      setFile(attached);
    };
    try {
      let init: RequestInit;
      if (attached) {
        const blob = await shrinkPhoto(attached);
        if (blob.size > MAX_UPLOAD_BYTES) {
          setError(`That file is ${(blob.size / 1024 / 1024).toFixed(1)} MB. Please use a photo or PDF under 4 MB.`);
          restore();
          return;
        }
        const form = new FormData();
        form.set("question", q);
        form.set("history", JSON.stringify(plainHistory));
        form.set("file", blob, attached.name || "photo.jpg");
        init = { method: "POST", body: form };
      } else {
        init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, history: plainHistory }) };
      }
      const res = await fetch("/api/assistant", init);
      const data = (await res.json().catch(() => ({}))) as { answer?: string; sources?: Source[]; error?: string };
      if (!res.ok || !data.answer) {
        setError(data.error ?? "Something went wrong. Please try again.");
        restore();
      } else {
        setTurns([...history, asked, { role: "assistant", text: data.answer, sources: data.sources ?? [] }]);
      }
    } catch {
      setError("Couldn't reach the server. Check your internet connection and try again.");
      restore();
    } finally {
      setPending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0);
    }
  }

  return (
    <div className="card chat">
      {turns.length === 0 ? (
        <div className="chat-examples">
          <p className="muted">Try one of these:</p>
          <div className="actions">
            {EXAMPLES.map((e) => (
              <button key={e} type="button" className="secondary" onClick={() => ask(e)} disabled={pending}>{e}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-log" aria-live="polite">
          {turns.map((t, i) => (
            <div key={i} className={`chat-msg ${t.role}`}>
              <div className="chat-who">{t.role === "user" ? "You" : "Assistant"}</div>
              {t.attachment && <div className="chat-attachment muted">Attached: {t.attachment}</div>}
              {t.text && <div className="chat-text">{t.text}</div>}
              {t.role === "assistant" && t.sources && t.sources.length > 0 && (
                <div className="chat-sources">
                  <div className="chat-who">Sources</div>
                  <ul>
                    {t.sources.map((s) => (
                      <li key={s.id}>
                        <span className="muted">[{s.id}]</span>{" "}
                        {s.href.startsWith("/") ? <a href={s.href}>{s.label}</a> : <a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {pending && <div className="chat-msg assistant"><div className="chat-who">Assistant</div><div className="chat-text muted">Thinking…</div></div>}
          <div ref={endRef} />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label className="grow">
          Your question
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Which fridge items expire this month?"
          />
        </label>
        <div className="actions">
          <button type="submit" disabled={pending || (!question.trim() && !file)}>{pending ? "Asking…" : "Ask"}</button>
          {turns.length > 0 && (
            <button type="button" className="secondary" onClick={() => { setTurns([]); setError(null); }} disabled={pending}>New chat</button>
          )}
        </div>
        <div className="chat-upload grow">
          {/* "capture" makes phones open the camera straight away. */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={uploadRef} type="file" accept={ACCEPT} hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="actions">
            <button type="button" className="secondary" onClick={() => cameraRef.current?.click()} disabled={pending}>Take photo</button>
            <button type="button" className="secondary" onClick={() => uploadRef.current?.click()} disabled={pending}>Upload photo or PDF</button>
            {file && (
              <span className="chat-file">
                {file.name || "Photo"}{" "}
                <button type="button" className="link" onClick={() => setFile(null)} disabled={pending} aria-label="Remove attached file">Remove</button>
              </span>
            )}
          </div>
          <p className="muted small">
            Photos of medicine packs, delivery slips or invoices (PDF), under 4 MB. Don&apos;t upload anything showing patient details, such as prescription labels. Files aren&apos;t saved.
          </p>
        </div>
      </form>
    </div>
  );
}
