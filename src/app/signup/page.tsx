import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { GoogleButton } from "@/components/GoogleButton";
import { PRICE_PER_MONTH_USD, TRIAL_DAYS } from "@/lib/domain";
import { googleProblemText } from "@/lib/google";
import { getContext } from "@/lib/session";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  if (await getContext()) redirect("/inventory");
  const googleProblem = googleProblemText((await searchParams).google);
  return (
    <main className="narrow">
      <p><Link href="/">← SortMedication</Link></p>
      <div className="card">
        <h1>Start your free trial</h1>
        <p className="subtitle">{TRIAL_DAYS} days free, no card needed. Then ${PRICE_PER_MONTH_USD}/month per pharmacy.</p>
        {googleProblem && <p className="error" role="alert">{googleProblem}</p>}
        <GoogleButton from="signup" label="Sign up with Google" />
        <p className="or">or sign up with your email</p>
        <ActionForm action={signupAction}>
          <label>Pharmacy name<input name="pharmacyName" required /></label>
          <label>Your name<input name="ownerName" autoComplete="name" required /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
            <span className="hint">At least 8 characters.</span>
          </label>
          <label className="inline">
            <input type="checkbox" name="agree" value="yes" required />
            <span>I understand SortMedication is for stock only, and I won&apos;t enter patient names or details.</span>
          </label>
          <button type="submit">Create account</button>
        </ActionForm>
      </div>
      <p className="muted">Already have an account? <Link href="/login">Sign in</Link>.</p>
    </main>
  );
}
