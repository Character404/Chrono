/**
 * The order the owner is building in the order check wizard.
 * Shared by the browser (live forecast) and the server (saving), so both
 * always agree on what the order means.
 */
import { isISODate, type ISODate } from "../engine/dates";
import { isCents, type Cents } from "../engine/money";
import type { CostCategory, DateCertainty, OrderInput, OrderStatus } from "../engine/types";

export interface DraftCost {
  key: string;
  description: string;
  category: CostCategory;
  amountCents: Cents;
  date: ISODate | null;
  certainty: DateCertainty;
}

export interface OrderDraft {
  /** An existing customer, or null when `newCustomerName` is used. */
  customerId: string | null;
  newCustomerName: string | null;
  title: string;
  valueCents: Cents;
  deposit: { amountCents: Cents; date: ISODate };
  /** The balance is always the order value minus the deposit. */
  balance: { date: ISODate | null; certainty: DateCertainty };
  costs: DraftCost[];
}

export const COST_CATEGORIES: CostCategory[] = ["INGREDIENTS", "MATERIALS", "PACKAGING", "TRANSPORT", "LABOUR", "OTHER"];
export const CERTAINTIES: DateCertainty[] = ["CONFIRMED", "ESTIMATED", "UNKNOWN"];

export const CATEGORY_LABEL: Record<CostCategory, string> = {
  INGREDIENTS: "Ingredients",
  MATERIALS: "Materials",
  PACKAGING: "Packaging",
  TRANSPORT: "Transport",
  LABOUR: "Helpers / labour",
  OTHER: "Other",
};

export const CERTAINTY_LABEL: Record<DateCertainty, string> = {
  CONFIRMED: "Confirmed",
  ESTIMATED: "Estimated",
  UNKNOWN: "Not sure",
};

export function balanceCents(draft: OrderDraft): Cents {
  return draft.valueCents - draft.deposit.amountCents;
}

/** Plain-language problems with the draft; empty when it can be saved. */
export function validateDraft(draft: OrderDraft): string[] {
  const errors: string[] = [];
  if (!draft.customerId && !draft.newCustomerName?.trim()) errors.push("Choose a customer or type a new customer's name.");
  if (!draft.title.trim()) errors.push("Give the order a short name, like \"Wedding catering\".");
  if (draft.title.length > 80) errors.push("Keep the order name under 80 characters.");
  if (!isCents(draft.valueCents) || draft.valueCents <= 0) errors.push("Enter what the customer will pay in total.");
  if (!isCents(draft.deposit.amountCents) || draft.deposit.amountCents < 0) errors.push("The deposit can't be negative.");
  if (draft.deposit.amountCents > draft.valueCents) errors.push("The deposit can't be more than the order value.");
  if (!isISODate(draft.deposit.date)) errors.push("Choose when the deposit will be paid.");
  if (balanceCents(draft) > 0 && draft.balance.certainty !== "UNKNOWN" && !isISODate(draft.balance.date ?? "")) {
    errors.push("Choose when the balance will be paid, or mark the date as not sure.");
  }
  draft.costs.forEach((c, i) => {
    const label = c.description.trim() || `Cost ${i + 1}`;
    if (!c.description.trim()) errors.push(`Describe cost ${i + 1}, like "Ingredients".`);
    if (!isCents(c.amountCents) || c.amountCents <= 0) errors.push(`Enter an amount for ${label}.`);
    if (!COST_CATEGORIES.includes(c.category)) errors.push(`Choose a type for ${label}.`);
    if (c.certainty !== "UNKNOWN" && !isISODate(c.date ?? "")) errors.push(`Choose when ${label} must be paid, or mark the date as not sure.`);
  });
  if (draft.costs.length > 20) errors.push("Add at most 20 costs per order.");
  return errors;
}

/** Converts a draft into the engine's order shape. */
export function draftToOrderInput(draft: OrderDraft, opts: { id: string; customerId: string; status?: OrderStatus }): OrderInput {
  const payments: OrderInput["payments"] = [];
  if (draft.deposit.amountCents > 0) {
    payments.push({ id: `${opts.id}-deposit`, kind: "DEPOSIT", amountCents: draft.deposit.amountCents, expectedDate: draft.deposit.date, dateCertainty: "CONFIRMED" });
  }
  const balance = balanceCents(draft);
  if (balance > 0) {
    const unknown = draft.balance.certainty === "UNKNOWN" || !draft.balance.date;
    payments.push({
      id: `${opts.id}-balance`,
      kind: "BALANCE",
      amountCents: balance,
      expectedDate: unknown ? null : draft.balance.date,
      dateCertainty: unknown ? "UNKNOWN" : draft.balance.certainty,
    });
  }
  return {
    id: opts.id,
    customerId: opts.customerId,
    title: draft.title.trim() || "New order",
    valueCents: draft.valueCents,
    status: opts.status ?? "DRAFT",
    payments,
    costs: draft.costs.map((c) => {
      const unknown = c.certainty === "UNKNOWN" || !c.date;
      return {
        id: `${opts.id}-${c.key}`,
        description: c.description.trim() || "Cost",
        category: c.category,
        estimatedCents: c.amountCents,
        dueDate: unknown ? null : c.date,
        dateCertainty: unknown ? "UNKNOWN" : c.certainty,
      };
    }),
  };
}

/** Parses the JSON the wizard posts. Returns null if the shape is wrong. */
export function parseDraftJson(json: string): OrderDraft | null {
  try {
    const raw = JSON.parse(json);
    if (!raw || typeof raw !== "object") return null;
    const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
    const num = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) ? v : -1);
    const date = (v: unknown) => (typeof v === "string" && isISODate(v) ? v : null);
    const certainty = (v: unknown): DateCertainty => (CERTAINTIES.includes(v as DateCertainty) ? (v as DateCertainty) : "ESTIMATED");
    const costs = Array.isArray(raw.costs) ? raw.costs.slice(0, 21) : [];
    return {
      customerId: typeof raw.customerId === "string" && raw.customerId ? raw.customerId.slice(0, 64) : null,
      newCustomerName: typeof raw.newCustomerName === "string" ? raw.newCustomerName.slice(0, 80) : null,
      title: str(raw.title, 81),
      valueCents: num(raw.valueCents),
      deposit: { amountCents: num(raw.deposit?.amountCents), date: date(raw.deposit?.date) ?? "" },
      balance: { date: date(raw.balance?.date), certainty: certainty(raw.balance?.certainty) },
      costs: costs.map((c: Record<string, unknown>, i: number) => ({
        key: `c${i + 1}`,
        description: str(c?.description, 80),
        category: COST_CATEGORIES.includes(c?.category as CostCategory) ? (c.category as CostCategory) : "OTHER",
        amountCents: num(c?.amountCents),
        date: date(c?.date),
        certainty: certainty(c?.certainty),
      })),
    };
  } catch {
    return null;
  }
}

/** Which wizard step each check belongs to: 0 = the order, 1 = getting paid, 2 = costs. */
const STEP_OF_ERROR: [RegExp, number][] = [
  [/customer|order a short name|order name|in total/i, 0],
  [/deposit|balance/i, 1],
];

/** Only the problems on one step of the order form, so Next can stop on that step. */
export function validateDraftStep(draft: OrderDraft, step: number): string[] {
  return validateDraft(draft).filter((e) => (STEP_OF_ERROR.find(([re]) => re.test(e))?.[1] ?? 2) === step);
}
