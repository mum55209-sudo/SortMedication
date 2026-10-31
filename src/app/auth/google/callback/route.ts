// Google sends people back here after they pick their Google account.

import { NextResponse, type NextRequest } from "next/server";
import { googleSignIn } from "@/lib/accounts";
import { UserError } from "@/lib/errors";
import { callbackUrl, GOOGLE_STATE_COOKIE, googleProblemCode, googleProfileFromCode } from "@/lib/google";
import { GOOGLE_SIGNUP_COOKIE, startSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const [savedState, from = "login"] = (request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "").split(".");
  const back = (problem: string) => {
    const url = new URL(`/${from === "signup" ? "signup" : "login"}`, request.url);
    url.searchParams.set("google", problem);
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" });
    return res;
  };

  // The person pressed "Cancel" on Google's page.
  if (params.get("error")) return back("cancelled");
  // The state must match the cookie, so nobody can trick a browser into
  // signing in with someone else's Google account.
  const code = params.get("code");
  if (!code || !savedState || params.get("state") !== savedState) return back("expired");

  try {
    const profile = await googleProfileFromCode(code, callbackUrl(request.nextUrl.origin));
    const result = await googleSignIn(profile);
    if (result.kind === "user") {
      await startSession(result.user.id);
      const res = NextResponse.redirect(new URL("/inventory", request.url));
      res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" });
      return res;
    }
    const res = NextResponse.redirect(new URL("/signup/google", request.url));
    res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" });
    res.cookies.set(GOOGLE_SIGNUP_COOKIE, result.signupToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 60,
    });
    return res;
  } catch (err) {
    if (err instanceof UserError) return back(googleProblemCode(err.message));
    console.error("Google sign-in error", err);
    return back("failed");
  }
}
