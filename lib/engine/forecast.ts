/**
 * Chrono forecasting engine.
 *
 * Pure and deterministic: the same input always produces the same output.
 * No database access, no clock access (today is passed in), no randomness.
 * See SPEC.md, "Forecasting engine rules".
 */
import { addDays, assertISODate, dateParts, diffDays, isISODate, makeDateClamped, maxDate, minDate, type ISODate } from "./dates";
import { isCents, type Cents } from "./money";
import type { CommitmentInput, CostInput, Direction, ForecastInput, OrderInput, PaymentInput } from "./types";

export type Verdict = "SAFE" | "TIGHT" | "SHORTFALL";

export type EventFlag = "OVERDUE" | "COST_DATE_ASSUMED_TODAY" | "PARTIAL_REMAINDER";

export interface CashEvent {
  date: ISODate;
  direction: Direction;
  amountCents: Cents;
  source: "ORDER_PAYMENT" | "ORDER_COST" | "COMMITMENT";
  /** Full label, e.g. "Ingredients: Wedding catering". */
  label: string;
  /** Short name for sentences, e.g. "Ingredients" or "the customer's balance". */
  name: string;
  refId: string;
  orderId?: string;
  isProposed: boolean;
  flags: EventFlag[];
}

export interface DayPoint {
  date: ISODate;
  inCents: Cents;
  outCents: Cents;
  /** Balance after the day's money out, before the day's money in (the low point of the day). */
  balanceAfterOutCents: Cents;
  /** Balance at the end of the day. */
  balanceEndCents: Cents;
}

export interface UncountedPayment {
  orderId: string;
  paymentId: string;
  label: string;
  amountCents: Cents;
  isProposed: boolean;
  reason: "UNKNOWN_DATE";
}

export interface Shortfall {
  /** Size of the deepest gap, as a positive number. */
  amountCents: Cents;
  firstDate: ISODate;
  /** Number of days that end with a negative balance. */
  daysBelowZero: number;
  /** Largest money-out events on or before the first shortfall date. */
  causes: CashEvent[];
}

export interface ForecastResult {
  today: ISODate;
  horizonEnd: ISODate;
  safetyBufferCents: Cents;
  startingBalanceCents: Cents;
  series: DayPoint[];
  events: CashEvent[];
  minBalanceCents: Cents;
  minBalanceDate: ISODate;
  verdict: Verdict;
  /** Profit of the proposed order (null when there is no proposed order). */
  profitCents: Cents | null;
  profitMarginPct: number | null;
  notProfitable: boolean;
  shortfall: Shortfall | null;
  uncounted: UncountedPayment[];
  assumptions: string[];
}

