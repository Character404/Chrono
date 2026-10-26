import { describe, expect, it } from "vitest";
import { buildDemoData, DEMO_IDS } from "../../demo/demo-data";
import { getListing, LISTINGS } from "../../demo/listings";
import { addDays } from "../../engine/dates";
import { customerTerms, earliestDate, validateCustomerOrder } from "../customer-orders";
import type { BusinessContext } from "../repo";

const today = "2026-10-24";
const d = buildDemoData(today);
const ctx: BusinessContext = { today, business: d.business, commitments: d.commitments, orders: d.orders, customers: d.customers, orderMeta: {} };
const lerato = getListing("leratos-kitchen")!;
const offering = (id: string) => lerato.offerings.find((o) => o.id === id)!;

describe("Customer orders through Chrono", () => {
  it("only Lerato's Kitchen takes orders in the prototype; the others are samples", () => {
    expect(LISTINGS.filter((l) => l.orderable).map((l) => l.slug)).toEqual(["leratos-kitchen"]);
  });

  it("checks the notice period and the date", () => {
    const wedding = offering("wedding");
    expect(validateCustomerOrder(wedding, addDays(today, 3), today)).toMatch(/7 days' notice/);
    expect(validateCustomerOrder(wedding, earliestDate(wedding, today), today)).toBeNull();
    expect(validateCustomerOrder(undefined, addDays(today, 10), today)).toMatch(/Choose what/);
  });

  it("uses a registered customer's history: Sipho pays a few days late, so his wedding deposit goes up", () => {
    const t = customerTerms(ctx, offering("wedding"), addDays(today, 8), DEMO_IDS.sipho);
    expect(t.depositAdjusted).toBe(true);
    expect(t.usualDepositCents).toBe(100000);
    expect(t.depositCents).toBe(230000);
    expect(t.depositCents + t.balanceCents).toBe(t.valueCents);
  });

  it("keeps the usual deposit for a new customer with no late-payment history", () => {
    const t = customerTerms(ctx, offering("wedding"), addDays(today, 8));
    expect(t.depositAdjusted).toBe(false);
    expect(t.depositCents).toBe(100000);
  });

  it("never blames an order for bills the business has anyway: a small far-off order keeps the usual deposit", () => {
    for (const days of [10, 14, 21, 30]) {
      const t = customerTerms(ctx, offering("cake"), addDays(today, days), DEMO_IDS.sipho);
      expect(t.depositCents).toBe(t.usualDepositCents);
    }
  });
});
