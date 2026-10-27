import { addBranchAction, renameBranchAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SettingsTabs } from "@/components/SettingsTabs";
import { requireContext } from "@/lib/session";

export default async function BranchesPage() {
  const ctx = await requireContext();
  const owner = ctx.user.role === "owner";
  return (
    <>
      <SettingsTabs current="/settings/branches" />
      <div className="card">
        <h2>Branches</h2>
        <p className="muted">Each branch keeps its own stock. Switch branch with the menu at the top. Your plan includes all branches.</p>
        {ctx.branches.map((b) => (
          <ActionForm key={b.id} action={renameBranchAction} className="toolbar">
            <input type="hidden" name="id" value={b.id} />
            <label className="grow">Name<input name="name" defaultValue={b.name} required disabled={!owner} /></label>
            <label className="grow">Address<input name="address" defaultValue={b.address} disabled={!owner} /></label>
            {owner && <button type="submit" className="secondary">Save</button>}
          </ActionForm>
        ))}
      </div>
      {owner && (
        <div className="card">
          <h2>Add a branch</h2>
          <ActionForm action={addBranchAction} className="toolbar" resetOnSuccess>
            <label className="grow">Name<input name="name" required /></label>
            <label className="grow">Address<input name="address" /></label>
            <button type="submit">Add branch</button>
          </ActionForm>
        </div>
      )}
    </>
  );
}
