import { changePasswordAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SettingsTabs } from "@/components/SettingsTabs";
import { hasPassword } from "@/lib/accounts";
import { ROLE_LABELS } from "@/lib/domain";
import { requireContext } from "@/lib/session";

export default async function AccountPage() {
  const ctx = await requireContext();
  const withPassword = await hasPassword(ctx.user.id);
  return (
    <>
      <SettingsTabs current="/settings/account" />
      <div className="card">
        <h2>{ctx.user.name}</h2>
        <p className="muted">{ctx.user.email} · {ROLE_LABELS[ctx.user.role]} at {ctx.pharmacy.name}</p>
        <h2>{withPassword ? "Change password" : "Set a password"}</h2>
        {!withPassword && (
          <p className="muted">You sign in with Google. You can also set a password to sign in with your email.</p>
        )}
        <ActionForm action={changePasswordAction} resetOnSuccess>
          <div className="fields">
            {withPassword && (
              <label>Current password<input name="current" type="password" autoComplete="current-password" required /></label>
            )}
            <label>New password<input name="next" type="password" autoComplete="new-password" minLength={8} required /></label>
            <label>New password again<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
          </div>
          <div className="actions"><button type="submit">{withPassword ? "Change password" : "Set password"}</button></div>
        </ActionForm>
      </div>
    </>
  );
}