export class EngineValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid order: ${errors.join("; ")}`);
    this.name = "EngineValidationError";
  }
}

const MIN_HORIZON_DAYS = 30;
const TAIL_DAYS = 14;
const MAX_HORIZON_DAYS = 180;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOrder(order: OrderInput): string[] {
  const errors: string[] = [];
  if (!isCents(order.valueCents) || order.valueCents <= 0) errors.push("Order value must be more than R0.");
  if (order.payments.length === 0) errors.push("Add at least one payment (deposit or balance).");

  let total = 0;
  for (const p of order.payments) {
    if (!isCents(p.amountCents) || p.amountCents < 0) errors.push(`Payment amount must be a positive amount.`);
    if (p.expectedDate !== null && !isISODate(p.expectedDate)) errors.push(`Payment date "${p.expectedDate}" is not a valid date.`);
    if (p.receivedDate != null && !isISODate(p.receivedDate)) errors.push(`Received date "${p.receivedDate}" is not a valid date.`);
    total += p.amountCents;
  }
  if (order.payments.length > 0 && total !== order.valueCents) {
    errors.push("The payments must add up to the order value.");
  }

  for (const c of order.costs) {
    if (!isCents(c.estimatedCents) || c.estimatedCents < 0) errors.push(`Cost "${c.description}" must be a positive amount.`);
    if (c.dueDate !== null && !isISODate(c.dueDate)) errors.push(`Cost date "${c.dueDate}" is not a valid date.`);
    if (c.paidDate != null && !isISODate(c.paidDate)) errors.push(`Paid date "${c.paidDate}" is not a valid date.`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Profit
// ---------------------------------------------------------------------------

export function orderCostCents(order: OrderInput): Cents {
  return order.costs.reduce((sum, c) => sum + (c.paidDate ? c.paidCents ?? c.estimatedCents : c.estimatedCents), 0);
}

export function orderProfitCents(order: OrderInput): Cents {
  return order.valueCents - orderCostCents(order);
}

// ---------------------------------------------------------------------------
// Starting balance
// ---------------------------------------------------------------------------

function inRange(date: ISODate, from: ISODate, to: ISODate): boolean {
  return date >= from && date <= to;
}

/** Opening cash plus recorded money received, minus recorded costs paid, from openingCashDate to today. */
export function startingBalance(input: ForecastInput): Cents {
  const { business, today } = input;
  let balance = business.openingCashCents;
  for (const order of allOrders(input)) {
    for (const p of order.payments) {
      if (p.receivedDate && inRange(p.receivedDate, business.openingCashDate, today)) {
        balance += p.receivedAmountCents ?? p.amountCents;
      }
    }
    for (const c of order.costs) {
      if (c.paidDate && inRange(c.paidDate, business.openingCashDate, today)) {
        balance -= c.paidCents ?? c.estimatedCents;
      }
    }
  }
  return balance;
}

function allOrders(input: ForecastInput): OrderInput[] {
  const proposed = input.proposedOrder;
  const others = input.orders.filter((o) => !proposed || o.id !== proposed.id);
  return proposed ? [...others, proposed] : others;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function paymentName(p: PaymentInput): string {
  return p.kind === "DEPOSIT" ? "the deposit" : p.kind === "BALANCE" ? "the customer's balance" : "the next instalment";
}

function paymentLabel(p: PaymentInput, order: OrderInput): string {
  const kind = p.kind === "DEPOSIT" ? "Deposit" : p.kind === "BALANCE" ? "Balance" : "Instalment";
  return `${kind}: ${order.title}`;
}

function orderEvents(order: OrderInput, today: ISODate, isProposed: boolean): { events: CashEvent[]; uncounted: UncountedPayment[] } {
  const events: CashEvent[] = [];
  const uncounted: UncountedPayment[] = [];

  for (const p of order.payments) {
    let outstanding = p.amountCents;
    const flags: EventFlag[] = [];
    if (p.receivedDate) {
      outstanding = p.amountCents - (p.receivedAmountCents ?? p.amountCents);
      if (outstanding <= 0) continue;
      flags.push("PARTIAL_REMAINDER");
    }
    if (outstanding <= 0) continue;

    if (p.expectedDate === null || p.dateCertainty === "UNKNOWN") {
      uncounted.push({ orderId: order.id, paymentId: p.id, label: paymentLabel(p, order), amountCents: outstanding, isProposed, reason: "UNKNOWN_DATE" });
      continue;
    }
    if (p.expectedDate < today) flags.push("OVERDUE");
    events.push({
      date: maxDate(p.expectedDate, today),
      direction: "IN",
      amountCents: outstanding,
      source: "ORDER_PAYMENT",
      label: paymentLabel(p, order),
      name: paymentName(p),
      refId: p.id,
      orderId: order.id,
      isProposed,
      flags,
    });
  }

  for (const c of order.costs) {
    if (c.paidDate) continue;
    const flags: EventFlag[] = [];
    let date: ISODate;
    if (c.dueDate === null || c.dateCertainty === "UNKNOWN") {
      date = today; // worst case: assume it is due now
      flags.push("COST_DATE_ASSUMED_TODAY");
    } else {
      if (c.dueDate < today) flags.push("OVERDUE");
      date = maxDate(c.dueDate, today);
    }
    events.push({
      date,
      direction: "OUT",
      amountCents: c.estimatedCents,
      source: "ORDER_COST",
      label: `${c.description}: ${order.title}`,
      name: c.description,
      refId: c.id,
      orderId: order.id,
      isProposed,
      flags,
    });
  }

  return { events, uncounted };
}

/** Every date a commitment falls on, from `from` to `to` inclusive. */
export function commitmentDates(c: CommitmentInput, from: ISODate, to: ISODate): ISODate[] {
  if (!c.active) return [];
  const end = c.endDate ? minDate(c.endDate, to) : to;
  if (end < from) return [];
  const dates: ISODate[] = [];

  if (c.recurrence === "NONE") {
    if (inRange(c.startDate, from, end)) dates.push(c.startDate);
    return dates;
  }

  if (c.recurrence === "WEEKLY") {
    let d = c.startDate;
    if (d < from) {
      const weeks = Math.ceil(diffDays(from, d) / 7);
      d = addDays(d, weeks * 7);
    }
    for (; d <= end; d = addDays(d, 7)) dates.push(d);
    return dates;
  }

  // MONTHLY: same day of month as startDate, clamped to the month's last day.
  const { year, month, day } = dateParts(c.startDate);
  for (let i = 0; ; i++) {
    const d = makeDateClamped(year, month + i, day);
    if (d > end) break;
    if (d >= from) dates.push(d);
  }
  return dates;
}

function commitmentEvents(commitments: CommitmentInput[], from: ISODate, to: ISODate): CashEvent[] {
  const events: CashEvent[] = [];
  for (const c of commitments) {
    for (const date of commitmentDates(c, from, to)) {
      events.push({
        date,
        direction: c.direction,
        amountCents: c.amountCents,
        source: "COMMITMENT",
        label: c.description,
        name: c.description,
        refId: c.id,
        isProposed: false,
        flags: [],
      });
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

export function forecast(input: ForecastInput): ForecastResult {
  const { today, business } = input;
  assertISODate(today, "today");
  assertISODate(business.openingCashDate, "opening cash date");

  const proposed = input.proposedOrder;
  if (proposed) {
    const errors = validateOrder(proposed);
    if (errors.length) throw new EngineValidationError(errors);
  }

  // Order events: accepted orders (excluding the proposed one) plus the proposed order.
  const orderEventList: CashEvent[] = [];
  const uncounted: UncountedPayment[] = [];
  for (const order of input.orders) {
    if (order.status !== "ACCEPTED" || (proposed && order.id === proposed.id)) continue;
    const r = orderEvents(order, today, false);
    orderEventList.push(...r.events);
    uncounted.push(...r.uncounted);
  }
  let proposedLast: ISODate = today;
  if (proposed) {
    const r = orderEvents(proposed, today, true);
    orderEventList.push(...r.events);
    uncounted.push(...r.uncounted);
    for (const e of r.events) proposedLast = maxDate(proposedLast, e.date);
  }

  // Horizon
  const minEnd = addDays(today, MIN_HORIZON_DAYS);
  const cap = addDays(today, MAX_HORIZON_DAYS);
  const horizonEnd = minDate(maxDate(minEnd, proposed ? addDays(proposedLast, TAIL_DAYS) : minEnd), cap);

  const events = [...orderEventList.filter((e) => e.date <= horizonEnd), ...commitmentEvents(input.commitments, today, horizonEnd)].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.direction === b.direction ? 0 : a.direction === "OUT" ? -1 : 1),
  );

  // Daily series: money out before money in on the same day.
  const start = startingBalance(input);
  const byDate = new Map<ISODate, { in: Cents; out: Cents }>();
  for (const e of events) {
    const day = byDate.get(e.date) ?? { in: 0, out: 0 };
    if (e.direction === "IN") day.in += e.amountCents;
    else day.out += e.amountCents;
    byDate.set(e.date, day);
  }

  const series: DayPoint[] = [];
  let balance = start;
  let minBalance = start;
  let minBalanceDate = today;
  let firstShortfall: ISODate | null = start < 0 ? today : null;
  let daysBelowZero = 0;

  for (let d = today; d <= horizonEnd; d = addDays(d, 1)) {
    const day = byDate.get(d) ?? { in: 0, out: 0 };
    const afterOut = balance - day.out;
    const end = afterOut + day.in;
    series.push({ date: d, inCents: day.in, outCents: day.out, balanceAfterOutCents: afterOut, balanceEndCents: end });
    if (afterOut < minBalance) {
      minBalance = afterOut;
      minBalanceDate = d;
    }
    if (afterOut < 0 && firstShortfall === null) firstShortfall = d;
    if (end < 0) daysBelowZero++;
    balance = end;
  }

  const buffer = business.safetyBufferCents;
  const verdict: Verdict = minBalance >= buffer ? "SAFE" : minBalance >= 0 ? "TIGHT" : "SHORTFALL";

  let shortfall: Shortfall | null = null;
  if (firstShortfall !== null) {
    const cutoff = firstShortfall;
    // Money out on the day the balance first goes negative comes first, then earlier money out.
    const causes = events
      .filter((e) => e.direction === "OUT" && e.date <= cutoff)
      .sort((a, b) => (a.date === cutoff) !== (b.date === cutoff) ? (a.date === cutoff ? -1 : 1) : b.amountCents - a.amountCents)
      .slice(0, 3);
    shortfall = { amountCents: -minBalance, firstDate: firstShortfall, daysBelowZero: Math.max(daysBelowZero, 1), causes };
  }

  const profitCents = proposed ? orderProfitCents(proposed) : null;
  const profitMarginPct = proposed && profitCents !== null ? Math.round((profitCents / proposed.valueCents) * 1000) / 10 : null;

  // Assumptions, in plain language.
  const assumptions: string[] = ["Money going out on a day is counted before money coming in that day."];
  if (events.some((e) => e.flags.includes("COST_DATE_ASSUMED_TODAY"))) {
    assumptions.push("Costs without a date are counted as due today.");
  }
  if (uncounted.length) {
    assumptions.push(
      uncounted.length === 1 ? "1 payment has no date yet, so it isn't counted." : `${uncounted.length} payments have no date yet, so they aren't counted.`,
    );
  }
  if (events.some((e) => e.flags.includes("OVERDUE"))) {
    assumptions.push("Overdue amounts are counted from today.");
  }

  return {
    today,
    horizonEnd,
    safetyBufferCents: buffer,
    startingBalanceCents: start,
    series,
    events,
    minBalanceCents: minBalance,
    minBalanceDate,
    verdict,
    profitCents,
    profitMarginPct,
    notProfitable: profitCents !== null && profitCents <= 0,
    shortfall,
    uncounted,
    assumptions,
  };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/** Returns an existing cost that looks like a duplicate of `candidate`, or null. */
export function findDuplicateCost(existing: CostInput[], candidate: CostInput): CostInput | null {
  for (const c of existing) {
    if (c.id === candidate.id) continue;
    if (c.estimatedCents !== candidate.estimatedCents) continue;
    if (c.dueDate === null && candidate.dueDate === null) return c;
    if (c.dueDate !== null && candidate.dueDate !== null && Math.abs(diffDays(c.dueDate, candidate.dueDate)) <= 1) return c;
  }
  return null;
}
