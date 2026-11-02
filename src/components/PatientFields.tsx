import { todayISO } from "@/lib/domain";
import type { Patient } from "@/lib/patients";

export function PatientFields({ p }: { p?: Patient }) {
  return (
    <>
      <div className="fields">
        <label>First name<input name="first_name" defaultValue={p?.first_name} required /></label>
        <label>Last name<input name="last_name" defaultValue={p?.last_name} required /></label>
        <label>Date of birth<input name="date_of_birth" type="date" defaultValue={p?.date_of_birth} max={todayISO()} required /></label>
        <label>Phone<input name="phone" type="tel" defaultValue={p?.phone} /></label>
        <label>Insurance provider<input name="insurance_provider" defaultValue={p?.insurance_provider} placeholder="e.g. Medicare Part D" /></label>
        <label>Insurance member ID<input name="insurance_member_id" defaultValue={p?.insurance_member_id} /></label>
      </div>
      <label>Address<input name="address" defaultValue={p?.address} /></label>
      <label>
        Allergies
        <input name="allergies" defaultValue={p?.allergies} placeholder="e.g. Penicillin, sulfa drugs. Leave empty if none known." />
      </label>
      <label>Notes<input name="notes" defaultValue={p?.notes} /></label>
    </>
  );
}
