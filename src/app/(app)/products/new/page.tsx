import Link from "next/link";
import { createProductAction } from "@/app/actions";
import { ProductForm } from "@/components/ProductForm";
import { requirePage } from "@/lib/session";
import { listSuppliers } from "@/lib/stock";

export default async function NewProductPage() {
  const ctx = await requirePage("products.edit");
  const suppliers = await listSuppliers(ctx);
  return (
    <>
      <p><Link href="/inventory">← Inventory</Link></p>
      <h1>Add product</h1>
      <p className="subtitle">Adds the product to {ctx.branch.name}. Stock is added afterwards with Receive stock.</p>
      <div className="card">
        <ProductForm action={createProductAction} suppliers={suppliers} />
      </div>
    </>
  );
}
