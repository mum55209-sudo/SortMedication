"use server";

// Everything a form can ask the server to do. Each action checks who is
// logged in, does the work, and either sends the browser to the next page or
// returns an error message for the form to show.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addBranch,
  addStaff,
  changeOwnPassword,
  createPharmacyAccount,
  renameBranch,
  resetStaffPassword,
  setSessionBranch,
  updatePharmacy,
  updateStaff,
  verifyLogin,
} from "@/lib/accounts";
import { parseCsv } from "@/lib/csv";
import { can, type MovementType } from "@/lib/domain";
import { toActionError, UserError, type ActionResult } from "@/lib/errors";
import { endSession, requireContext, sessionToken, startSession } from "@/lib/session";
import {
  createProduct,
  importProducts,
  parseProductInput,
  receiveStock,
  saveSupplier,
  setProductArchived,
  stockOut,
  updateProduct,
} from "@/lib/stock";

function text(fd: FormData, name: string): string {
  const value = fd.get(name);
  return typeof value === "string" ? value : "";
}

function fields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

function wholeNumber(value: string): number {
  return value.trim() === "" ? NaN : Number(value);
}

function requireOwner(role: string) {
  if (role !== "owner") throw new UserError("Only the pharmacy owner can change this.");
}

// ---------- Sign up, log in, log out ----------

export async function signupAction(fd: FormData): Promise<ActionResult> {
  try {
    if (text(fd, "agree") !== "yes") throw new UserError("Please confirm you won't store patient details.");
    const { userId } = await createPharmacyAccount({
      pharmacyName: text(fd, "pharmacyName"),
      ownerName: text(fd, "ownerName"),
      email: text(fd, "email"),
      password: text(fd, "password"),
    });
    await startSession(userId);
  } catch (err) {
    return toActionError(err);
  }
  redirect("/dashboard?welcome=1");
}

export async function loginAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await verifyLogin(text(fd, "email"), text(fd, "password"));
    await startSession(user.id);
  } catch (err) {
    return toActionError(err);
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function switchBranchAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  const token = await sessionToken();
  try {
    await setSessionBranch(token!, ctx, text(fd, "branchId"));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ---------- Products ----------

export async function createProductAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  let id: string;
  try {
    id = await createProduct(ctx, parseProductInput(fields(fd)));
  } catch (err) {
    return toActionError(err);
  }
  redirect(text(fd, "next") === "receive" ? `/receive?product=${id}` : `/products/${id}`);
}

export async function updateProductAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  const id = text(fd, "id");
  try {
    await updateProduct(ctx, id, parseProductInput(fields(fd)));
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/products/${id}`);
}

export async function archiveProductAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  const id = text(fd, "id");
  try {
    await setProductArchived(ctx, id, text(fd, "archived") === "true");
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath(`/products/${id}`);
}

// ---------- Stock ----------

export async function receiveAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  const productId = text(fd, "productId");
  try {
    const amount = wholeNumber(text(fd, "quantity"));
    const packSize = Number(text(fd, "packSize")) || 1;
    const units = text(fd, "unit") === "packs" ? amount * packSize : amount;
    await receiveStock(ctx, {
      productId,
      lotNumber: text(fd, "lotNumber"),
      expiryDate: text(fd, "expiryDate"),
      receivedDate: text(fd, "receivedDate"),
      quantity: units,
      supplierId: text(fd, "supplierId") || null,
      invoice: text(fd, "invoice"),
      note: text(fd, "note"),
    });
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/products/${productId}?done=received`);
}

export async function stockOutAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  const productId = text(fd, "productId");
  try {
    const type = text(fd, "type") as MovementType;
    const amount = wholeNumber(text(fd, "quantity"));
    const packSize = Number(text(fd, "packSize")) || 1;
    if (text(fd, "deaSchedule") === "II" && (type === "adjusted" || type === "expired_destroyed") && text(fd, "confirmCii") !== "yes") {
      throw new UserError("This is a Schedule II product. Tick the box to confirm the change has been checked by a pharmacist.");
    }
    await stockOut(ctx, {
      productId,
      batchId: text(fd, "batchId"),
      type,
      quantity: text(fd, "unit") === "packs" ? amount * packSize : amount,
      reference: text(fd, "reference"),
      note: text(fd, "note"),
      targetBranchId: text(fd, "targetBranchId") || undefined,
    });
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/products/${productId}?done=updated`);
}

export async function importAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  try {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Please choose a CSV file.");
    if (file.size > 5_000_000) throw new UserError("That file is too big (over 5 MB).");
    const result = await importProducts(ctx, parseCsv(await file.text()));
    if (result.errors.length) {
      const shown = result.errors.slice(0, 10).join(" · ");
      const more = result.errors.length > 10 ? ` (and ${result.errors.length - 10} more)` : "";
      return { error: `Nothing was imported. Please fix these rows and try again: ${shown}${more}` };
    }
    revalidatePath("/inventory");
    return { message: `Imported ${result.created} new products and ${result.stocked} batches of opening stock.` };
  } catch (err) {
    return toActionError(err);
  }
}

// ---------- Settings ----------

export async function updatePharmacyAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  try {
    requireOwner(ctx.user.role);
    await updatePharmacy(ctx, {
      name: text(fd, "name"),
      license_number: text(fd, "license_number"),
      address: text(fd, "address"),
      phone: text(fd, "phone"),
      expiry_warning_days: Number(text(fd, "expiry_warning_days")),
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

export async function addBranchAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  try {
    requireOwner(ctx.user.role);
    await addBranch(ctx, text(fd, "name"), text(fd, "address"));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/", "layout");
  return { message: "Branch added." };
}

export async function renameBranchAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  try {
    requireOwner(ctx.user.role);
    await renameBranch(ctx, text(fd, "id"), text(fd, "name"), text(fd, "address"));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

export async function addStaffAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  try {
    requireOwner(ctx.user.role);
    await addStaff(ctx, { name: text(fd, "name"), email: text(fd, "email"), role: text(fd, "role"), password: text(fd, "password") });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/settings/staff");
  return { message: "Staff login created. Give them their email and temporary password." };
}

export async function updateStaffAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  try {
    requireOwner(ctx.user.role);
    await updateStaff(ctx, text(fd, "id"), { role: text(fd, "role"), active: text(fd, "active") === "yes" });
    const password = text(fd, "password");
    if (password) await resetStaffPassword(ctx, text(fd, "id"), password);
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/settings/staff");
  return { message: "Saved." };
}

export async function saveSupplierAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  try {
    await saveSupplier(ctx, text(fd, "id") || null, fields(fd));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/settings/suppliers");
  return { message: "Supplier saved." };
}

export async function changePasswordAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  try {
    if (text(fd, "next") !== text(fd, "confirm")) throw new UserError("The two new passwords don't match.");
    await changeOwnPassword(ctx, text(fd, "current"), text(fd, "next"));
  } catch (err) {
    return toActionError(err);
  }
  return { message: "Password changed." };
}

export async function startSubscriptionAction(): Promise<ActionResult> {
  const ctx = await requireContext();
  if (!can(ctx.user.role, "settings.edit")) return { error: "Only the pharmacy owner can manage the subscription." };
  // Payments are not connected yet. When Stripe is set up, this is where the
  // app will send the owner to Stripe's checkout page.
  return {
    error: "Online payment isn't switched on yet. Please contact us to start your $40/month subscription.",
  };
}
