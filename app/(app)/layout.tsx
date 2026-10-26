import Link from "next/link";
import { requireBusiness } from "@/lib/auth/guards";
import { NavTabs } from "@/components/NavTabs";
import { ProfileMenu } from "@/components/ProfileMenu";

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
        <ProfileMenu
          name={user.isDemo ? "Lerato" : business.name}
          email={user.isDemo ? "Demo account" : user.email}
          roleLabel={user.isDemo ? "Demo · business owner" : "Business owner"}
          view="owner"
          canSwitch={user.isDemo}
          isOwner
        />
      </header>
      <NavTabs />
      {children}
    </div>
  );
}
