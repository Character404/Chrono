import "server-only";
import { prisma } from "@/lib/db";
import { DEMO_EMAIL, DEMO_IDS } from "@/lib/demo/demo-data";

interface AccountLike {
  id: string;
  email: string;
  name: string | null;
  isDemo: boolean;
}

/**
 * The business behind "Lerato's Kitchen" for this person. Demo visitors order from their own
 * private demo copy (so they can switch over and see the order arrive). Real customer accounts
 * order from the shared demo business.
 */
export async function orderableBusiness(user: AccountLike) {
  if (user.isDemo) return prisma.business.findUnique({ where: { userId: user.id } });
  const shared = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, include: { business: true } });
  return shared?.business ?? null;
}

/** In the demo, the customer view is Sipho, a registered customer whose payment history Chrono knows. */
export function customerDisplayName(user: AccountLike): string {
  if (user.isDemo) return "Sipho Ndlovu";
  return user.name?.trim() || user.email.split("@")[0];
}

/** The business's existing record for this customer, if any (never creates one). */
export async function findCustomerRecord(user: AccountLike, businessId: string) {
  if (user.isDemo) {
    return prisma.customer.findFirst({ where: { businessId, OR: [{ id: DEMO_IDS.sipho }, { id: { endsWith: `_${DEMO_IDS.sipho}` } }] } });
  }
  return prisma.customer.findFirst({ where: { businessId, name: customerDisplayName(user) } });
}

/** The business's record for this customer, created the first time they order. */
export async function customerRecordFor(user: AccountLike, businessId: string) {
  const existing = await findCustomerRecord(user, businessId);
  return existing ?? prisma.customer.create({ data: { businessId, name: customerDisplayName(user) } });
}
