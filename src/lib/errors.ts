// An error whose message is safe and useful to show to the person using the
// app, such as "Not enough stock in this batch".
export class UserError extends Error {}

// "warning" means it worked, but something needs attention (shown in amber).
export type ActionResult = { error?: string; message?: string; warning?: string } | void;

export function toActionError(err: unknown): { error: string } {
  if (err instanceof UserError) return { error: err.message };
  throw err;
}
