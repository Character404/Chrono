/**
 * Business-level insights for the home and customer screens.
 * Pure functions over the loaded business context.
 */
import { analyzeOrder } from "../engine/analyze";
import { diffDays, type ISODate } from "../engine/dates";
import { customerReliability, extractHistory, type CustomerReliability } from "../engine/intelligence";
import { forecastInputFor, type BusinessContext } from "./repo";

export interface Impact {
  shortfallsSpotted: number;
  cashAtRiskCents: number;
}

/**
 * Shortfalls Chrono has spotted on orders before they were accepted
 * (orders still waiting for a decision, and orders the owner declined).
 */
export function computeImpact(ctx: BusinessContext): Impact {
  let shortfallsSpotted = 0;
  let cashAtRiskCents = 0;
  for (const order of ctx.orders) {
    if (order.status !== "DRAFT" && order.status !== "DECLINED") continue;
    try {
      const a = analyzeOrder(forecastInputFor(ctx, { ...order, status: "DRAFT" }));
      if (a.primary.shortfall) {
        shortfallsSpotted++;
        cashAtRiskCents += a.primary.shortfall.amountCents;
      }
    } catch {
      // An order that can't be checked yet is simply skipped.
    }
  }
  return { shortfallsSpotted, cashAtRiskCents };
}

export interface CustomerSummary {
  id: string;
  name: string;
  reliability: CustomerReliability;
  /** Plain-language summary, e.g. "Usually about 7 days late". */
  summary: string;
  orderCount: number;
}

/** Late means more than a day late, matching how the on-time rate is measured. */
export function isLatePayer(r: CustomerReliability): boolean {
  return r.scope === "CUSTOMER" && r.shiftDays > 1;
}

/** Badge colour for a customer's reliability. */
export function reliabilityTone(r: CustomerReliability): "" | "badge-TIGHT" | "badge-SAFE" {
  if (r.scope !== "CUSTOMER") return "";
  return isLatePayer(r) ? "badge-TIGHT" : "badge-SAFE";
}

export function describeReliability(r: CustomerReliability): string {
  if (r.scope !== "CUSTOMER") return "Not enough payment history yet";
  // Up to a day late counts as on time, matching how the on-time rate is measured.
  if (r.shiftDays <= 1) return r.onTimeRate >= 0.75 ? "Usually pays on time" : "Usually pays within a day or so";
  return `Usually about ${r.shiftDays} day${r.shiftDays === 1 ? "" : "s"} late`;
}

export function summarizeCustomers(ctx: BusinessContext): CustomerSummary[] {
  const history = extractHistory(ctx.orders).payments;
  return ctx.customers.map((c) => {
    const reliability = customerReliability(c.id, history);
    return {
      id: c.id,
      name: c.name,
      reliability,
      summary: describeReliability(reliability),
      orderCount: ctx.orders.filter((o) => o.customerId === c.id).length,
    };
  });
}

export interface PaymentHistoryRow {
  orderId: string;
  orderTitle: string;
  amountCents: number;
  expectedDate: ISODate;
  receivedDate: ISODate;
  daysLate: number;
}

export function customerPaymentHistory(ctx: BusinessContext, customerId: string): PaymentHistoryRow[] {
  const rows: PaymentHistoryRow[] = [];
  for (const o of ctx.orders) {
    if (o.customerId !== customerId) continue;
    for (const p of o.payments) {
      if (p.kind === "DEPOSIT" || !p.receivedDate || !p.expectedDate) continue;
      rows.push({
        orderId: o.id,
        orderTitle: o.title,
        amountCents: p.receivedAmountCents ?? p.amountCents,
        expectedDate: p.expectedDate,
        receivedDate: p.receivedDate,
        daysLate: diffDays(p.receivedDate, p.expectedDate),
      });
    }
  }
  return rows.sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
}
