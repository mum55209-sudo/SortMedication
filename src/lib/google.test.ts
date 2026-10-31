// Tests for "Sign up / Sign in with Google" (the part after Google has said
// who the person is). Run with: npm test

import { describe, expect, it } from "vitest";
import {
  changeOwnPassword,
  contextForUser,
  createPharmacyAccount,
  createPharmacyWithGoogle,
  getGoogleSignup,
  googleSignIn,
  hasPassword,
  verifyLogin,
} from "./accounts";
import { one } from "./db";
import { googleProblemCode, googleProblemText } from "./google";

describe("Sign up with Google", () => {
  it("asks a new person for their pharmacy, then makes the account", async () => {
    const first = await googleSignIn({ sub: "g-1", email: "New.Owner@Gmail.com", name: "Nia Owner" });
    expect(first.kind).toBe("new");
    if (first.kind !== "new") return;
    expect(await getGoogleSignup(first.signupToken)).toEqual({ email: "new.owner@gmail.com", name: "Nia Owner" });

    await expect(createPharmacyWithGoogle(first.signupToken, { pharmacyName: " ", ownerName: "Nia" })).rejects.toThrow("pharmacy's name");
    const { userId } = await createPharmacyWithGoogle(first.signupToken, { pharmacyName: "Corner Pharmacy", ownerName: "Nia Owner" });
    const user = await one<{ role: string; google_id: string; password_hash: string | null }>("SELECT * FROM users WHERE id = $1", [userId]);
    expect(user).toMatchObject({ role: "owner", google_id: "g-1", password_hash: null });

    // The same sign-up can't be used twice.
    await expect(createPharmacyWithGoogle(first.signupToken, { pharmacyName: "Again", ownerName: "Nia" })).rejects.toThrow("timed out");

    // Next time, Google signs them straight in.
    const again = await googleSignIn({ sub: "g-1", email: "new.owner@gmail.com", name: "Nia Owner" });
    expect(again.kind === "user" && again.user.id).toBe(userId);
  });

  it("can't sign in with a password until one is set", async () => {
    const res = await googleSignIn({ sub: "g-2", email: "pw@example.com", name: "Pat" });
    if (res.kind !== "new") throw new Error("expected new");
    const { userId } = await createPharmacyWithGoogle(res.signupToken, { pharmacyName: "Pat's", ownerName: "Pat" });
    await expect(verifyLogin("pw@example.com", "")).rejects.toThrow("Sign in with Google");
    expect(await hasPassword(userId)).toBe(false);

    const ctx = await contextForUser((await verifyLoginOrNull(userId))!, null);
    await changeOwnPassword(ctx, "", "a-new-password");
    expect(await hasPassword(userId)).toBe(true);
    expect((await verifyLogin("pw@example.com", "a-new-password")).id).toBe(userId);
  });

  it("links Google to an existing email login", async () => {
    await createPharmacyAccount({ pharmacyName: "Old Pharmacy", ownerName: "Olu", email: "olu@example.com", password: "password123" });
    const res = await googleSignIn({ sub: "g-3", email: "olu@example.com", name: "Olu" });
    expect(res.kind).toBe("user");
    // The password still works too.
    expect((await verifyLogin("olu@example.com", "password123")).email).toBe("olu@example.com");
    // A different Google account with the same email is refused.
    await expect(googleSignIn({ sub: "g-other", email: "olu@example.com", name: "Olu" })).rejects.toThrow("different Google account");
  });

  it("refuses an email that already has an account when finishing sign-up", async () => {
    const res = await googleSignIn({ sub: "g-4", email: "race@example.com", name: "R" });
    if (res.kind !== "new") throw new Error("expected new");
    await createPharmacyAccount({ pharmacyName: "First", ownerName: "R", email: "race@example.com", password: "password123" });
    await expect(createPharmacyWithGoogle(res.signupToken, { pharmacyName: "Second", ownerName: "R" })).rejects.toThrow("already exists");
  });

  it("only shows fixed messages", () => {
    expect(googleProblemText(undefined)).toBeNull();
    expect(googleProblemText("cancelled")).toContain("cancelled");
    expect(googleProblemText("<script>")).toBe(googleProblemText("failed"));
    expect(googleProblemCode("This login has been switched off. Please ask your pharmacy owner.")).toBe("switched-off");
    expect(googleProblemCode("That email is already linked to a different Google account.")).toBe("other-google");
    expect(googleProblemCode("something else")).toBe("failed");
  });
});

async function verifyLoginOrNull(userId: string) {
  return one<import("./accounts").User>("SELECT id, pharmacy_id, name, email, role, active FROM users WHERE id = $1", [userId]);
}
