import { saveSupplierAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SettingsTabs } from "@/components/SettingsTabs";
import { can } from "@/lib/domain";
import { requireContext } from "@/lib/session";
import { listSuppliers, type Supplier } from "@/lib/stock";

function SupplierFields({ s, disabled }: { s?: Supplier; disabled: boolean }) {
  return (
    <div className="fields">
      <label>Name<input name="name" defaultValue={s?.name} required disabled={disabled} /></label>
      <label>Contact<input name="contact_name" defaultValue={s?.contact_name} disabled={disabled} /></label>
      <label>Phone<input name="phone" defaultValue={s?.phone} disabled={disabled} /></label>
      <label>Email<input name="email" type="email" defaultValue={s?.email} disabled={disabled} /></label>
      <label>Account number<input name="account_number" defaultValue={s?.account_number} disabled={disabled} /></label>
    </div>
  );
}

export default async function SuppliersPage() {
  const ctx = await requireContext();
  const editable = can(ctx.user.role, "suppliers.edit");
  const suppliers = await listSuppliers(ctx);
  return (
    <>
      <SettingsTabs current="/settings/suppliers" />
      {editable && (
        <div className="card">
          <h2>Add a supplier</h2>
          <ActionForm action={saveSupplierAction} resetOnSuccess>
            <SupplierFields disabled={false} />
            <div className="actions"><button type="submit">Add supplier</button></div>
          </ActionForm>
        </div>
      )}
      {suppliers.length === 0 && <div className="card"><p className="muted">No suppliers yet.</p></div>}
      {suppliers.map((s) => (
        <div className="card" key={s.id}>
          <ActionForm action={saveSupplierAction}>
            <input type="hidden" name="id" value={s.id} />
            <SupplierFields s={s} disabled={!editable} />
            {editable && <div className="actions"><button type="submit" className="secondary">Save</button></div>}
          </ActionForm>
        </div>
      ))}
    </>
  );
}
