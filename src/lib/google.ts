// Talking to Google for "Sign up / Sign in with Google".
//
// This uses Google's standard OAuth sign-in: we send the person to Google,
// Google sends them back to /auth/google/callback with a one-time code, and
// we swap that code (plus our secret) for their name and email address.
//
// It needs two settings from Google Cloud: GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET. See "Sign in with Google" in the README.

import { UserError } from "./errors";
import type { GoogleProfile } from "./accounts";

// The addresses can be changed for automated tests that use a pretend Google.
const AUTH_URL = process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const USERINFO_URL = process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";

// Holds a random value while the person is on Google's page.
export const GOOGLE_STATE_COOKIE = "sortmed_google_state";

// What the sign-in and sign-up pages say when Google sign-in comes back
// without signing the person in. Only these fixed messages can be shown, so
// a link someone sends can't put made-up text on our page.
const PROBLEMS: Record<string, string> = {
  "not-set-up":
    "Google sign-in isn't switched on yet. The app needs its Google keys first (see \"Sign in with Google\" in the README). You can use email and password for now.",
  cancelled: "Google sign-in was cancelled. You can try again, or use email and password.",
  expired: "That Google sign-in took too long or was started in another window. Please try again.",
  failed: "Google sign-in didn't finish. Please try again.",
  "no-email": "Google didn't share your email address. Please try again.",
  unverified: "Please verify your email address with Google first, then try again.",
  "other-google": "That email is already linked to a different Google account.",
  "switched-off": "This login has been switched off. Please ask your pharmacy owner.",
};

export function googleProblemText(problem: string | undefined): string | null {
  if (!problem) return null;
  return PROBLEMS[problem] ?? PROBLEMS.failed;
}

// Turns an error message back into its short code for the address bar.
export function googleProblemCode(message: string): string {
  return Object.keys(PROBLEMS).find((code) => PROBLEMS[code] === message) ?? "failed";
}

function problem(code: string): UserError {
  return new UserError(PROBLEMS[code]);
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Where Google sends people back to. It must match a "redirect URI" saved in
// Google Cloud exactly. APP_URL wins when set (e.g. https://app.example.com).
export function callbackUrl(requestOrigin: string): string {
  const base = (process.env.APP_URL || requestOrigin).replace(/\/+$/, "");
  return `${base}/auth/google/callback`;
}

export function googleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

// Swaps the one-time code for the person's Google profile.
export async function googleProfileFromCode(code: string, redirectUri: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    console.error("Google token exchange failed", tokenRes.status, await tokenRes.text());
    throw problem("failed");
  }
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  const infoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!access_token || !infoRes.ok) throw problem("failed");
  const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!info.sub || !info.email) throw problem("no-email");
  if (info.email_verified !== true) throw problem("unverified");
  return { sub: info.sub, email: info.email, name: info.name || "" };
}
