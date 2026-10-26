import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { customerDisplayName } from "@/lib/data/marketplace";
import { CustomerTabs } from "@/components/CustomerTabs";
import { ProfileMenu } from "@/components/ProfileMenu";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isCustomer = user.role === "CUSTOMER";
  return (
    <div className="shell shell-app">
      <header className="topbar">
        <Link href="/shop" className="wordmark">
          <span className="wordmark-dot" aria-hidden="true" />
          Chrono
        </Link>
        <ProfileMenu
          name={customerDisplayName(user)}
          email={user.isDemo ? "Demo customer" : user.email}
          roleLabel={user.isDemo ? "Demo · customer view" : "Customer"}
          view="customer"
          canSwitch={user.isDemo}
          isOwner={!isCustomer}
        />
      </header>
      <CustomerTabs />
      {children}
    </div>
  );
}
