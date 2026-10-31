// Reading the logged-in user from the browser's cookie, for pages and actions.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSession, deleteSession, loadContext, type Ctx } from "./accounts";
import { can, type Permission } from "./domain";

const COOKIE = "sortmed_session";

// Holds an unfinished Google sign-up (see /signup/google).
export const GOOGLE_SIGNUP_COOKIE = "sortmed_google_signup";

export async function startSession(userId: string) {
  const { token, expires } = await createSession(userId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await deleteSession(token);
  jar.delete(COOKIE);
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

// Looked up once per request, however many components ask.
export const getContext = cache(async (): Promise<Ctx | null> => {
  const token = await sessionToken();
  return token ? loadContext(token) : null;
});

// For pages and actions that need someone logged in.
export async function requireContext(): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  return ctx;
}

// For pages only some roles may open.
export async function requirePage(permission: Permission): Promise<Ctx> {
  const ctx = await requireContext();
  if (!can(ctx.user.role, permission)) redirect("/dashboard");
  return ctx;
}
