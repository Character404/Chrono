/**
 * Recommended minimum deposit (SPEC.md, engine rule 9).
 * Finds the smallest deposit, rounded up to R50, that keeps the minimum
 * balance at or above the safety buffer, keeping the order total the same.
 */
import { forecast } from "./forecast";
import type { ISODate } from "./dates";
import type { Cents } from "./money";
import type { ForecastInput, OrderInput, PaymentInput } from "./types";

export const DEPOSIT_STEP_CENTS: Cents = 5_000; // R50

export type DepositStatus = "ALREADY_ENOUGH" | "INCREASE" | "CANNOT_FIX";

export interface DepositRecommendation {
  status: DepositStatus;
  currentDepositCents: Cents;
  /** Smallest deposit that works (null when no deposit can fix the gap). */
  recommendedCents: Cents | null;
}

export function currentDeposit(order: OrderInput): Cents {
  return order.payments.filter((p) => p.kind === "DEPOSIT").reduce((s, p) => s + p.amountCents, 0);
}

/**
 * Returns a copy of the order with the deposit set to `depositCents`.
 * The difference comes off (or goes onto) the latest non-deposit payments,
 * so the order total never changes. Never mutates the input.
 */
export function withDeposit(order: OrderInput, depositCents: Cents, today: ISODate): OrderInput {
  const value = order.valueCents;
  const deposit = Math.max(0, Math.min(depositCents, value));
  const existingDeposit = order.payments.find((p) => p.kind === "DEPOSIT");

  const depositPayment: PaymentInput = existingDeposit
    ? { ...existingDeposit, amountCents: deposit }
    : { id: `${order.id}-deposit`, kind: "DEPOSIT", amountCents: deposit, expectedDate: today, dateCertainty: "CONFIRMED" };

  // Non-deposit payments, latest first, so changes hit the last payment first.
  const others = order.payments
    .filter((p) => p.kind !== "DEPOSIT")
    .map((p) => ({ ...p }))
    .sort((a, b) => (b.expectedDate ?? "9999-12-31").localeCompare(a.expectedDate ?? "9999-12-31"));

  const remainingForOthers = value - deposit;
  const othersTotal = others.reduce((s, p) => s + p.amountCents, 0);
  let delta = remainingForOthers - othersTotal; // >0: others need more; <0: others need less

  if (others.length === 0 && remainingForOthers > 0) {
    others.push({ id: `${order.id}-balance`, kind: "BALANCE", amountCents: remainingForOthers, expectedDate: null, dateCertainty: "UNKNOWN" });
    delta = 0;
  } else if (delta > 0) {
    others[0].amountCents += delta;
  } else {
    for (const p of others) {
      if (delta === 0) break;
      const take = Math.min(p.amountCents, -delta);
      p.amountCents -= take;
      delta += take;
    }
  }

  const payments = [depositPayment, ...others.filter((p) => p.amountCents > 0)].sort((a, b) =>
    (a.expectedDate ?? "9999-12-31").localeCompare(b.expectedDate ?? "9999-12-31"),
  );
  return { ...order, payments };
}

export interface RecommendOptions {
  /** Applied to the input before each forecast, e.g. the prediction layer. */
  transform?: (input: ForecastInput) => ForecastInput;
}

export function recommendDeposit(input: ForecastInput, options: RecommendOptions = {}): DepositRecommendation {
  const order = input.proposedOrder;
  if (!order) throw new Error("recommendDeposit needs a proposed order");
  const transform = options.transform ?? ((i: ForecastInput) => i);
  const buffer = input.business.safetyBufferCents;
  const current = currentDeposit(order);

  const works = (deposit: Cents): boolean => {
    const candidate = withDeposit(order, deposit, input.today);
    return forecast(transform({ ...input, proposedOrder: candidate })).minBalanceCents >= buffer;
  };

  const maxSteps = Math.ceil(order.valueCents / DEPOSIT_STEP_CENTS);
  const amountFor = (step: number): Cents => Math.min(step * DEPOSIT_STEP_CENTS, order.valueCents);

  if (!works(order.valueCents)) {
    return { status: "CANNOT_FIX", currentDepositCents: current, recommendedCents: null };
  }

  // Binary search for the smallest working step. A bigger deposit only moves
  // money earlier, so "works" is monotonic in the deposit amount.
  let lo = 0;
  let hi = maxSteps;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (works(amountFor(mid))) hi = mid;
    else lo = mid + 1;
  }
  const recommended = amountFor(lo);

  return {
    status: recommended <= current ? "ALREADY_ENOUGH" : "INCREASE",
    currentDepositCents: current,
    recommendedCents: recommended,
  };
}
