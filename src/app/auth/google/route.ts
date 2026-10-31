// Pressing "Sign up with Google" or "Sign in with Google" comes here. We
// remember a random "state" value in a cookie and send the person to Google.

import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { callbackUrl, GOOGLE_STATE_COOKIE, googleAuthUrl, googleConfigured } from "@/lib/google";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") === "signup" ? "signup" : "login";
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL(`/${from}?google=not-set-up`, request.url));
  }
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(googleAuthUrl(state, callbackUrl(request.nextUrl.origin)));
  response.cookies.set(GOOGLE_STATE_COOKIE, `${state}.${from}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 10 * 60,
  });
  return response;
}
