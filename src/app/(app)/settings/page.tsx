import { updatePharmacyAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SettingsTabs } from "@/components/SettingsTabs";
import { requireContext } from "@/lib/session";

export default async function SettingsPage() {
  const ctx = await requireContext();
  const p = ctx.pharmacy;
  const owner = ctx.user.role === "owner";
  return (
    <>
      <SettingsTabs current="/settings" />
      <div className="card">
        <h2>Pharmacy details</h2>
        {!owner && <p className="muted">Only the owner can change these.</p>}
        <ActionForm action={updatePharmacyAction}>
          <fieldset disabled={!owner} className="stack">
            <div className="fields">
              <label>Pharmacy name<input name="name" defaultValue={p.name} required /></label>
              <label>State license / DEA number<input name="license_number" defaultValue={p.license_number} /></label>
              <label>Phone<input name="phone" defaultValue={p.phone} /></label>
              <label>
                Expiry warning (days)
                <input name="expiry_warning_days" type="number" min={1} max={365} defaultValue={p.expiry_warning_days} required />
                <span className="hint">Batches expiring within this many days are flagged.</span>
              </label>
            </div>
            <label>Address<textarea name="address" rows={2} defaultValue={p.address} /></label>
            {owner && <div className="actions"><button type="submit">Save</button></div>}
          </fieldset>
        </ActionForm>
      </div>
    </>
  );
}
