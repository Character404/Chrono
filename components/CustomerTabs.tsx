"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/shop", label: "Businesses", icon: <path d="M4 10.5 6 5h12l2 5.5M4 10.5h16v8.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM9.5 20v-5h5v5" /> },
  { href: "/shop/orders", label: "My orders", icon: <path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1zM9 9h6M9 13h6" /> },
];

export function CustomerTabs() {
  const path = usePathname() ?? "";
  return (
    <nav className="tabs tabs-two" aria-label="Main">
      {TABS.map((t) => {
        const active = t.href === "/shop" ? path === "/shop" || (path.startsWith("/shop/") && !path.startsWith("/shop/orders")) : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>
            <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {t.icon}
            </svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
