import { describe, expect, it } from "vitest";
import { analyzeOrder } from "../analyze";
import { buildCashStory } from "../story";
import { buildDemoData, demoWeddingInput } from "../../demo/demo-data";
import { makeInput } from "./fixtures";

describe("Cash story", () => {
  const today = "2026-10-24";
  const input = demoWeddingInput(buildDemoData(today), today);
  const story = buildCashStory(input, analyzeOrder(input));

  it("says in plain words when the money runs out and why", () => {
    expect(story.headline).toMatch(/^If you take this order, you'll run out of money on .+, \d+ days before Thabo pays you\.$/);
    expect(story.summary).toMatch(/^Thabo wants wedding catering for R5 000\. R1 000 deposit now, then R4 000 on/);
  });

  it("names every cause squeezing cash, not just late payment", () => {
    const keys = story.squeeze.map((s) => s.key);
    expect(keys).toContain("TIMING");
    expect(keys).toContain("LATE");
    expect(keys).toContain("COSTS_OVER");
    expect(keys).toContain("BILLS");
    expect(keys).toContain("OTHER_ORDERS");
  });

  it("marks the exact moment the money runs out and when it recovers", () => {
    const out = story.timeline.find((r) => r.runsOut)!;
    expect(out.balanceAfterCents).toBeGreaterThan(-100000);
    expect(out.balanceAfterCents < 0).toBe(true);
    expect(out.label).toBe("Rent");
    const back = story.timeline.find((r) => r.recovers)!;
    expect(back.label).toBe("Thabo pays the balance");
    expect(back.note).toMatch(/usually pays about 7 days late/);
  });

  it("picks three key moments: the big cost, running out, and the late payment", () => {
    expect(story.keyMoments.map((r) => r.label)).toEqual(["Ingredients for this order", "Rent", "Thabo pays the balance"]);
    expect(story.keyMoments[1].runsOut).toBe(true);
  });

  it("explains adjusted costs", () => {
    const ing = story.timeline.find((r) => r.label === "Ingredients for this order")!;
    expect(ing.note).toMatch(/You entered R3 200/);
  });

  it("keeps amounts together in running text", async () => {
    const { keepAmountsTogether } = await import("../money");
    expect(keepAmountsTogether("pay R5 000 and R12 300 500 now")).toBe("pay R5\u00a0000 and R12\u00a0300\u00a0500 now");
    expect(keepAmountsTogether("R600 only")).toBe("R600 only");
  });

  it("gives a calm headline when the order is safe", () => {
    const safe = makeInput({ openingRands: 5000 });
    const s = buildCashStory(safe, analyzeOrder(safe));
    expect(s.headline).toMatch(/^You can afford this order/);
    expect(s.squeeze).toHaveLength(0);
  });
});
