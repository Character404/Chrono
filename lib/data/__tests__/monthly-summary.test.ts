import { describe, expect, it } from "vitest";
import { buildDemoData } from "../../demo/demo-data";
import { computeMonthlySummary, defaultSummaryMonth, monthRange, recentMonths } from "../monthly-summary";
import type { BusinessContext } from "../repo";

const today = "2026-10-24";
const d = buildDemoData(today);
const ctx: BusinessContext = { today, business: d.business, commitments: d.commitments, orders: d.orders, customers: d.customers, orderMeta: {} };

describe("Monthly summary", () => {
  it("works out month ranges and recent months", () => {
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(recentMonths(today, 3)).toEqual(["2026-10", "2026-09", "2026-08"]);
  });

  it("summarises last month from what was recorded", () => {
    const s = computeMonthlySummary(ctx, "2026-09");
    expect(s.moneyInCents).toBeGreaterThan(0);
    expect(s.paymentsReceived).toBeGreaterThan(3);
    expect(s.ordersPaidInFull.length).toBeGreaterThan(0);
    expect(s.netCents).toBe(s.moneyInCents + s.regularInCents - s.orderCostsCents - s.regularOutCents);
  });

  it("names customers who paid late, latest first", () => {
    const s = computeMonthlySummary(ctx, "2026-09");
    expect(s.latePayments[0].customerName).toBe("Thabo Mokoena");
    expect(s.latePayments[0].daysLate).toBeGreaterThanOrEqual(6);
    expect(s.latePayments.every((l) => l.daysLate > 1)).toBe(true);
  });

  it("counts a regular payment in every month it falls", () => {
    const s = computeMonthlySummary(ctx, "2026-11");
    expect(s.regularOutCents).toBeGreaterThan(0);
  });

  it("opens on the busier of this month and last month", () => {
    expect(["2026-10", "2026-09"]).toContain(defaultSummaryMonth(ctx));
  });
});
