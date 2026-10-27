import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { TRIAL_DAYS } from "@/lib/domain";
import { getContext } from "@/lib/session";

export default async function LoginPage() {
  if (await getContext()) redirect("/dashboard");
  return (
    <main className="narrow">
      <p><Link href="/">← SortMedication</Link></p>
      <div className="card">
        <h1>Sign in</h1>
        <ActionForm action={loginAction}>
          <label>Email<input name="email" type="email" autoComplete="email" required autoFocus /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit">Sign in</button>
        </ActionForm>
        <p className="small muted">Forgot your password? Ask your pharmacy owner to reset it.</p>
      </div>
      <div className="card">
        <h2>No account yet?</h2>
        <p className="muted">Set up an account for your pharmacy. The first {TRIAL_DAYS} days are free and no card is needed.</p>
        <Link className="button secondary" href="/signup">Set up an account</Link>
      </div>
    </main>
  );
}
