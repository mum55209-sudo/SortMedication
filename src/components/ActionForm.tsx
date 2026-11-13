"use client";

// A form that sends its fields to a server action, shows any error message
// the action returns, and keeps what the person typed if something is wrong.

import { useState, useTransition, type ReactNode } from "react";

function isRedirect(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}

type Action = (formData: FormData) => Promise<{ error?: string; message?: string } | void>;

export function ActionForm({
  action,
  children,
  className = "stack",
  confirm,
  resetOnSuccess = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const form = event.currentTarget;
        // Include the clicked button's name and value, like a normal form does.
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(form, submitter);
        startTransition(async () => {
          let result: Awaited<ReturnType<Action>>;
          try {
            result = await action(data);
          } catch (err) {
            // A redirect from the server is how a successful form moves on.
            if (isRedirect(err)) throw err;
            // Anything else (server down, database not reachable...) would
            // otherwise make the button silently do nothing.
            setMessage(null);
            setError("Something went wrong on our side, so this didn't go through. Please try again in a moment.");
            return;
          }
          setError(result?.error ?? null);
          setMessage(result?.message ?? null);
          if (!result?.error && resetOnSuccess) form.reset();
        });
      }}
    >
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      <fieldset disabled={pending} className={className}>
        {children}
      </fieldset>
    </form>
  );
}
