import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { googleSignupAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { getGoogleSignup } from "@/lib/accounts";
import { PRICE_PER_MONTH_USD, TRIAL_DAYS } from "@/lib/domain";
import { getContext, GOOGLE_SIGNUP_COOKIE } from "@/lib/session";

// The last step of "Sign up with Google": Google told us who you are, now
// tell us about your pharmacy.
export default async function GoogleSignupPage() {
  if (await getContext()) redirect("/inventory");
  const token = (await cookies()).get(GOOGLE_SIGNUP_COOKIE)?.value;
  const pending = token ? await getGoogleSignup(token) : null;
  if (!pending) redirect("/signup?google=expired");
  return (
    <main className="narrow">
      <p><Link href="/signup">← Back</Link></p>
      <div className="card">
        <h1>Almost done</h1>
        <p className="subtitle">{TRIAL_DAYS} days free, no card needed. Then ${PRICE_PER_MONTH_USD}/month per pharmacy.</p>
        <p className="notice">Signed in with Google as <strong>{pending.email}</strong>.</p>
        <ActionForm action={googleSignupAction}>
          <label>Pharmacy name<input name="pharmacyName" required autoFocus /></label>
          <label>Your name<input name="ownerName" autoComplete="name" defaultValue={pending.name} required /></label>
          <label className="inline">
            <input type="checkbox" name="agree" value="yes" required />
            <span>I understand SortMedication is for stock only, and I won&apos;t enter patient names or details.</span>
          </label>
          <button type="submit">Create account</button>
        </ActionForm>
      </div>
      <p className="muted">Wrong Google account? <Link href="/auth/google?from=signup">Choose another</Link>.</p>
    </main>
  );
}
