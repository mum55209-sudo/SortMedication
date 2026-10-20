import Link from "next/link";
import { logoutAction, switchBranchAction } from "@/app/actions";
import { BranchPicker, Nav } from "@/components/Nav";
import { can, ROLE_LABELS, trialDaysLeft } from "@/lib/domain";
import { requireContext } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const role = ctx.user.role;
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/inventory", label: "Inventory" },
    ...(can(role, "stock.receive") ? [{ href: "/receive", label: "Receive stock" }] : []),
    ...(can(role, "stock.out") ? [{ href: "/stock-out", label: "Stock out" }] : []),
    { href: "/reports", label: "Reports" },
    { href: "/settings", label: "Settings" },
  ];
  const trialing = ctx.pharmacy.subscription_status === "trialing";
  const daysLeft = trialDaysLeft(new Date(ctx.pharmacy.trial_ends_at));

  return (
    <>
      <header className="topbar">
        <Link href="/dashboard" className="logo">SortMedication</Link>
        <Nav links={links} />
        <div className="who">
          <BranchPicker branches={ctx.branches} current={ctx.branch.id} action={switchBranchAction} />
          <Link href="/settings/account" title="My account">{ctx.user.name} · {ROLE_LABELS[role]}</Link>
          <form action={logoutAction}>
            <button type="submit" className="link">Log out</button>
          </form>
        </div>
      </header>
      {!ctx.writable && (
        <div className="banner locked">
          Your free trial has ended, so {ctx.pharmacy.name} is read-only. You can still view and export everything.{" "}
          <Link href="/settings/billing">Start your subscription</Link> to keep editing.
        </div>
      )}
      {ctx.writable && trialing && (
        <div className="banner trial">
          Free trial: {daysLeft} {daysLeft === 1 ? "day" : "days"} left. <Link href="/settings/billing">See plan</Link>
        </div>
      )}
      <main>{children}</main>
    </>
  );
}
