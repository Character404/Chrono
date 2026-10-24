/**
 * Chrono intelligence layer (SPEC.md, "Intelligence layer").
 *
 * Learns from the business's own recorded history and returns an adjusted
 * copy of the forecast input plus a list of explainable predictions.
 * Pure functions only; every prediction says why, from how many records,
 * and how confident it is.
 */
import { addDays, dateParts, diffDays, formatShortDate, makeDateClamped, type ISODate } from "./dates";
import { formatRand, type Cents } from "./money";
import type { CostCategory, ForecastInput, OrderInput, PaymentKind } from "./types";

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export function confidenceFor(records: number): Confidence | null {
  if (records >= 8) return "HIGH";
  if (records >= 4) return "MEDIUM";
  if (records >= 2) return "LOW";
  return null;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// History extraction
// ---------------------------------------------------------------------------

export interface PaymentRecord {
  orderId: string;
  customerId: string;
  kind: PaymentKind;
  expectedDate: ISODate;
  receivedDate: ISODate;
  amountCents: Cents;
  receivedAmountCents: Cents;
}

export interface CostRecord {
  orderId: string;
  category: CostCategory;
  estimatedCents: Cents;
  paidCents: Cents;
  paidDate: ISODate;
}

export function extractHistory(orders: OrderInput[]): { payments: PaymentRecord[]; costs: CostRecord[] } {
  const payments: PaymentRecord[] = [];
  const costs: CostRecord[] = [];
  for (const o of orders) {
    for (const p of o.payments) {
      if (!p.receivedDate || !p.expectedDate) continue;
      payments.push({
        orderId: o.id,
        customerId: o.customerId,
        kind: p.kind,
        expectedDate: p.expectedDate,
        receivedDate: p.receivedDate,
        amountCents: p.amountCents,
        receivedAmountCents: p.receivedAmountCents ?? p.amountCents,
      });
    }
    for (const c of o.costs) {
      if (!c.paidDate || c.paidCents == null) continue;
      costs.push({ orderId: o.id, category: c.category, estimatedCents: c.estimatedCents, paidCents: c.paidCents, paidDate: c.paidDate });
    }
  }
  return { payments, costs };
}

// ---------------------------------------------------------------------------
// 1. Customer payment reliability
// ---------------------------------------------------------------------------

export interface CustomerReliability {
  customerId: string;
  scope: "CUSTOMER" | "ALL_CUSTOMERS" | "NONE";
  records: number;
  lateCount: number;
  medianLatenessDays: number;
  onTimeRate: number;
  partialRate: number;
  confidence: Confidence | null;
  /** Days to shift this customer's expected payment dates (0 = no shift). */
  shiftDays: number;
}

function reliabilityFrom(records: PaymentRecord[]) {
  const lateness = records.map((r) => diffDays(r.receivedDate, r.expectedDate));
  const med = median(lateness);
  return {
    records: records.length,
    lateCount: lateness.filter((d) => d > 1).length,
    medianLatenessDays: med,
    onTimeRate: records.length ? lateness.filter((d) => d <= 1).length / records.length : 0,
    partialRate: records.length ? records.filter((r) => r.receivedAmountCents < r.amountCents).length / records.length : 0,
    confidence: confidenceFor(records.length),
    shiftDays: med > 0 ? Math.ceil(med) : 0,
  };
}

export function customerReliability(customerId: string, history: PaymentRecord[]): CustomerReliability {
  const own = history.filter((r) => r.customerId === customerId);
  if (own.length >= 2) return { customerId, scope: "CUSTOMER", ...reliabilityFrom(own) };
  if (history.length >= 2) return { customerId, scope: "ALL_CUSTOMERS", ...reliabilityFrom(history) };
  return { customerId, scope: "NONE", records: own.length, lateCount: 0, medianLatenessDays: 0, onTimeRate: 0, partialRate: 0, confidence: null, shiftDays: 0 };
}

// ---------------------------------------------------------------------------
// 2. Payday pattern
// ---------------------------------------------------------------------------

export interface PaydayPattern {
  records: number;
  shareInWindow: number;
  windowStartDay: number;
  active: boolean;
  confidence: Confidence | null;
}

export function isInPaydayWindow(date: ISODate, windowStartDay: number): boolean {
  const { day } = dateParts(date);
  return day >= windowStartDay || day === 1;
}

/** The first day of the next payday window on or after `date`. */
export function nextPaydayWindowStart(date: ISODate, windowStartDay: number): ISODate {
  if (isInPaydayWindow(date, windowStartDay)) return date;
  const { year, month } = dateParts(date);
  return makeDateClamped(year, month, windowStartDay);
}

export function paydayPattern(history: PaymentRecord[], windowStartDay = 25): PaydayPattern {
  const inWindow = history.filter((r) => isInPaydayWindow(r.receivedDate, windowStartDay)).length;
  const share = history.length ? inWindow / history.length : 0;
  const confidence = confidenceFor(history.length);
  return { records: history.length, shareInWindow: share, windowStartDay, active: confidence !== null && share >= 0.6, confidence };
}

// ---------------------------------------------------------------------------
// 3. Cost estimate bias
// ---------------------------------------------------------------------------

export interface CostBias {
  records: number;
  /** e.g. 0.08 means actual costs run 8% above estimates. */
  biasRatio: number;
  active: boolean;
  confidence: Confidence | null;
}

export function costEstimateBias(history: CostRecord[]): CostBias {
  const usable = history.filter((c) => c.estimatedCents > 0);
  const est = usable.reduce((s, c) => s + c.estimatedCents, 0);
  const paid = usable.reduce((s, c) => s + c.paidCents, 0);
  const ratio = est > 0 ? paid / est - 1 : 0;
  return { records: usable.length, biasRatio: ratio, active: usable.length >= 4 && ratio > 0.05, confidence: confidenceFor(usable.length) };
}

// ---------------------------------------------------------------------------
// 4. Cost drift warning
// ---------------------------------------------------------------------------

export interface CostDriftWarning {
  costId: string;
  category: CostCategory;
  currentCents: Cents;
  medianCents: Cents;
  pctAbove: number;
  message: string;
}

export function costDriftWarnings(order: OrderInput, history: CostRecord[]): CostDriftWarning[] {
  const warnings: CostDriftWarning[] = [];
  for (const c of order.costs) {
    if (c.paidDate) continue;
    const recent = history
      .filter((h) => h.category === c.category && h.orderId !== order.id)
      .sort((a, b) => b.paidDate.localeCompare(a.paidDate))
      .slice(0, 5)
      .map((h) => h.paidCents);
    if (recent.length < 2) continue;
    const med = median(recent);
    if (med > 0 && c.estimatedCents > med * 1.15) {
      const pct = Math.round((c.estimatedCents / med - 1) * 100);
      warnings.push({
        costId: c.id,
        category: c.category,
        currentCents: c.estimatedCents,
        medianCents: Math.round(med),
        pctAbove: pct,
        message: `${c.description} (${formatRand(c.estimatedCents)}) is ${pct}% higher than your usual ${c.category.toLowerCase()} cost (${formatRand(Math.round(med))}). Check your price still covers it.`,
      });
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Apply predictions
// ---------------------------------------------------------------------------

export type PredictionKind = "CUSTOMER_LATENESS" | "PAYDAY_PATTERN" | "COST_BIAS";

export interface Prediction {
  kind: PredictionKind;
  orderId: string;
  paymentId?: string;
  fromDate?: ISODate;
  toDate?: ISODate;
  extraCents?: Cents;
  dataPoints: number;
  confidence: Confidence;
  reason: string;
}

export interface PredictionResult {
  input: ForecastInput;
  predictions: Prediction[];
  driftWarnings: CostDriftWarning[];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Returns an adjusted copy of the forecast input:
 * - unreceived, non-deposit payments of accepted and proposed orders are moved
 *   later according to the customer's lateness or the payday pattern;
 * - the proposed order's unpaid costs are raised by the learned estimate bias.
 * Deposits are never shifted: they are taken when the order is accepted.
 */
export function applyPredictions(input: ForecastInput): PredictionResult {
  const windowStart = input.business.paydayWindowStart ?? 25;
  const history = extractHistory(input.orders);
  const payday = paydayPattern(history.payments, windowStart);
  const bias = costEstimateBias(history.costs);
  const predictions: Prediction[] = [];
  const names = input.customerNames ?? {};
  const reliabilityCache = new Map<string, CustomerReliability>();
  const reliability = (id: string) => {
    if (!reliabilityCache.has(id)) reliabilityCache.set(id, customerReliability(id, history.payments));
    return reliabilityCache.get(id)!;
  };

  const adjustOrder = (order: OrderInput, isProposed: boolean): OrderInput => {
    const rel = reliability(order.customerId);
    const strongCustomer = rel.scope === "CUSTOMER" && (rel.confidence === "MEDIUM" || rel.confidence === "HIGH");

    const payments = order.payments.map((p) => {
      if (p.kind === "DEPOSIT" || p.receivedDate || !p.expectedDate || p.dateCertainty === "UNKNOWN") return p;
      let target = p.expectedDate;
      let kind: PredictionKind | null = null;
      let reason = "";
      let points = 0;
      let confidence: Confidence | null = null;

      if (rel.confidence && rel.shiftDays > 0) {
        const shifted = addDays(p.expectedDate, rel.shiftDays);
        if (shifted > target) {
          target = shifted;
          kind = "CUSTOMER_LATENESS";
          points = rel.records;
          confidence = rel.confidence;
          const who = rel.scope === "CUSTOMER" ? names[order.customerId] ?? "This customer" : "Your customers";
          reason =
            rel.scope === "CUSTOMER"
              ? `${who} paid late on ${rel.lateCount} of ${plural(rel.records, "payment")}, usually about ${rel.shiftDays} days late.`
              : `Based on all your customers, payments usually arrive about ${rel.shiftDays} days late.`;
        }
      }
      if (!strongCustomer && payday.active && payday.confidence) {
        const windowDate = nextPaydayWindowStart(target, windowStart);
        if (windowDate > target) {
          target = windowDate;
          kind = "PAYDAY_PATTERN";
          points = payday.records;
          confidence = payday.confidence;
          reason = `${Math.round(payday.shareInWindow * 100)}% of your payments arrive between the ${windowStart}th and the 1st.`;
        }
      }
      if (!kind || !confidence || target === p.expectedDate) return p;
      predictions.push({
        kind,
        orderId: order.id,
        paymentId: p.id,
        fromDate: p.expectedDate,
        toDate: target,
        dataPoints: points,
        confidence,
        reason: `${reason} This forecast expects ${formatRand(p.amountCents)} on ${formatShortDate(target)} instead of ${formatShortDate(p.expectedDate)}.`,
      });
      return { ...p, expectedDate: target };
    });

    let costs = order.costs;
    if (isProposed && bias.active && bias.confidence) {
      let extra = 0;
      costs = order.costs.map((c) => {
        if (c.paidDate) return c;
        const raised = Math.round(c.estimatedCents * (1 + bias.biasRatio));
        extra += raised - c.estimatedCents;
        return { ...c, estimatedCents: raised };
      });
      if (extra > 0) {
        predictions.push({
          kind: "COST_BIAS",
          orderId: order.id,
          extraCents: extra,
          dataPoints: bias.records,
          confidence: bias.confidence,
          reason: `Your actual costs have run ${Math.round(bias.biasRatio * 100)}% above your estimates on your last ${plural(bias.records, "cost")}, so this forecast adds ${formatRand(extra)}.`,
        });
      }
    }
    return { ...order, payments, costs };
  };

  const orders = input.orders.map((o) => (o.status === "ACCEPTED" && o.id !== input.proposedOrder?.id ? adjustOrder(o, false) : o));
  const proposedOrder = input.proposedOrder ? adjustOrder(input.proposedOrder, true) : null;
  const driftWarnings = input.proposedOrder ? costDriftWarnings(input.proposedOrder, history.costs) : [];

  return { input: { ...input, orders, proposedOrder }, predictions, driftWarnings };
}

