"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "Home" },
  { href: "/orders/new", label: "New order" },
  { href: "/customers", label: "Customers" },
  { href: "/commitments", label: "Payments" },
];

export function NavTabs() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Main">
      {TABS.map((t) => {
        const active = t.href === "/orders/new" ? path === t.href : path === t.href || (path?.startsWith(`${t.href}/`) ?? false);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
