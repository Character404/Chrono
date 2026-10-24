import { describe, expect, it } from "vitest";
import { draftToOrderInput, parseDraftJson, validateDraft, type OrderDraft } from "../order-draft";
import { validateOrder } from "../../engine/forecast";

const draft: OrderDraft = {
  customerId: "thabo",
  newCustomerName: null,
  title: "Wedding catering",
  valueCents: 500000,
  deposit: { amountCents: 100000, date: "2026-11-09" },
  balance: { date: "2026-11-16", certainty: "ESTIMATED" },
  costs: [{ key: "c1", description: "Ingredients", category: "INGREDIENTS", amountCents: 320000, date: "2026-11-10", certainty: "CONFIRMED" }],
};

describe("Order drafts", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(draft)).toEqual([]);
  });

  it("explains what's missing in plain language", () => {
    const errors = validateDraft({ ...draft, customerId: null, title: "", valueCents: 0 });
    expect(errors.join(" ")).toMatch(/Choose a customer/);
    expect(errors.join(" ")).toMatch(/short name/);
    expect(errors.join(" ")).toMatch(/in total/);
  });

  it("rejects a deposit bigger than the order", () => {
    expect(validateDraft({ ...draft, deposit: { amountCents: 600000, date: "2026-11-09" } }).join(" ")).toMatch(/deposit can't be more/);
  });

  it("turns a draft into a valid engine order whose payments add up", () => {
    const o = draftToOrderInput(draft, { id: "x", customerId: "thabo" });
    expect(validateOrder(o)).toEqual([]);
    expect(o.payments.map((p) => p.amountCents)).toEqual([100000, 400000]);
  });

  it("handles a zero deposit and an unknown balance date", () => {
    const o = draftToOrderInput({ ...draft, deposit: { amountCents: 0, date: "2026-11-09" }, balance: { date: null, certainty: "UNKNOWN" } }, { id: "x", customerId: "t" });
    expect(o.payments).toHaveLength(1);
    expect(o.payments[0].expectedDate).toBeNull();
    expect(validateOrder(o)).toEqual([]);
  });

  it("parses posted JSON safely and rejects garbage", () => {
    expect(parseDraftJson(JSON.stringify(draft))?.valueCents).toBe(500000);
    expect(parseDraftJson("not json")).toBeNull();
    const evil = parseDraftJson(JSON.stringify({ ...draft, valueCents: "500000", costs: [{ category: "HACK" }] }))!;
    expect(evil.valueCents).toBe(-1);
    expect(evil.costs[0].category).toBe("OTHER");
    expect(validateDraft(evil).length).toBeGreaterThan(0);
  });
});
