import { describe, expect, it } from "vitest";
import { onboardingComplete, onboardingSteps } from "../onboarding";
import { buildDemoData } from "../../demo/demo-data";
import type { BusinessContext } from "../repo";

const empty: BusinessContext = {
  today: "2026-10-24",
  business: { openingCashCents: 450000, openingCashDate: "2026-10-24", safetyBufferCents: 50000 },
  commitments: [],
  orders: [],
  customers: [],
  orderMeta: {},
};

describe("First-run checklist", () => {
  it("starts with only the business step done", () => {
    const steps = onboardingSteps(empty);
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(["business"]);
    expect(onboardingComplete(steps)).toBe(false);
  });

  it("is complete for an established business like the demo", () => {
    const d = buildDemoData("2026-10-24");
    const ctx: BusinessContext = { ...empty, commitments: d.commitments, orders: d.orders, customers: d.customers };
    expect(onboardingComplete(onboardingSteps(ctx))).toBe(true);
  });
});
