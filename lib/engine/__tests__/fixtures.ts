import { addDays } from "../dates";
import { rand } from "../money";
import type { CommitmentInput, ForecastInput, OrderInput } from "../types";

/** Day 0 for every test. A Monday, away from month-end so payday logic stays quiet. */
export const TODAY = "2026-11-09";
export const day = (n: number) => addDays(TODAY, n);

/** Base order from SPEC.md: R5 000, R1 000 deposit day 0, R4 000 balance day 7, R3 200 ingredients day 1. */
export function baseOrder(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    id: "wedding",
    customerId: "thabo",
    title: "Wedding catering",
    valueCents: rand(5000),
    status: "DRAFT",
    payments: [
      { id: "dep", kind: "DEPOSIT", amountCents: rand(1000), expectedDate: day(0), dateCertainty: "CONFIRMED" },
      { id: "bal", kind: "BALANCE", amountCents: rand(4000), expectedDate: day(7), dateCertainty: "ESTIMATED" },
    ],
    costs: [{ id: "ing", description: "Ingredients", category: "INGREDIENTS", estimatedCents: rand(3200), dueDate: day(1), dateCertainty: "CONFIRMED" }],
    ...overrides,
  };
}

export function makeInput(opts: {
  openingRands: number;
  bufferRands?: number;
  proposed?: OrderInput | null;
  orders?: OrderInput[];
  commitments?: CommitmentInput[];
}): ForecastInput {
  return {
    today: TODAY,
    business: { openingCashCents: rand(opts.openingRands), openingCashDate: TODAY, safetyBufferCents: rand(opts.bufferRands ?? 0) },
    commitments: opts.commitments ?? [],
    orders: opts.orders ?? [],
    proposedOrder: opts.proposed === undefined ? baseOrder() : opts.proposed,
    customerNames: { thabo: "Thabo" },
  };
}

export function rent(amountRands: number, date: string, recurrence: CommitmentInput["recurrence"] = "NONE"): CommitmentInput {
  return { id: `rent-${date}`, description: "Rent", direction: "OUT", amountCents: rand(amountRands), startDate: date, recurrence, active: true };
}
