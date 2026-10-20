// An error whose message is safe and useful to show to the person using the
// app, such as "Not enough stock in this batch".
export class UserError extends Error {}

export type ActionResult = { error?: string; message?: string } | void;

export function toActionError(err: unknown): { error: string } {
  if (err instanceof UserError) return { error: err.message };
  throw err;
}
