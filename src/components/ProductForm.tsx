import { ActionForm } from "@/components/ActionForm";
import { CATEGORIES, DEA_SCHEDULES, FORMS, STORAGE } from "@/lib/domain";
import type { ActionResult } from "@/lib/errors";
import type { Product, Supplier } from "@/lib/stock";

export function ProductForm({
  action,
  product,
  suppliers,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  product?: Product;
  suppliers: Supplier[];
}) {
  const p = product;
  return (
    <ActionForm action={action}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <fieldset className="group">
        <legend>What it is</legend>
        <div className="fields">
          <label>Name<input name="name" defaultValue={p?.name} required placeholder="Amoxicillin" /></label>
          <label>Strength<input name="strength" defaultValue={p?.strength} placeholder="500 mg" /></label>
          <label>
            Form
            <input name="form" defaultValue={p?.form} list="forms" placeholder="Capsule" />
            <datalist id="forms">{FORMS.map((f) => <option key={f} value={f} />)}</datalist>
          </label>
          <label>
            Pack size
            <input name="pack_size" type="number" min={1} step={1} defaultValue={p?.pack_size ?? 1} required />
            <span className="hint">Units (tablets, ml…) in one pack.</span>
          </label>
          <label>
            NDC
            <input name="ndc" defaultValue={p?.ndc} placeholder="0093-4155-73" pattern="[0-9\-]{10,13}" />
            <span className="hint">10 or 11 digit National Drug Code.</span>
          </label>
          <label>
            Barcode
            <input name="barcode" defaultValue={p?.barcode} inputMode="numeric" />
            <span className="hint">Click here and scan the box.</span>
          </label>
          <label>
            Category
            <select name="category" defaultValue={p?.category ?? "rx"}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>
            DEA schedule
            <select name="dea_schedule" defaultValue={p?.dea_schedule ?? "none"}>
              {DEA_SCHEDULES.map((s) => <option key={s} value={s}>{s === "none" ? "Not controlled" : `Schedule ${s}`}</option>)}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>Reordering and prices</legend>
        <div className="fields">
          <label>
            Reorder level
            <input name="reorder_level" type="number" min={0} step={1} defaultValue={p?.reorder_level ?? 0} />
            <span className="hint">In units. Shown as running low at or below this.</span>
          </label>
          <label>
            Reorder quantity
            <input name="reorder_qty" type="number" min={0} step={1} defaultValue={p?.reorder_qty ?? 0} />
            <span className="hint">In units. How much to order.</span>
          </label>
          <label>
            Preferred supplier
            <select name="supplier_id" defaultValue={p?.supplier_id ?? ""}>
              <option value="">None</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            Cost price per pack ($)
            <input name="cost_price" type="number" min={0} step="0.01" defaultValue={p?.cost_price ?? ""} />
          </label>
          <label>
            Selling price per pack ($)
            <input name="sell_price" type="number" min={0} step="0.01" defaultValue={p?.sell_price ?? ""} />
          </label>
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>Where it&apos;s kept</legend>
        <div className="fields">
          <label>
            Storage
            <select name="storage" defaultValue={p?.storage ?? "room"}>
              {Object.entries(STORAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Shelf location<input name="location" defaultValue={p?.location} placeholder="Bay 4, shelf 2" /></label>
        </div>
      </fieldset>

      <div className="actions">
        <button type="submit" name="next" value="">{p ? "Save changes" : "Add product"}</button>
        {!p && <button type="submit" name="next" value="receive" className="secondary">Add and receive stock</button>}
      </div>
    </ActionForm>
  );
}
