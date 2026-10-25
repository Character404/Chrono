"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  new: <path d="M12 5v14M5 12h14" />,
  people: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c.7-3 2.9-4.6 5.5-4.6s4.8 1.6 5.5 4.6M15.5 6.3a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.6 2 3 4.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" />
    </>
  ),
};

const TABS = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/orders/new", label: "New order", icon: "new" },
  { href: "/customers", label: "Customers", icon: "people" },
  { href: "/commitments", label: "Payments", icon: "calendar" },
];

/** Top tabs on desktop, an app-style bottom bar with icons on phones. */
export function NavTabs() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Main">
      {TABS.map((t) => {
        const active = t.href === "/orders/new" ? path === t.href : path === t.href || (path?.startsWith(`${t.href}/`) ?? false) || (t.href === "/home" && (path?.startsWith("/orders/") ?? false) && path !== "/orders/new");
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>
            <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[t.icon]}
            </svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
