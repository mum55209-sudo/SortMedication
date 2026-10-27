"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={path === l.href || path.startsWith(l.href + "/") ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

// Changing the branch drop-down submits its form straight away.
export function BranchPicker({
  branches,
  current,
  action,
}: {
  branches: { id: string; name: string }[];
  current: string;
  action: (fd: FormData) => Promise<unknown>;
}) {
  if (branches.length < 2) return <span>{branches[0]?.name}</span>;
  return (
    <form action={action as (fd: FormData) => Promise<void>}>
      <select
        name="branchId"
        defaultValue={current}
        aria-label="Branch"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </form>
  );
}
