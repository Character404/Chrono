import { describe, expect, it } from "vitest";
import { buildDemoData, DEMO_IDS } from "../../demo/demo-data";
import { computeImpact, customerPaymentHistory, describeReliability, isLatePayer, reliabilityTone, summarizeCustomers } from "../insights";
import type { BusinessContext } from "../repo";

const today = "2026-10-24";
const data = buildDemoData(today);
const ctx: BusinessContext = {
  today,
  business: data.business,
  commitments: data.commitments,
  orders: data.orders,
  customers: data.customers.map((c) => ({ id: c.id, name: c.name })),
  orderMeta: {},
};

describe("Insights", () => {
  it("counts the demo wedding as a shortfall spotted before it was accepted", () => {
    const impact = computeImpact(ctx);
    expect(impact.shortfallsSpotted).toBe(1);
    expect(impact.cashAtRiskCents).toBeGreaterThan(0);
  });

  it("describes customers in plain language", () => {
    const byId = Object.fromEntries(summarizeCustomers(ctx).map((s) => [s.id, s]));
    expect(byId[DEMO_IDS.thabo].summary).toBe("Usually about 7 days late");
    expect(byId["demo-cust-naledi"].summary).toBe("Usually pays on time");
  });

  it("lists a customer's payment history, latest first, without deposits", () => {
    const rows = customerPaymentHistory(ctx, DEMO_IDS.thabo);
    expect(rows).toHaveLength(4);
    expect(rows[0].receivedDate >= rows[1].receivedDate).toBe(true);
    expect(rows.every((r) => r.daysLate >= 6)).toBe(true);
  });

  it("colours and counts customers the same way it describes them", () => {
    for (const c of summarizeCustomers(ctx)) {
      const saysLate = c.summary.includes("late");
      expect(isLatePayer(c.reliability)).toBe(saysLate);
      if (c.reliability.scope === "CUSTOMER") expect(reliabilityTone(c.reliability)).toBe(saysLate ? "badge-TIGHT" : "badge-SAFE");
    }
  });

  it("says when there isn't enough history", () => {
    expect(describeReliability({ customerId: "x", scope: "NONE", records: 0, lateCount: 0, medianLatenessDays: 0, onTimeRate: 0, partialRate: 0, confidence: null, shiftDays: 0 })).toBe("Not enough payment history yet");
  });
});
