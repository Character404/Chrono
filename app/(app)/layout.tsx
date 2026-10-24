import Link from "next/link";
import { requireBusiness } from "@/lib/auth/guards";
import { logout } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireBusiness();
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/home" className="wordmark">
          <span className="wordmark-dot" aria-hidden="true" />
          Chrono
        </Link>
        <form action={logout}>
          <button className="linkish" type="submit">
            Log out
          </button>
        </form>
      </header>
      <nav className="tabs" aria-label="Main">
        <Link href="/home">Home</Link>
        <Link href="/orders/new">New order</Link>
        <Link href="/commitments">Payments</Link>
      </nav>
      {user.isDemo && (
        <p className="demo-flag">
          You&apos;re exploring the demo: {business.name}. Everything here is made-up data and refreshes each day.
        </p>
      )}
      {children}
    </div>
  );
}
