import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { todayInJohannesburg } from "@/lib/engine";
import { OrderWizard } from "./OrderWizard";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const { business } = await requireBusiness();
  const ctx = await createRepo(prisma).loadContext(business, todayInJohannesburg());
  return (
    <main className="page-narrow" data-tour="new-order">
      <h1 className="h1">Check a new order</h1>
      <OrderWizard ctx={ctx} />
    </main>
  );
}
