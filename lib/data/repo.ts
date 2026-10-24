/**
 * Data access, always scoped to one business.
 *
 * Security rule (SPEC.md): every query includes the signed-in user's businessId,
 * so one user can never read or change another user's data, even with a guessed id.
 * Pages and server actions must use these functions rather than querying directly.
 */
import type { ISODate } from "../engine/dates";
import type { CommitmentInput, ForecastInput, OrderInput, OrderStatus } from "../engine/types";
import { businessRowToInput, commitmentRowToInput, isoToDate, orderRowToInput, type BusinessRow, type CommitmentRow, type OrderRow } from "./convert";

/** The Prisma client, or a test double with the same methods. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = any;

const ORDER_INCLUDE = { payments: true, costs: true, customer: true } as const;

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
}

export function createRepo(db: Db) {
  return {
    // --- Customers ---------------------------------------------------------
    async listCustomers(businessId: string): Promise<CustomerRow[]> {
      return db.customer.findMany({ where: { businessId }, orderBy: { name: "asc" } });
    },

    async getCustomer(businessId: string, customerId: string): Promise<CustomerRow | null> {
      return db.customer.findFirst({ where: { id: customerId, businessId } });
    },

    async createCustomer(businessId: string, name: string, phone?: string | null): Promise<CustomerRow> {
      return db.customer.create({ data: { businessId, name: name.trim(), phone: phone?.trim() || null } });
    },

    // --- Orders ------------------------------------------------------------
    async listOrders(businessId: string): Promise<OrderRow[]> {
      return db.order.findMany({ where: { businessId }, include: ORDER_INCLUDE, orderBy: { createdAt: "desc" } });
    },

    async getOrder(businessId: string, orderId: string): Promise<OrderRow | null> {
      return db.order.findFirst({ where: { id: orderId, businessId }, include: ORDER_INCLUDE });
    },

    /** Saves a new order. The customer must belong to the same business. */
    async createOrder(businessId: string, order: OrderInput): Promise<{ id: string }> {
      const customer = await db.customer.findFirst({ where: { id: order.customerId, businessId } });
      if (!customer) throw new NotFoundError("Customer");
      const created = await db.order.create({
        data: {
          businessId,
          customerId: order.customerId,
          title: order.title,
          valueCents: order.valueCents,
          status: order.status,
          payments: {
            create: order.payments.map((p) => ({
              kind: p.kind,
              amountCents: p.amountCents,
              expectedDate: isoToDate(p.expectedDate),
              dateCertainty: p.dateCertainty,
              receivedDate: isoToDate(p.receivedDate ?? null),
              receivedAmountCents: p.receivedAmountCents ?? null,
            })),
          },
          costs: {
            create: order.costs.map((c) => ({
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
      return { id: created.id };
    },

    /** Returns false when the order doesn't exist in this business. */
    async setOrderStatus(businessId: string, orderId: string, status: OrderStatus): Promise<boolean> {
      const result = await db.order.updateMany({ where: { id: orderId, businessId }, data: { status, decidedAt: new Date() } });
      return result.count === 1;
    },

    // --- Commitments -------------------------------------------------------
    async listCommitments(businessId: string): Promise<CommitmentRow[]> {
      return db.commitment.findMany({ where: { businessId }, orderBy: { startDate: "asc" } });
    },

    async createCommitment(businessId: string, c: Omit<CommitmentInput, "id" | "active">): Promise<{ id: string }> {
      const created = await db.commitment.create({
        data: {
          businessId,
          description: c.description.trim(),
          direction: c.direction,
          amountCents: c.amountCents,
          startDate: isoToDate(c.startDate),
          recurrence: c.recurrence,
          endDate: isoToDate(c.endDate ?? null),
          active: true,
        },
      });
      return { id: created.id };
    },

    /** Returns false when the commitment doesn't exist in this business. */
    async deleteCommitment(businessId: string, commitmentId: string): Promise<boolean> {
      const result = await db.commitment.deleteMany({ where: { id: commitmentId, businessId } });
      return result.count === 1;
    },

    // --- Forecast context ----------------------------------------------------
    /** Everything the engine needs for this business, minus the proposed order. */
    async loadContext(business: BusinessRow, today: ISODate): Promise<BusinessContext> {
      const [orders, commitments, customers] = await Promise.all([
        this.listOrders(business.id),
        this.listCommitments(business.id),
        this.listCustomers(business.id),
      ]);
      return {
        today,
        business: businessRowToInput(business),
        commitments: commitments.map(commitmentRowToInput),
        orders: orders.map(orderRowToInput),
        customers: customers.map((c) => ({ id: c.id, name: c.name })),
        orderMeta: Object.fromEntries(orders.map((o) => [o.id, { createdAt: o.createdAt.toISOString(), customerName: o.customer?.name ?? "" }])),
      };
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;

export interface BusinessContext {
  today: ISODate;
  business: ForecastInput["business"];
  commitments: CommitmentInput[];
  orders: OrderInput[];
  customers: { id: string; name: string }[];
  orderMeta: Record<string, { createdAt: string; customerName: string }>;
}

/** Builds the engine input for checking `proposed` (or a plain forecast when null). */
export function forecastInputFor(ctx: BusinessContext, proposed: OrderInput | null): ForecastInput {
  return {
    today: ctx.today,
    business: ctx.business,
    commitments: ctx.commitments,
    orders: ctx.orders,
    proposedOrder: proposed,
    customerNames: Object.fromEntries(ctx.customers.map((c) => [c.id, c.name.split(" ")[0]])),
  };
}

