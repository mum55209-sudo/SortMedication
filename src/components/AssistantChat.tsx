"use client";

// The chat box on the "Ask AI" page. It sends each question to
// /api/assistant on our own server, which asks Gemini. Under each answer it
// lists the records the answer came from, each linking to that record.

import { useRef, useState } from "react";

type Source = { id: string; label: string; href: string };
type Turn = { role: "user" | "assistant"; text: string; sources?: Source[] };

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
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setError(null);
    setPending(true);
    const history = turns;
    setTurns([...history, { role: "user", text: q }]);
    setQuestion("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: history.map(({ role, text }) => ({ role, text })) }),
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; sources?: Source[]; error?: string };
      if (!res.ok || !data.answer) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setTurns(history);
        setQuestion(q);
      } else {
        setTurns([...history, { role: "user", text: q }, { role: "assistant", text: data.answer, sources: data.sources ?? [] }]);
      }
    } catch {
      setError("Couldn't reach the server. Check your internet connection and try again.");
      setTurns(history);
      setQuestion(q);
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
              <div className="chat-text">{t.text}</div>
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
          <button type="submit" disabled={pending || !question.trim()}>{pending ? "Asking…" : "Ask"}</button>
          {turns.length > 0 && (
            <button type="button" className="secondary" onClick={() => { setTurns([]); setError(null); }} disabled={pending}>New chat</button>
          )}
        </div>
      </form>
    </div>
  );
}
