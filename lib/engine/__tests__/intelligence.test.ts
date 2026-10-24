import { describe, expect, it } from "vitest";
import { analyzeOrder } from "../analyze";
import { recommendDeposit } from "../deposit";
import { forecast } from "../forecast";
import { applyPredictions, costDriftWarnings, costEstimateBias, customerReliability, extractHistory, nextPaydayWindowStart, paydayPattern } from "../intelligence";
import { rand } from "../money";
import type { OrderInput, PaymentInput } from "../types";
import { baseOrder, day, makeInput, rent } from "./fixtures";

/** A completed past order whose payments arrived on the given (expected, received) dates. */
function pastOrder(id: string, customerId: string, dates: Array<[string, string]>, costs: OrderInput["costs"] = []): OrderInput {
  const payments: PaymentInput[] = dates.map(([expected, received], i) => ({
    id: `${id}-p${i}`,
    kind: "BALANCE",
    amountCents: rand(1000),
    expectedDate: expected,
    dateCertainty: "ESTIMATED",
    receivedDate: received,
    receivedAmountCents: rand(1000),
  }));
  return { id, customerId, title: `Past order ${id}`, valueCents: rand(1000) * dates.length, status: "COMPLETED", payments, costs };
}

// Thabo's history: lateness of 5, 7, 6 and 8 days (median 6.5, rounded up to 7).
const thaboHistory = pastOrder("h1", "thabo", [
  ["2026-07-10", "2026-07-15"],
  ["2026-08-10", "2026-08-17"],
  ["2026-09-08", "2026-09-14"],
  ["2026-10-06", "2026-10-14"],
]);

describe("Scenario 4: an outstanding customer payment that arrives too late", () => {
  const input = makeInput({ openingRands: 5000, orders: [thaboHistory], commitments: [rent(3000, day(10))] });

  it("as entered, the order is Safe", () => {
    const r = forecast(input);
    expect(r.verdict).toBe("SAFE");
    expect(r.minBalanceCents).toBe(rand(2800));
  });

  it("adjusted for Thabo's lateness, the balance moves 7 days and causes a shortfall", () => {
    const { input: adjusted, predictions } = applyPredictions(input);
    const bal = adjusted.proposedOrder!.payments.find((p) => p.id === "bal")!;
    expect(bal.expectedDate).toBe(day(14));

    const r = forecast(adjusted);
    expect(r.minBalanceCents).toBe(rand(-200));
    expect(r.shortfall!.firstDate).toBe(day(10));
    expect(r.shortfall!.daysBelowZero).toBe(4);
    expect(r.verdict).toBe("SHORTFALL");
    expect(r.shortfall!.causes[0].name).toBe("Rent");

    expect(predictions).toHaveLength(1);
    expect(predictions[0].kind).toBe("CUSTOMER_LATENESS");
    expect(predictions[0].confidence).toBe("MEDIUM");
    expect(predictions[0].dataPoints).toBe(4);
  });

  it("never shifts the deposit", () => {
    const { input: adjusted } = applyPredictions(input);
    expect(adjusted.proposedOrder!.payments.find((p) => p.id === "dep")!.expectedDate).toBe(day(0));
  });

  it("the full check flips from Safe to Cash shortfall and recommends a deposit that fixes it", () => {
    const a = analyzeOrder(input);
    expect(a.asEntered.verdict).toBe("SAFE");
    expect(a.primary.verdict).toBe("SHORTFALL");
    expect(a.deposit.status).toBe("INCREASE");
    expect(a.deposit.recommendedCents).toBe(rand(1200));
    expect(a.explanation.lines.join(" ")).toMatch(/Thabo paid late on 4 of 4 payments, usually about 7 days late/);
    expect(a.explanation.lines.join(" ")).toMatch(/As you entered it, this order looks safe/);
  });

  it("with predictions switched off, the check uses the as-entered forecast", () => {
    const a = analyzeOrder(input, { usePredictions: false });
    expect(a.primary.verdict).toBe("SAFE");
    expect(a.deposit.status).toBe("ALREADY_ENOUGH");
  });

  it("the recommended deposit accounts for predictions", () => {
    const withPredictions = recommendDeposit(input, { transform: (i) => applyPredictions(i).input });
    expect(withPredictions.recommendedCents).toBe(rand(1200));
  });
});

