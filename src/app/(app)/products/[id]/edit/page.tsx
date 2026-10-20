import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProductAction } from "@/app/actions";
import { ProductForm } from "@/components/ProductForm";
import { requirePage } from "@/lib/session";
import { getProduct, listSuppliers, productLabel } from "@/lib/stock";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("products.edit");
  const { id } = await params;
  const product = await getProduct(ctx, id).catch(() => notFound());
  const suppliers = await listSuppliers(ctx);
  return (
    <>
      <p><Link href={`/products/${id}`}>← {productLabel(product)}</Link></p>
      <h1>Edit product</h1>
      <p className="subtitle">Changes are recorded in the activity log. Stock levels are changed with Receive stock or Stock out, not here.</p>
      <div className="card">
        <ProductForm action={updateProductAction} product={product} suppliers={suppliers} />
      </div>
    </>
  );
}
