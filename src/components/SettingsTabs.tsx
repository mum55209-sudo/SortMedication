import Link from "next/link";

const TABS = [
  { href: "/settings", label: "Pharmacy" },
  { href: "/settings/branches", label: "Branches" },
  { href: "/settings/staff", label: "Staff" },
  { href: "/settings/suppliers", label: "Suppliers" },
  { href: "/settings/billing", label: "Subscription" },
  { href: "/settings/account", label: "My account" },
];

export function SettingsTabs({ current }: { current: string }) {
  return (
    <>
      <h1>Settings</h1>
      <div className="tabs" style={{ marginTop: 12 }}>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={t.href === current ? "active" : ""}>{t.label}</Link>
        ))}
      </div>
    </>
  );
}
