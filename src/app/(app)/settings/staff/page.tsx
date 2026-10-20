import { addStaffAction, updateStaffAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SettingsTabs } from "@/components/SettingsTabs";
import { listStaff } from "@/lib/accounts";
import { ROLE_LABELS, ROLES } from "@/lib/domain";
import { requireContext } from "@/lib/session";

const ROLE_HELP: Record<string, string> = {
  owner: "Everything, including staff, settings and the subscription.",
  pharmacist: "Products, suppliers and all stock changes, including adjustments.",
  technician: "Receive deliveries and dispense or return stock.",
  readonly: "View stock and reports only.",
};

export default async function StaffPage() {
  const ctx = await requireContext();
  const owner = ctx.user.role === "owner";
  const staff = await listStaff(ctx);
  return (
    <>
      <SettingsTabs current="/settings/staff" />
      <div className="card">
        <h2>Staff logins</h2>
        <ul className="small muted">
          {ROLES.map((r) => <li key={r}><strong>{ROLE_LABELS[r]}:</strong> {ROLE_HELP[r]}</li>)}
        </ul>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role and access</th></tr></thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} className={u.active ? "" : "muted"}>
                  <td>{u.name}{u.id === ctx.user.id && " (you)"}</td>
                  <td>{u.email}</td>
                  <td>
                    {owner ? (
                      <ActionForm action={updateStaffAction} className="toolbar">
                        <input type="hidden" name="id" value={u.id} />
                        <select name="role" defaultValue={u.role} aria-label="Role">
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                        <select name="active" defaultValue={u.active ? "yes" : "no"} aria-label="Login">
                          <option value="yes">Can log in</option>
                          <option value="no">Login disabled</option>
                        </select>
                        <input name="password" type="password" placeholder="New password (optional)" minLength={8} autoComplete="new-password" aria-label="New password" />
                        <button type="submit" className="secondary small">Save</button>
                      </ActionForm>
                    ) : (
                      <>{ROLE_LABELS[u.role]}{!u.active && " · login disabled"}</>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {owner && (
        <div className="card">
          <h2>Add a staff member</h2>
          <p className="muted">Choose a temporary password and give it to them. They can change it under My account.</p>
          <ActionForm action={addStaffAction} resetOnSuccess>
            <div className="fields">
              <label>Name<input name="name" required /></label>
              <label>Email<input name="email" type="email" required /></label>
              <label>
                Role
                <select name="role" defaultValue="technician">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </label>
              <label>Temporary password<input name="password" type="text" minLength={8} required autoComplete="off" /></label>
            </div>
            <div className="actions"><button type="submit">Add staff member</button></div>
          </ActionForm>
        </div>
      )}
    </>
  );
}
