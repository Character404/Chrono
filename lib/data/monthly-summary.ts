/**
 * A calm, plain-language summary of one month: what came in, what went out,
 * which orders were paid in full, and who paid late. Built only from what the
 * owner recorded, plus regular payments scheduled for that month.
 */
import { addDays, dateParts, daysInMonth, diffDays, makeDateClamped, type ISODate } from "../engine/dates";
import { commitmentDates } from "../engine/forecast";
import type { Cents } from "../engine/money";
import type { BusinessContext } from "./repo";

export interface LatePayment {
  customerName: string;
  orderTitle: string;
  amountCents: Cents;
  daysLate: number;
}

export interface MonthSummary {
  month: string; // "YYYY-MM"
  start: ISODate;
  end: ISODate;
  moneyInCents: Cents;
  paymentsReceived: number;
  orderCostsCents: Cents;
  costsPaid: number;
  regularOutCents: Cents;
  regularInCents: Cents;
  netCents: Cents;
  ordersPaidInFull: { title: string; customerName: string; valueCents: Cents }[];
  latePayments: LatePayment[];
  onTimeRate: number | null;
  topCustomer: { name: string; amountCents: Cents } | null;
}

export function monthRange(month: string): { start: ISODate; end: ISODate } {
  const [y, m] = month.split("-").map(Number);
  return { start: makeDateClamped(y, m, 1), end: makeDateClamped(y, m, daysInMonth(y, m)) };
}

/** The current month and the ones before it, newest first, e.g. ["2026-10", "2026-09", ...]. */
export function recentMonths(today: ISODate, count: number): string[] {
  const { year, month } = dateParts(today);
  return Array.from({ length: count }, (_, i) => makeDateClamped(year, month - i, 1).slice(0, 7));
}

export function computeMonthlySummary(ctx: BusinessContext, month: string): MonthSummary {
  const { start, end } = monthRange(month);
  const inMonth = (d: ISODate | null | undefined): d is ISODate => !!d && d >= start && d <= end;
  const customerName = (id: string) => ctx.customers.find((c) => c.id === id)?.name ?? "A customer";

  let moneyIn = 0;
  let paymentsReceived = 0;
  let orderCosts = 0;
  let costsPaid = 0;
  let onTime = 0;
  let datedReceipts = 0;
  const latePayments: LatePayment[] = [];
  const byCustomer = new Map<string, number>();
  const ordersPaidInFull: MonthSummary["ordersPaidInFull"] = [];

  for (const o of ctx.orders) {
    for (const p of o.payments) {
      if (!inMonth(p.receivedDate)) continue;
      const amount = p.receivedAmountCents ?? p.amountCents;
      moneyIn += amount;
      paymentsReceived++;
      byCustomer.set(o.customerId, (byCustomer.get(o.customerId) ?? 0) + amount);
      if (p.kind !== "DEPOSIT" && p.expectedDate) {
        datedReceipts++;
        const late = diffDays(p.receivedDate, p.expectedDate);
        if (late > 1) latePayments.push({ customerName: customerName(o.customerId), orderTitle: o.title, amountCents: amount, daysLate: late });
        else onTime++;
      }
    }
    for (const c of o.costs) {
      if (!inMonth(c.paidDate)) continue;
      orderCosts += c.paidCents ?? c.estimatedCents;
      costsPaid++;
    }
    const allPaid = o.payments.length > 0 && o.payments.every((p) => p.receivedDate);
    const lastPaid = o.payments.map((p) => p.receivedDate ?? "").sort().at(-1);
    if (allPaid && inMonth(lastPaid)) ordersPaidInFull.push({ title: o.title, customerName: customerName(o.customerId), valueCents: o.valueCents });
  }

  let regularOut = 0;
  let regularIn = 0;
  for (const c of ctx.commitments) {
    const times = commitmentDates(c, start, end).length;
    if (c.direction === "OUT") regularOut += times * c.amountCents;
    else regularIn += times * c.amountCents;
  }

  const top = [...byCustomer.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    month,
    start,
    end,
    moneyInCents: moneyIn,
    paymentsReceived,
    orderCostsCents: orderCosts,
    costsPaid,
    regularOutCents: regularOut,
    regularInCents: regularIn,
    netCents: moneyIn + regularIn - orderCosts - regularOut,
    ordersPaidInFull,
    latePayments: latePayments.sort((a, b) => b.daysLate - a.daysLate),
    onTimeRate: datedReceipts ? onTime / datedReceipts : null,
    topCustomer: top ? { name: customerName(top[0]), amountCents: top[1] } : null,
  };
}

/** The month the summary page opens on: last month, unless this month already has more activity. */
export function defaultSummaryMonth(ctx: BusinessContext): string {
  const [thisMonth, lastMonth] = recentMonths(ctx.today, 2);
  const a = computeMonthlySummary(ctx, thisMonth);
  const b = computeMonthlySummary(ctx, lastMonth);
  return a.paymentsReceived > b.paymentsReceived ? thisMonth : lastMonth;
}

export function nextDay(d: ISODate): ISODate {
  return addDays(d, 1);
}
