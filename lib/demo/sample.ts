/**
 * A small, fixed sample used by the Milestone 1 home page to prove the engine
 * runs inside Next.js. The real demo account comes from the seed script later.
 */
import { addDays, rand, type ForecastInput, type OrderInput } from "@/lib/engine";

export function sampleCheck(today: string): ForecastInput {
  const d = (n: number) => addDays(today, n);
  const history: OrderInput = {
    id: "past-thabo",
    customerId: "thabo",
    title: "Past orders",
    valueCents: rand(4000),
    status: "COMPLETED",
    payments: [
      [-120, -115],
      [-90, -83],
      [-60, -54],
      [-30, -22],
    ].map(([e, r], i) => ({
      id: `h${i}`,
      kind: "BALANCE" as const,
      amountCents: rand(1000),
      expectedDate: d(e),
      dateCertainty: "ESTIMATED" as const,
      receivedDate: d(r),
      receivedAmountCents: rand(1000),
    })),
    costs: [],
  };
  const wedding: OrderInput = {
    id: "wedding",
    customerId: "thabo",
    title: "Wedding catering",
    valueCents: rand(5000),
    status: "DRAFT",
    payments: [
      { id: "dep", kind: "DEPOSIT", amountCents: rand(1000), expectedDate: d(0), dateCertainty: "CONFIRMED" },
      { id: "bal", kind: "BALANCE", amountCents: rand(4000), expectedDate: d(7), dateCertainty: "ESTIMATED" },
    ],
    costs: [{ id: "ing", description: "Ingredients", category: "INGREDIENTS", estimatedCents: rand(3200), dueDate: d(1), dateCertainty: "CONFIRMED" }],
  };
  return {
    today,
    business: { openingCashCents: rand(5000), openingCashDate: today, safetyBufferCents: 0 },
    commitments: [{ id: "rent", description: "Rent", direction: "OUT", amountCents: rand(3000), startDate: d(10), recurrence: "NONE", active: true }],
    orders: [history],
    proposedOrder: wedding,
    customerNames: { thabo: "Thabo" },
  };
}
