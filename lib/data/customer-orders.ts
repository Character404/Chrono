/**
 * When a customer orders through Chrono, Chrono checks the order against the business's real
 * cash, bills and other orders BEFORE it's placed, and sets the deposit that keeps the business
 * safe. The customer only ever sees the terms, never the business's finances.
 */
import { analyzeOrder } from "../engine/analyze";
import { addDays, type ISODate } from "../engine/dates";
import type { Verdict } from "../engine/forecast";
import type { OrderInput } from "../engine/types";
import type { Offering } from "../demo/listings";
import { forecastInputFor, type BusinessContext } from "./repo";

export interface CustomerTerms {
  order: OrderInput;
  valueCents: number;
  depositCents: number;
  balanceCents: number;
  usualDepositCents: number;
  /** Chrono raised the deposit to keep the business safe. */
  depositAdjusted: boolean;
  /** Even a full deposit can't keep the business safe on this date. */
  hardDate: boolean;
  verdict: Verdict;
  eventDate: ISODate;
}

export function earliestDate(offering: Offering, today: ISODate): ISODate {
  return addDays(today, offering.leadDays);
}

export function validateCustomerOrder(offering: Offering | undefined, eventDate: string, today: ISODate): string | null {
  if (!offering) return "Choose what you'd like to order.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return "Choose the date you need it.";
  if (eventDate < earliestDate(offering, today)) return `${offering.name} needs at least ${offering.leadDays} days' notice.`;
  if (eventDate > addDays(today, 365)) return "Choose a date within the next year.";
  return null;
}

function buildOrder(offering: Offering, eventDate: ISODate, today: ISODate, depositCents: number, customerId: string): OrderInput {
  const costDate = addDays(eventDate, -2) < today ? today : addDays(eventDate, -2);
  const payments: OrderInput["payments"] = [];
  if (depositCents > 0) payments.push({ id: "deposit", kind: "DEPOSIT", amountCents: depositCents, expectedDate: today, dateCertainty: "CONFIRMED" });
  if (offering.priceCents - depositCents > 0) {
    payments.push({ id: "balance", kind: "BALANCE", amountCents: offering.priceCents - depositCents, expectedDate: eventDate, dateCertainty: "CONFIRMED" });
  }
  return {
    id: "new",
    customerId,
    title: offering.name,
    valueCents: offering.priceCents,
    status: "DRAFT",
    payments,
    costs: [{ id: "cost", description: offering.costLabel, category: offering.costLabel === "Materials" ? "MATERIALS" : "INGREDIENTS", estimatedCents: offering.costCents, dueDate: costDate, dateCertainty: "ESTIMATED" }],
  };
}

/**
 * Works out the terms Chrono offers this customer, using the business's own forecast.
 * The deposit only rises by as much as THIS order would hurt the business: Chrono compares the
 * business with and without the order over the same period, and picks the smallest deposit
 * (in R50 steps) that keeps the order from pushing cash below the safety buffer, or below where
 * it would already be without the order.
 */
export function customerTerms(ctx: BusinessContext, offering: Offering, eventDate: ISODate, customerId = "new-customer"): CustomerTerms {
  const step = 5000;
  const usual = Math.round((offering.priceCents * offering.depositPercent) / 100 / step) * step;
  const minWith = (deposit: number) => analyzeOrder(forecastInputFor(ctx, buildOrder(offering, eventDate, ctx.today, deposit, customerId))).primary.minBalanceCents;

  // The same period without this order: a placeholder order that brings nothing in and costs nothing.
  const placeholder: OrderInput = {
    id: "new",
    customerId,
    title: offering.name,
    valueCents: 1,
    status: "DRAFT",
    payments: [{ id: "balance", kind: "BALANCE", amountCents: 1, expectedDate: eventDate, dateCertainty: "CONFIRMED" }],
    costs: [],
  };
  const withoutOrder = analyzeOrder(forecastInputFor(ctx, placeholder)).primary.minBalanceCents;
  const floor = Math.min(ctx.business.safetyBufferCents, withoutOrder);

  let deposit = usual;
  let hardDate = false;
  if (minWith(usual) < floor) {
    if (minWith(offering.priceCents) < floor) {
      hardDate = true;
    } else {
      let lo = usual;
      let hi = offering.priceCents;
      while (hi - lo > step) {
        const mid = Math.ceil((lo + hi) / 2 / step) * step;
        if (minWith(mid) >= floor) hi = mid;
        else lo = mid;
      }
      deposit = hi;
    }
  }
  const order = buildOrder(offering, eventDate, ctx.today, deposit, customerId);
  const verdict = analyzeOrder(forecastInputFor(ctx, order)).primary.verdict;
  return { order, valueCents: offering.priceCents, depositCents: deposit, balanceCents: offering.priceCents - deposit, usualDepositCents: usual, depositAdjusted: deposit > usual, hardDate, verdict, eventDate };
}
