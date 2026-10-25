/**
 * Turns an order analysis into a plain-language story anyone can follow:
 * what was entered, a one-line headline, a dated cash timeline and every
 * cause squeezing the business's cash (not just late payment).
 * Pure: built only from the engine's own results.
 */
import type { OrderAnalysis } from "./analyze";
import { diffDays, formatShortDate, type ISODate } from "./dates";
import type { CashEvent } from "./forecast";
import { formatRand, type Cents } from "./money";
import type { ForecastInput } from "./types";

export interface TimelineRow {
  date: ISODate;
  label: string;
  note: string | null;
  direction: "IN" | "OUT";
  amountCents: Cents;
  balanceAfterCents: Cents;
  /** The moment the balance first drops below R0. */
  runsOut: boolean;
  /** Back above R0 after running out. */
  recovers: boolean;
}

export interface SqueezeFactor {
  key: "TIMING" | "LATE" | "COSTS_OVER" | "BILLS" | "OTHER_ORDERS";
  title: string;
  detail: string;
}

export interface CashStory {
  headline: string;
  summary: string;
  timeline: TimelineRow[];
  squeeze: SqueezeFactor[];
  customerName: string;
}

const pluralDays = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export function buildCashStory(input: ForecastInput, analysis: OrderAnalysis): CashStory {
  const order = input.proposedOrder;
  if (!order) throw new Error("buildCashStory needs a proposed order");
  const result = analysis.primary;
  const name = input.customerNames?.[order.customerId] ?? "the customer";
  const predictions = analysis.usePredictions ? analysis.predictions : [];

  // --- What was entered -----------------------------------------------------
  const deposit = order.payments.filter((p) => p.kind === "DEPOSIT").reduce((s, p) => s + p.amountCents, 0);
  const later = order.payments.filter((p) => p.kind !== "DEPOSIT");
  const laterText = later
    .map((p) => `${formatRand(p.amountCents)} ${p.expectedDate ? `on ${formatShortDate(p.expectedDate)}` : "on a date not set yet"}`)
    .join(" and ");
  const costsText = order.costs
    .map((c) => `${c.description.toLowerCase()} ${formatRand(c.estimatedCents)}${c.dueDate ? ` on ${formatShortDate(c.dueDate)}` : ""}`)
    .join(", ");
  const summary =
    `${name} wants ${order.title.toLowerCase()} for ${formatRand(order.valueCents)}. ` +
    (deposit > 0 ? `${formatRand(deposit)} deposit now` : "No deposit") +
    (laterText ? `, then ${laterText}.` : ".") +
    (costsText ? ` You'll pay for ${costsText}.` : "");

  // --- Timeline: every rand in and out until this order is fully paid ---------
  const proposedEvents = result.events.filter((e) => e.isProposed);
  const storyEnd = proposedEvents.reduce((d, e) => (e.date > d ? e.date : d), result.today);
  let balance = result.startingBalanceCents;
  let ranOut = false;
  let recovered = false;
  const timeline: TimelineRow[] = [];
  const originalCost = new Map(order.costs.map((c) => [c.id, c.estimatedCents]));
  const lateness = predictions.find((p) => p.kind === "CUSTOMER_LATENESS");
  const costBias = predictions.find((p) => p.kind === "COST_BIAS");

  const describe = (e: CashEvent): { label: string; note: string | null } => {
    if (e.isProposed && e.source === "ORDER_PAYMENT") {
      const shifted = predictions.find((p) => p.paymentId === e.refId && p.fromDate && p.toDate);
      const label = e.name === "the deposit" ? `Deposit from ${name}` : `${name} pays the balance`;
      if (shifted?.kind === "CUSTOMER_LATENESS") {
        return { label, note: `Agreed for ${formatShortDate(shifted.fromDate!)}, but ${name} usually pays about ${pluralDays(diffDays(shifted.toDate!, shifted.fromDate!))} late` };
      }
      if (shifted?.kind === "PAYDAY_PATTERN") {
        return { label, note: `Agreed for ${formatShortDate(shifted.fromDate!)}, but most of your customers pay at month-end` };
      }
      return { label, note: null };
    }
    if (e.isProposed && e.source === "ORDER_COST") {
      const entered = originalCost.get(e.refId);
      const over = entered !== undefined && entered < e.amountCents;
      return { label: `${e.name} for this order`, note: over ? `You entered ${formatRand(entered!)}. Your costs usually run over, so Chrono expects more` : null };
    }
    if (e.source === "COMMITMENT") return { label: e.name, note: "Regular payment" };
    const title = e.label.split(": ").slice(1).join(": ");
    return { label: e.direction === "IN" ? `Payment for ${title}` : `${e.name} for ${title}`, note: "An order you've already accepted" };
  };

  for (const e of result.events) {
    if (e.date > storyEnd) break;
    balance += e.direction === "IN" ? e.amountCents : -e.amountCents;
    const runsOut = !ranOut && balance < 0;
    if (runsOut) ranOut = true;
    const recovers = ranOut && !recovered && !runsOut && balance >= 0;
    if (recovers) recovered = true;
    timeline.push({ date: e.date, ...describe(e), direction: e.direction, amountCents: e.amountCents, balanceAfterCents: balance, runsOut, recovers });
  }

  // --- What's squeezing cash (only when there's a problem) ------------------
  const squeeze: SqueezeFactor[] = [];
  const shortfall = result.shortfall;
  const crunchDate = shortfall?.firstDate ?? (result.verdict !== "SAFE" ? result.minBalanceDate : null);
  if (crunchDate) {
    const upfront = proposedEvents.filter((e) => e.direction === "OUT" && e.date <= crunchDate).reduce((s, e) => s + e.amountCents, 0);
    const inBefore = proposedEvents.filter((e) => e.direction === "IN" && e.date <= crunchDate).reduce((s, e) => s + e.amountCents, 0);
    if (upfront > inBefore) {
      squeeze.push({
        key: "TIMING",
        title: "You pay before you're paid",
        detail: `${formatRand(upfront)} goes out for this order before ${formatShortDate(crunchDate)}, but only ${formatRand(inBefore)} has come in from ${name} by then.`,
      });
    }
    if (lateness?.fromDate && lateness.toDate) {
      squeeze.push({
        key: "LATE",
        title: `${name} usually pays late`,
        detail: `About ${pluralDays(diffDays(lateness.toDate, lateness.fromDate))} late every time, so the money lands on ${formatShortDate(lateness.toDate)} instead of ${formatShortDate(lateness.fromDate)}.`,
      });
    }
    if (costBias?.extraCents) {
      squeeze.push({ key: "COSTS_OVER", title: "Your costs usually run over", detail: `Past orders cost more than you estimated, so Chrono adds ${formatRand(costBias.extraCents)} to this one.` });
    }
    const bills = result.events.filter((e) => e.source === "COMMITMENT" && e.direction === "OUT" && e.date <= crunchDate);
    if (bills.length) {
      const biggest = bills.reduce((a, b) => (b.amountCents > a.amountCents ? b : a));
      const total = bills.reduce((s, b) => s + b.amountCents, 0);
      squeeze.push({
        key: "BILLS",
        title: bills.length === 1 ? `${biggest.name} is due` : "Bills are due",
        detail:
          bills.length === 1
            ? `${formatRand(biggest.amountCents)} on ${formatShortDate(biggest.date)}.`
            : `${formatRand(total)} in regular payments before then, including ${biggest.name.toLowerCase()} (${formatRand(biggest.amountCents)}) on ${formatShortDate(biggest.date)}.`,
      });
    }
    const otherCosts = result.events.filter((e) => !e.isProposed && e.source === "ORDER_COST" && e.date <= crunchDate);
    if (otherCosts.length) {
      const total = otherCosts.reduce((s, e) => s + e.amountCents, 0);
      squeeze.push({
        key: "OTHER_ORDERS",
        title: "Other orders need cash too",
        detail: `${formatRand(total)} for orders you've already accepted goes out in the same period.`,
      });
    }
  }

  // --- Headline -------------------------------------------------------------
  let headline: string;
  if (shortfall) {
    const payday = proposedEvents.find((e) => e.direction === "IN" && e.name !== "the deposit" && e.date >= shortfall.firstDate);
    const gap = payday ? diffDays(payday.date, shortfall.firstDate) : 0;
    headline =
      `If you take this order, you'll run out of money on ${formatShortDate(shortfall.firstDate)}` +
      (payday && gap > 0 ? `, ${pluralDays(gap)} before ${name} pays you.` : ".");
  } else if (result.verdict === "TIGHT") {
    headline = `You can take this order, but your cash drops to ${formatRand(result.minBalanceCents)} on ${formatShortDate(result.minBalanceDate)}, below your ${formatRand(result.safetyBufferCents)} cushion.`;
  } else {
    headline = `You can afford this order. Your cash never drops below ${formatRand(result.minBalanceCents)}.`;
  }

  return { headline, summary, timeline, squeeze, customerName: name };
}
