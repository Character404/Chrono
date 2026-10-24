import { describe, expect, it } from "vitest";
import { commitmentDates, EngineValidationError, findDuplicateCost, forecast, validateOrder } from "../forecast";
import { recommendDeposit, withDeposit } from "../deposit";
import { analyzeOrder } from "../analyze";
import { formatRand, rand } from "../money";
import { formatShortDate } from "../dates";
import { baseOrder, day, makeInput, rent, TODAY } from "./fixtures";

describe("Scenario 1: enough cash throughout", () => {
  it("opening cash R5 000 stays Safe with a R2 800 low point", () => {
    const r = forecast(makeInput({ openingRands: 5000 }));
    expect(r.minBalanceCents).toBe(rand(2800));
    expect(r.minBalanceDate).toBe(day(1));
    expect(r.verdict).toBe("SAFE");
    expect(r.shortfall).toBeNull();
    expect(r.profitCents).toBe(rand(1800));
    expect(r.profitMarginPct).toBe(36);
  });
});

describe("Scenario 2: profitable order with a temporary shortfall", () => {
  it("opening cash R2 000 goes R200 short from day 1 for 6 days", () => {
    const r = forecast(makeInput({ openingRands: 2000 }));
    expect(r.minBalanceCents).toBe(rand(-200));
    expect(r.verdict).toBe("SHORTFALL");
    expect(r.shortfall).not.toBeNull();
    expect(r.shortfall!.amountCents).toBe(rand(200));
    expect(r.shortfall!.firstDate).toBe(day(1));
    expect(r.shortfall!.daysBelowZero).toBe(6);
    expect(r.shortfall!.causes[0].name).toBe("Ingredients");
    expect(r.profitCents).toBe(rand(1800));
    expect(r.notProfitable).toBe(false);
  });
});

describe("Scenario 3: a larger deposit removes the shortfall", () => {
  it("a R1 200 deposit makes it Safe with no buffer", () => {
    const input = makeInput({ openingRands: 2000 });
    const order = withDeposit(input.proposedOrder!, rand(1200), TODAY);
    expect(order.payments.find((p) => p.kind === "BALANCE")!.amountCents).toBe(rand(3800));
    expect(forecast({ ...input, proposedOrder: order }).verdict).toBe("SAFE");
  });

  it("recommends R1 200 with no buffer", () => {
    const rec = recommendDeposit(makeInput({ openingRands: 2000 }));
    expect(rec.status).toBe("INCREASE");
    expect(rec.recommendedCents).toBe(rand(1200));
  });

  it("recommends R1 700 with a R500 buffer", () => {
    const rec = recommendDeposit(makeInput({ openingRands: 2000, bufferRands: 500 }));
    expect(rec.recommendedCents).toBe(rand(1700));
  });

  it("says the current deposit is enough when it already works", () => {
    const rec = recommendDeposit(makeInput({ openingRands: 5000 }));
    expect(rec.status).toBe("ALREADY_ENOUGH");
  });
});

describe("Scenario 5: multiple orders competing for the same cash", () => {
  const orderA = baseOrder({
    id: "orderA",
    customerId: "lindiwe",
    title: "Birthday cake",
    status: "ACCEPTED",
    valueCents: rand(3000),
    payments: [{ id: "a-bal", kind: "BALANCE", amountCents: rand(3000), expectedDate: day(12), dateCertainty: "ESTIMATED" }],
    costs: [{ id: "a-cost", description: "Cake supplies", category: "INGREDIENTS", estimatedCents: rand(2500), dueDate: day(2), dateCertainty: "CONFIRMED" }],
  });

  it("an accepted order's costs make the new order Tight", () => {
    const r = forecast(makeInput({ openingRands: 5000, bufferRands: 500, orders: [orderA] }));
    expect(r.minBalanceCents).toBe(rand(300));
    expect(r.minBalanceDate).toBe(day(2));
    expect(r.verdict).toBe("TIGHT");
  });

  it("without the accepted order it is Safe", () => {
    expect(forecast(makeInput({ openingRands: 5000, bufferRands: 500 })).verdict).toBe("SAFE");
  });

  it("declined and draft orders are ignored", () => {
    const declined = { ...orderA, id: "declined", status: "DECLINED" as const };
    const draft = { ...orderA, id: "draft", status: "DRAFT" as const };
    expect(forecast(makeInput({ openingRands: 5000, bufferRands: 500, orders: [declined, draft] })).verdict).toBe("SAFE");
  });
});

describe("Scenario 6: an expense entered twice", () => {
  it("flags the duplicate, and deleting it restores the single-entry forecast", () => {
    const single = baseOrder();
    const dup = { ...single.costs[0], id: "ing-2" };
    expect(findDuplicateCost(single.costs, dup)?.id).toBe("ing");

    const doubled = baseOrder({ costs: [...single.costs, dup] });
    const doubledResult = forecast(makeInput({ openingRands: 5000, proposed: doubled }));
    expect(doubledResult.minBalanceCents).toBe(rand(-400));

    const fixed = baseOrder({ costs: doubled.costs.filter((c) => c.id !== "ing-2") });
    const a = forecast(makeInput({ openingRands: 5000, proposed: fixed }));
    const b = forecast(makeInput({ openingRands: 5000, proposed: single }));
    expect(a.series).toEqual(b.series);
    expect(a.verdict).toBe(b.verdict);
  });

  it("does not flag a different amount or a date more than a day apart", () => {
    const costs = baseOrder().costs;
    expect(findDuplicateCost(costs, { ...costs[0], id: "x", estimatedCents: rand(3100) })).toBeNull();
    expect(findDuplicateCost(costs, { ...costs[0], id: "y", dueDate: day(4) })).toBeNull();
  });
});

