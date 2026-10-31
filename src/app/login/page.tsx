import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { GoogleButton } from "@/components/GoogleButton";
import { TRIAL_DAYS } from "@/lib/domain";
import { googleProblemText } from "@/lib/google";
import { getContext } from "@/lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  if (await getContext()) redirect("/inventory");
  const googleProblem = googleProblemText((await searchParams).google);
  return (
    <main className="narrow">
      <p><Link href="/">← SortMedication</Link></p>
      <div className="card">
        <h1>Sign in</h1>
        {googleProblem && <p className="error" role="alert">{googleProblem}</p>}
        <GoogleButton from="login" label="Sign in with Google" />
        <p className="or">or sign in with your email</p>
        <ActionForm action={loginAction}>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit">Sign in</button>
        </ActionForm>
        <p className="small muted">Forgot your password? Ask your pharmacy owner to reset it.</p>
      </div>
      <div className="card">
        <h2>No account yet?</h2>
        <p className="muted">Set up an account for your pharmacy, with Google or your email. The first {TRIAL_DAYS} days are free and no card is needed.</p>
        <Link className="button" href="/signup">Start your {TRIAL_DAYS}-day free trial</Link>
      </div>
    </main>
  );
}
