import Link from "next/link";
import { requireBusiness } from "@/lib/auth/guards";
import { logout } from "@/app/actions/auth";
import { NavTabs } from "@/components/NavTabs";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireBusiness();
  return (
    <div className="shell shell-app">
      <header className="topbar">
        <Link href="/home" className="wordmark">
          <span className="wordmark-dot" aria-hidden="true" />
          Chrono
        </Link>
        <form action={logout}>
          <SubmitButton className="linkish" pendingLabel="Logging out…">Log out</SubmitButton>
        </form>
      </header>
      <NavTabs />
      {user.isDemo && (
        <p className="demo-flag">
          <span className="live-dot" aria-hidden="true" />
          Demo: {business.name}. Made-up data that refreshes each day.
        </p>
      )}
      {children}
    </div>
  );
}