describe("Scenario 7: missing or uncertain dates", () => {
  it("puts an undated cost on today, leaves an undated balance out, and is not Safe", () => {
    const order = baseOrder({
      payments: [
        { id: "dep", kind: "DEPOSIT", amountCents: rand(1000), expectedDate: day(0), dateCertainty: "CONFIRMED" },
        { id: "bal", kind: "BALANCE", amountCents: rand(4000), expectedDate: null, dateCertainty: "UNKNOWN" },
      ],
      costs: [{ id: "ing", description: "Ingredients", category: "INGREDIENTS", estimatedCents: rand(3200), dueDate: null, dateCertainty: "UNKNOWN" }],
    });
    const r = forecast(makeInput({ openingRands: 2000, proposed: order }));
    const cost = r.events.find((e) => e.refId === "ing")!;
    expect(cost.date).toBe(TODAY);
    expect(cost.flags).toContain("COST_DATE_ASSUMED_TODAY");
    expect(r.events.some((e) => e.refId === "bal")).toBe(false);
    expect(r.uncounted).toHaveLength(1);
    expect(r.uncounted[0].amountCents).toBe(rand(4000));
    expect(r.verdict).not.toBe("SAFE");
    expect(r.assumptions.join(" ")).toMatch(/no date/);
  });
});

describe("Edge cases", () => {
  it("applies money out before money in on the same day", () => {
    const order = baseOrder({
      costs: [{ id: "ing", description: "Ingredients", category: "INGREDIENTS", estimatedCents: rand(1500), dueDate: day(0), dateCertainty: "CONFIRMED" }],
    });
    const r = forecast(makeInput({ openingRands: 1000, proposed: order }));
    expect(r.series[0].balanceAfterOutCents).toBe(rand(-500));
    expect(r.series[0].balanceEndCents).toBe(rand(500));
    expect(r.verdict).toBe("SHORTFALL");
  });

  it("puts a monthly commitment on the 31st on the last day of a 30-day month", () => {
    const dates = commitmentDates(rent(2500, "2026-10-31", "MONTHLY"), "2026-11-01", "2027-01-31");
    expect(dates).toEqual(["2026-11-30", "2026-12-31", "2027-01-31"]);
  });

  it("expands weekly commitments from their start date", () => {
    const dates = commitmentDates(rent(300, "2026-11-02", "WEEKLY"), TODAY, day(14));
    expect(dates).toEqual([day(0), day(7), day(14)]);
  });

  it("rejects payments that don't add up to the order value", () => {
    const bad = baseOrder({ valueCents: rand(6000) });
    expect(validateOrder(bad).length).toBeGreaterThan(0);
    expect(() => forecast(makeInput({ openingRands: 5000, proposed: bad }))).toThrow(EngineValidationError);
  });

  it("returns cannot-fix when even a 100% deposit can't close the gap", () => {
    const r = recommendDeposit(makeInput({ openingRands: 500, commitments: [rent(3000, day(0))] }));
    expect(r.status).toBe("CANNOT_FIX");
    expect(r.recommendedCents).toBeNull();
  });

  it("counts recorded payments and costs in the starting balance", () => {
    const done = baseOrder({
      id: "done",
      status: "COMPLETED",
      payments: [
        { id: "d1", kind: "DEPOSIT", amountCents: rand(1000), expectedDate: TODAY, dateCertainty: "CONFIRMED", receivedDate: TODAY },
        { id: "d2", kind: "BALANCE", amountCents: rand(4000), expectedDate: TODAY, dateCertainty: "CONFIRMED", receivedDate: TODAY },
      ],
      costs: [{ id: "d3", description: "Ingredients", category: "INGREDIENTS", estimatedCents: rand(3200), dueDate: TODAY, dateCertainty: "CONFIRMED", paidDate: TODAY, paidCents: rand(3300) }],
    });
    const r = forecast(makeInput({ openingRands: 1000, proposed: null, orders: [done] }));
    expect(r.startingBalanceCents).toBe(rand(1000 + 5000 - 3300));
  });

  it("is deterministic", () => {
    const input = makeInput({ openingRands: 2000 });
    expect(forecast(input)).toEqual(forecast(input));
  });
});

describe("Explanations", () => {
  it("explains a shortfall in plain language with real numbers", () => {
    const a = analyzeOrder(makeInput({ openingRands: 2000, bufferRands: 500 }));
    expect(a.explanation.headline).toBe(`You'll be R200 short from ${formatShortDate(day(1))} for 6 days.`);
    expect(a.explanation.lines).toContain("Ingredients (R3 200) is due before the customer's balance (R4 000) arrives.");
    expect(a.explanation.lines).toContain("Ask for a deposit of at least R1 700 and you stay above your R500 safety buffer.");
    expect(a.explanation.lines).toContain("This order makes R1 800 profit (36%). Cash timing is the risk, not profit.");
  });

  it("formats money South African style", () => {
    expect(formatRand(rand(5000))).toBe("R5 000");
    expect(formatRand(rand(1234.5))).toBe("R1 234,50");
    expect(formatRand(rand(-200))).toBe("−R200");
  });
});
