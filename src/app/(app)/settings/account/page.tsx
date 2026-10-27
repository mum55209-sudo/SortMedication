import { changePasswordAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SettingsTabs } from "@/components/SettingsTabs";
import { ROLE_LABELS } from "@/lib/domain";
import { requireContext } from "@/lib/session";

export default async function AccountPage() {
  const ctx = await requireContext();
  return (
    <>
      <SettingsTabs current="/settings/account" />
      <div className="card">
        <h2>{ctx.user.name}</h2>
        <p className="muted">{ctx.user.email} · {ROLE_LABELS[ctx.user.role]} at {ctx.pharmacy.name}</p>
        <h2>Change password</h2>
        <ActionForm action={changePasswordAction} resetOnSuccess>
          <div className="fields">
            <label>Current password<input name="current" type="password" autoComplete="current-password" required /></label>
            <label>New password<input name="next" type="password" autoComplete="new-password" minLength={8} required /></label>
            <label>New password again<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
          </div>
          <div className="actions"><button type="submit">Change password</button></div>
        </ActionForm>
      </div>
    </>
  );
}
