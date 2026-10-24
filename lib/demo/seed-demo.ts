/**
 * Writes the demo business to the database. Used by `npm run db:seed` and by the
 * "Try the demo" button, which refreshes the demo once per day so its dates
 * always look current.
 */
import { hashPassword } from "../auth/password";
import { dateToISO, isoToDate } from "../data/convert";
import type { Db } from "../data/repo";
import type { ISODate } from "../engine/dates";
import { buildDemoData, DEMO_EMAIL, DEMO_PASSWORD } from "./demo-data";

export async function seedDemo(db: Db, today: ISODate) {
  const data = buildDemoData(today);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  return db.$transaction(
    async (tx: Db) => {
      // Deleting the user cascades to sessions, business, customers, orders and commitments.
      await tx.user.deleteMany({ where: { email: DEMO_EMAIL } });

      const user = await tx.user.create({
        data: {
          email: DEMO_EMAIL,
          passwordHash,
          isDemo: true,
          business: {
            create: {
              name: data.business.name,
              type: data.business.type,
              openingCashCents: data.business.openingCashCents,
              openingCashDate: isoToDate(data.business.openingCashDate),
              safetyBufferCents: data.business.safetyBufferCents,
              paydayWindowStart: data.business.paydayWindowStart ?? 25,
            },
          },
        },
        include: { business: true },
      });
      const businessId: string = user.business.id;

      await tx.customer.createMany({
        data: data.customers.map((c) => ({ id: c.id, businessId, name: c.name, phone: c.phone ?? null })),
      });

      for (const o of data.orders) {
        await tx.order.create({
          data: {
            id: o.id,
            businessId,
            customerId: o.customerId,
            title: o.title,
            valueCents: o.valueCents,
            status: o.status,
            decidedAt: o.status === "DRAFT" ? null : new Date(),
            payments: {
              create: o.payments.map((p) => ({
                kind: p.kind,
                amountCents: p.amountCents,
                expectedDate: isoToDate(p.expectedDate),
                dateCertainty: p.dateCertainty,
                receivedDate: isoToDate(p.receivedDate ?? null),
                receivedAmountCents: p.receivedAmountCents ?? null,
              })),
            },
            costs: {
              create: o.costs.map((c) => ({
                description: c.description,
                category: c.category,
                estimatedCents: c.estimatedCents,
                dueDate: isoToDate(c.dueDate),
                dateCertainty: c.dateCertainty,
                paidDate: isoToDate(c.paidDate ?? null),
                paidCents: c.paidCents ?? null,
              })),
            },
          },
        });
      }

      await tx.commitment.createMany({
        data: data.commitments.map((c) => ({
          id: c.id,
          businessId,
          description: c.description,
          direction: c.direction,
          amountCents: c.amountCents,
          startDate: isoToDate(c.startDate),
          recurrence: c.recurrence,
          endDate: isoToDate(c.endDate ?? null),
          active: c.active,
        })),
      });

      return user;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}

/** Returns the demo user, re-creating the demo data if it was built on an earlier day. */
export async function ensureDemoUser(db: Db, today: ISODate) {
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL }, include: { business: true } });
  if (existing?.business && dateToISO(existing.business.openingCashDate) === today) return existing;
  try {
    return await seedDemo(db, today);
  } catch (error) {
    // Two people pressed "Try the demo" at the same moment: use the one that won.
    const winner = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (winner) return winner;
    throw error;
  }
}
