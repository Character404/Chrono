import { describe, expect, it } from "vitest";
import { draftToOrderInput, parseDraftJson, validateDraft, validateDraftStep, type OrderDraft } from "../order-draft";
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

describe("Order form steps", () => {
  const empty: OrderDraft = {
    customerId: null,
    newCustomerName: "",
    title: "",
    valueCents: 0,
    deposit: { amountCents: 0, date: "2026-10-24" },
    balance: { date: "2026-10-31", certainty: "ESTIMATED" },
    costs: [],
  };

  it("won't leave step 1 without a customer, an order name and a total", () => {
    const errors = validateDraftStep(empty, 0);
    expect(errors.length).toBe(3);
    expect(validateDraftStep({ ...empty, newCustomerName: "Thabo", title: "Wedding", valueCents: 500000 }, 0)).toEqual([]);
  });

  it("checks the deposit on step 2 only", () => {
    const filled = { ...empty, newCustomerName: "Thabo", title: "Wedding", valueCents: 500000 };
    expect(validateDraftStep(filled, 1)).toEqual([]);
    expect(validateDraftStep({ ...filled, deposit: { amountCents: 900000, date: "2026-10-24" } }, 1)).toEqual(["The deposit can't be more than the order value."]);
    expect(validateDraftStep({ ...filled, deposit: { amountCents: 900000, date: "2026-10-24" } }, 0)).toEqual([]);
  });

  it("checks costs on step 3", () => {
    const filled = { ...empty, newCustomerName: "Thabo", title: "Wedding", valueCents: 500000, costs: [{ description: "", amountCents: 0, category: "MATERIALS", date: "2026-10-26", certainty: "ESTIMATED" }] } as unknown as OrderDraft;
    expect(validateDraftStep(filled, 2).length).toBe(2);
    expect(validateDraftStep(filled, 0)).toEqual([]);
  });
});
