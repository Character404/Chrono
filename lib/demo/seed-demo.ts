/**
 * Writes demo businesses to the database.
 * - createPrivateDemo: every "Try the demo" gets its own private copy, deleted after 24 hours,
 *   so one visitor's clicks can never change what the next visitor sees.
 * - seedDemo: the shared demo@chrono.app record used by `npm run db:seed`.
 */
import { randomBytes } from "node:crypto";
import { hashPassword } from "../auth/password";
import { isoToDate } from "../data/convert";
import type { Db } from "../data/repo";
import type { ISODate } from "../engine/dates";
import { buildDemoData, DEMO_EMAIL, DEMO_PASSWORD, prefixDemoData, type DemoData } from "./demo-data";

export const VISITOR_DOMAIN = "@visitors.chrono.app";
const PRIVATE_DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;

async function writeDemo(tx: Db, account: { email: string; passwordHash: string }, data: DemoData) {
  const user = await tx.user.create({
    data: {
      email: account.email,
      passwordHash: account.passwordHash,
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

  // A handful of bulk inserts instead of one query per order keeps "Try the demo" fast.
  await tx.customer.createMany({ data: data.customers.map((c) => ({ id: c.id, businessId, name: c.name, phone: c.phone ?? null })) });
  await tx.order.createMany({
    data: data.orders.map((o) => ({
      id: o.id,
      businessId,
      customerId: o.customerId,
      title: o.title,
      valueCents: o.valueCents,
      status: o.status,
      decidedAt: o.status === "DRAFT" ? null : new Date(),
    })),
  });
  await tx.orderPayment.createMany({
    data: data.orders.flatMap((o) =>
      o.payments.map((p) => ({
        orderId: o.id,
        kind: p.kind,
        amountCents: p.amountCents,
        expectedDate: isoToDate(p.expectedDate),
        dateCertainty: p.dateCertainty,
        receivedDate: isoToDate(p.receivedDate ?? null),
        receivedAmountCents: p.receivedAmountCents ?? null,
      })),
    ),
  });
  await tx.orderCost.createMany({
    data: data.orders.flatMap((o) =>
      o.costs.map((c) => ({
        orderId: o.id,
        description: c.description,
        category: c.category,
        estimatedCents: c.estimatedCents,
        dueDate: isoToDate(c.dueDate),
        dateCertainty: c.dateCertainty,
        paidDate: isoToDate(c.paidDate ?? null),
        paidCents: c.paidCents ?? null,
      })),
    ),
  });
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
}

/** A fresh, private copy of the demo for one visitor. Also removes copies older than 24 hours. */
export async function createPrivateDemo(db: Db, today: ISODate) {
  await db.user.deleteMany({
    where: { isDemo: true, email: { endsWith: VISITOR_DOMAIN }, createdAt: { lt: new Date(Date.now() - PRIVATE_DEMO_LIFETIME_MS) } },
  });
  const tag = randomBytes(6).toString("hex");
  const data = prefixDemoData(buildDemoData(today), `${tag}_`);
  // Nobody can log in to a private copy with a password: only the session from "Try the demo".
  const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
  return db.$transaction((tx: Db) => writeDemo(tx, { email: `visitor-${tag}${VISITOR_DOMAIN}`, passwordHash }, data), { timeout: 30_000, maxWait: 10_000 });
}

/** The shared demo record, refreshed by `npm run db:seed`. */
export async function seedDemo(db: Db, today: ISODate) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return db.$transaction(
    async (tx: Db) => {
      await tx.user.deleteMany({ where: { email: DEMO_EMAIL } });
      return writeDemo(tx, { email: DEMO_EMAIL, passwordHash }, buildDemoData(today));
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}