describe("Customer reliability", () => {
  it("makes no prediction with fewer than 2 records", () => {
    const one = pastOrder("h1", "thabo", [["2026-10-01", "2026-10-09"]]);
    const rel = customerReliability("thabo", extractHistory([one]).payments);
    expect(rel.scope).toBe("NONE");
    expect(rel.confidence).toBeNull();
    const { predictions } = applyPredictions(makeInput({ openingRands: 5000, orders: [one] }));
    expect(predictions).toHaveLength(0);
  });

  it("falls back to all customers when this customer has too little history", () => {
    const others = pastOrder("h2", "lindiwe", [
      ["2026-09-01", "2026-09-04"],
      ["2026-10-01", "2026-10-04"],
      ["2026-10-10", "2026-10-13"],
    ]);
    const rel = customerReliability("thabo", extractHistory([others]).payments);
    expect(rel.scope).toBe("ALL_CUSTOMERS");
    expect(rel.shiftDays).toBe(3);
    expect(rel.confidence).toBe("LOW");
  });

  it("assigns confidence by number of records", () => {
    const eight = pastOrder(
      "h3",
      "thabo",
      Array.from({ length: 8 }, (_, i) => [`2026-0${(i % 6) + 3}-02`, `2026-0${(i % 6) + 3}-04`] as [string, string]),
    );
    expect(customerReliability("thabo", extractHistory([eight]).payments).confidence).toBe("HIGH");
  });

  it("learns: recording more late payments increases the predicted delay", () => {
    const early = pastOrder("h4", "thabo", [
      ["2026-08-03", "2026-08-05"],
      ["2026-09-03", "2026-09-05"],
    ]);
    expect(customerReliability("thabo", extractHistory([early]).payments).shiftDays).toBe(2);

    const later = pastOrder("h5", "thabo", [
      ["2026-10-01", "2026-10-11"],
      ["2026-10-15", "2026-10-27"],
    ]);
    expect(customerReliability("thabo", extractHistory([early, later]).payments).shiftDays).toBe(6);
  });
});

describe("Payday pattern", () => {
  // Payments arrive on time but always between the 25th and the 1st.
  const paydayHistory = pastOrder("h6", "lindiwe", [
    ["2026-06-26", "2026-06-26"],
    ["2026-07-27", "2026-07-27"],
    ["2026-08-28", "2026-08-28"],
    ["2026-09-30", "2026-09-30"],
    ["2026-10-01", "2026-10-01"],
  ]);

  it("detects when most payments land in the month-end window", () => {
    const p = paydayPattern(extractHistory([paydayHistory]).payments, 25);
    expect(p.shareInWindow).toBe(1);
    expect(p.active).toBe(true);
  });

  it("moves a mid-month payment to the next window for a customer without strong history", () => {
    const order = baseOrder({ customerId: "newbie" });
    const { input, predictions } = applyPredictions(makeInput({ openingRands: 5000, proposed: order, orders: [paydayHistory] }));
    expect(input.proposedOrder!.payments.find((p) => p.id === "bal")!.expectedDate).toBe("2026-11-25");
    expect(predictions[0].kind).toBe("PAYDAY_PATTERN");
  });

  it("keeps dates already inside the window", () => {
    expect(nextPaydayWindowStart("2026-11-27", 25)).toBe("2026-11-27");
    expect(nextPaydayWindowStart("2026-12-01", 25)).toBe("2026-12-01");
    expect(nextPaydayWindowStart("2026-12-02", 25)).toBe("2026-12-25");
  });

  it("does not override a strong customer-specific prediction", () => {
    const { predictions } = applyPredictions(makeInput({ openingRands: 5000, orders: [thaboHistory, paydayHistory] }));
    const balPrediction = predictions.find((p) => p.paymentId === "bal")!;
    expect(balPrediction.kind).toBe("CUSTOMER_LATENESS");
  });
});

describe("Cost estimate bias and drift", () => {
  const costHistory = pastOrder(
    "h7",
    "lindiwe",
    [["2026-09-01", "2026-09-01"]],
    Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      description: "Packaging",
      category: "PACKAGING" as const,
      estimatedCents: rand(1000),
      dueDate: "2026-09-01",
      dateCertainty: "CONFIRMED" as const,
      paidDate: `2026-09-${String(i + 10).padStart(2, "0")}`,
      paidCents: rand(1080),
    })),
  );

  it("learns that actual costs run 8% above estimates and adds R256 to R3 200", () => {
    const bias = costEstimateBias(extractHistory([costHistory]).costs);
    expect(bias.active).toBe(true);
    expect(Math.round(bias.biasRatio * 100)).toBe(8);

    const { input, predictions } = applyPredictions(makeInput({ openingRands: 5000, orders: [costHistory] }));
    expect(input.proposedOrder!.costs[0].estimatedCents).toBe(rand(3456));
    const p = predictions.find((x) => x.kind === "COST_BIAS")!;
    expect(p.extraCents).toBe(rand(256));
    expect(p.reason).toMatch(/adds R256/);
  });

  it("needs at least 4 paid costs before adjusting", () => {
    const few = { ...costHistory, costs: costHistory.costs.slice(0, 3) };
    expect(costEstimateBias(extractHistory([few]).costs).active).toBe(false);
  });

  it("warns when a cost is more than 15% above the usual for its category", () => {
    const ingredientHistory = pastOrder(
      "h8",
      "lindiwe",
      [["2026-09-01", "2026-09-01"]],
      [2500, 2600, 2700, 2800, 2750].map((r, i) => ({
        id: `i${i}`,
        description: "Ingredients",
        category: "INGREDIENTS" as const,
        estimatedCents: rand(r),
        dueDate: "2026-09-01",
        dateCertainty: "CONFIRMED" as const,
        paidDate: `2026-10-0${i + 1}`,
        paidCents: rand(r),
      })),
    );
    const warnings = costDriftWarnings(baseOrder(), extractHistory([ingredientHistory]).costs);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].medianCents).toBe(rand(2700));
    expect(warnings[0].pctAbove).toBe(19);
  });
});
