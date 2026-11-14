import Link from "next/link";
import { logoutAction, switchBranchAction } from "@/app/actions";
import { BranchPicker, Nav } from "@/components/Nav";
import { can, ROLE_LABELS, trialDaysLeft } from "@/lib/domain";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { requireContext } from "@/lib/session";
import { savedTheme } from "@/lib/theme";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const theme = await savedTheme();
  const role = ctx.user.role;
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/inventory", label: "Inventory" },
    ...(can(role, "stock.receive") ? [{ href: "/receive", label: "In (+)" }] : []),
    ...(can(role, "stock.out") ? [{ href: "/stock-out", label: "Out (−)" }] : []),
    { href: "/shipments", label: "Shipments" },
    ...(can(role, "patients") ? [{ href: "/patients", label: "Patients" }, { href: "/prescriptions", label: "Prescriptions" }] : []),
    { href: "/reports", label: "Reports" },
    { href: "/assistant", label: "Ask AI" },
    { href: "/settings", label: "Settings" },
  ];
  const trialing = ctx.pharmacy.subscription_status === "trialing";
  const daysLeft = trialDaysLeft(new Date(ctx.pharmacy.trial_ends_at));

  return (
    <>
      <header className="topbar">
        <Link href="/dashboard" className="logo">SortMed</Link>
        <Nav links={links} />
        <div className="who">
          <ThemeSwitch initial={theme} />
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
