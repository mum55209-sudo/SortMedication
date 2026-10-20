import Link from "next/link";
import { importAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { requirePage } from "@/lib/session";

export default async function ImportPage() {
  const ctx = await requirePage("products.edit");
  return (
    <>
      <p><Link href="/inventory">← Inventory</Link></p>
      <h1>Import products from a spreadsheet</h1>
      <p className="subtitle">Adds products to {ctx.branch.name}. Save your spreadsheet as CSV first (in Excel: File → Save As → CSV).</p>
      <div className="card">
        <h2>How it works</h2>
        <ul>
          <li>The first row must hold column names. Only <strong>name</strong> is required.</li>
          <li>Columns: name, strength, form, pack_size, ndc, barcode, category (rx, otc, other), dea_schedule (none, II, III, IV, V), reorder_level, reorder_qty, supplier, cost_price, sell_price, storage (room, fridge, freezer, locked), location.</li>
          <li>To add opening stock, fill in <strong>lot_number</strong>, <strong>expiry_date</strong> (like 2027-03-31) and <strong>quantity</strong> (in single units).</li>
          <li>A product that already exists (same NDC, or same name, strength and form) is not duplicated; its stock is added.</li>
          <li>If any row has a problem, nothing is imported and you&apos;ll see which rows to fix.</li>
        </ul>
        <p><a href="/export/import-template">Download an example file</a></p>
      </div>
      <div className="card">
        <ActionForm action={importAction} resetOnSuccess>
          <label>CSV file<input type="file" name="file" accept=".csv,text/csv" required /></label>
          <div className="actions"><button type="submit">Import</button></div>
        </ActionForm>
      </div>
    </>
  );
}
