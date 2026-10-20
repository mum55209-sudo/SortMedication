import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { getContext } from "@/lib/session";

export default async function LoginPage() {
  if (await getContext()) redirect("/dashboard");
  return (
    <main className="narrow">
      <p><Link href="/">← SortMedication</Link></p>
      <div className="card">
        <h1>Log in</h1>
        <ActionForm action={loginAction}>
          <label>Email<input name="email" type="email" autoComplete="email" required autoFocus /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit">Log in</button>
        </ActionForm>
      </div>
      <p className="muted">New pharmacy? <Link href="/signup">Start a free trial</Link>. Forgot your password? Ask your pharmacy owner to reset it.</p>
    </main>
  );
}
