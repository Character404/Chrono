import { describe, expect, it } from "vitest";
import { analyzeOrder } from "../../engine/analyze";
import { addDays } from "../../engine/dates";
import { buildDemoData, demoWeddingInput, DEMO_IDS } from "../demo-data";

describe("Demo account data", () => {
  it("shows the headline moment on any day: Safe as entered, a fixable shortfall once adjusted", () => {
    for (let i = 0; i < 14; i++) {
      const today = addDays("2026-10-24", i * 3);
      const a = analyzeOrder(demoWeddingInput(buildDemoData(today), today));
      expect(a.asEntered.verdict).toBe("SAFE");
      expect(a.primary.verdict).toBe("SHORTFALL");
      expect(a.deposit.status).toBe("INCREASE");
    }
  });

  it("triggers every intelligent feature", () => {
    const today = "2026-10-24";
    const a = analyzeOrder(demoWeddingInput(buildDemoData(today), today));
    const kinds = a.predictions.map((p) => p.kind);
    expect(kinds).toContain("CUSTOMER_LATENESS");
    expect(kinds).toContain("COST_BIAS");
    expect(a.driftWarnings.length).toBeGreaterThan(0);
  });

  it("keeps the wedding order valid and pending", () => {
    const data = buildDemoData("2026-10-24");
    const wedding = data.orders.find((o) => o.id === DEMO_IDS.wedding)!;
    expect(wedding.status).toBe("DRAFT");
    expect(wedding.payments.reduce((s, p) => s + p.amountCents, 0)).toBe(wedding.valueCents);
  });
});
