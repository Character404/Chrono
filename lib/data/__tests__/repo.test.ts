import { describe, expect, it } from "vitest";
import { createRepo, NotFoundError } from "../repo";
import { createFakeDb } from "./fake-db";
import type { OrderInput } from "../../engine/types";

function order(customerId: string): OrderInput {
  return {
    id: "new",
    customerId,
    title: "Wedding catering",
    valueCents: 500000,
    status: "DRAFT",
    payments: [
      { id: "d", kind: "DEPOSIT", amountCents: 100000, expectedDate: "2026-11-09", dateCertainty: "CONFIRMED" },
      { id: "b", kind: "BALANCE", amountCents: 400000, expectedDate: "2026-11-16", dateCertainty: "ESTIMATED" },
    ],
    costs: [{ id: "c", description: "Ingredients", category: "INGREDIENTS", estimatedCents: 320000, dueDate: "2026-11-10", dateCertainty: "CONFIRMED" }],
  };
}

async function twoBusinesses() {
  const db = createFakeDb();
  const repo = createRepo(db);
  const alice = await repo.createCustomer("biz-A", "Thabo");
  const bob = await repo.createCustomer("biz-B", "Naledi");
  const aOrder = await repo.createOrder("biz-A", order(alice.id));
  const bOrder = await repo.createOrder("biz-B", order(bob.id));
  const aCommit = await repo.createCommitment("biz-A", { description: "Rent", direction: "OUT", amountCents: 250000, startDate: "2026-11-01", recurrence: "MONTHLY" });
  const bCommit = await repo.createCommitment("biz-B", { description: "Rent", direction: "OUT", amountCents: 250000, startDate: "2026-11-01", recurrence: "MONTHLY" });
  return { db, repo, alice, bob, aOrder, bOrder, aCommit, bCommit };
}

describe("Authorisation: one business can never reach another business's data", () => {
  it("cannot read another business's order, even with its id", async () => {
    const { repo, bOrder, aOrder } = await twoBusinesses();
    expect(await repo.getOrder("biz-A", bOrder.id)).toBeNull();
    expect((await repo.getOrder("biz-A", aOrder.id))?.id).toBe(aOrder.id);
  });

  it("only lists its own orders, customers and commitments", async () => {
    const { repo } = await twoBusinesses();
    expect(await repo.listOrders("biz-A")).toHaveLength(1);
    expect((await repo.listCustomers("biz-A")).map((c) => c.name)).toEqual(["Thabo"]);
    expect(await repo.listCommitments("biz-A")).toHaveLength(1);
  });

  it("cannot accept or decline another business's order", async () => {
    const { repo, db, bOrder } = await twoBusinesses();
    expect(await repo.setOrderStatus("biz-A", bOrder.id, "ACCEPTED")).toBe(false);
    expect(db.store.order.find((o: any) => o.id === bOrder.id).status).toBe("DRAFT");
  });

  it("cannot delete another business's commitment", async () => {
    const { repo, db, bCommit, aCommit } = await twoBusinesses();
    expect(await repo.deleteCommitment("biz-A", bCommit.id)).toBe(false);
    expect(db.store.commitment).toHaveLength(2);
    expect(await repo.deleteCommitment("biz-A", aCommit.id)).toBe(true);
    expect(db.store.commitment).toHaveLength(1);
  });

  it("cannot create an order for another business's customer", async () => {
    const { repo, bob } = await twoBusinesses();
    let error: unknown = null;
    try {
      await repo.createOrder("biz-A", order(bob.id));
    } catch (e) {
      error = e;
    }
    expect(error instanceof NotFoundError).toBe(true);
  });

  it("cannot read another business's customer", async () => {
    const { repo, bob } = await twoBusinesses();
    expect(await repo.getCustomer("biz-A", bob.id)).toBeNull();
  });
});

describe("Saving orders", () => {
  it("stores payments and costs with date-only values and reads them back for the engine", async () => {
    const { repo, aOrder } = await twoBusinesses();
    const row = (await repo.getOrder("biz-A", aOrder.id))!;
    expect(row.payments).toHaveLength(2);
    expect(row.costs[0].dueDate!.toISOString().slice(0, 10)).toBe("2026-11-10");
  });
});
