/** The first-run checklist shown on home until a new business has done the basics. */
import type { BusinessContext } from "./repo";

export interface OnboardingStep {
  key: "business" | "payment" | "order" | "record";
  title: string;
  detail: string;
  href: string;
  done: boolean;
}

export function onboardingSteps(ctx: BusinessContext): OnboardingStep[] {
  const anyRecorded = ctx.orders.some((o) => o.payments.some((p) => p.kind !== "DEPOSIT" && p.receivedDate));
  return [
    { key: "business", title: "Tell Chrono about your business", detail: "Your cash today and your safety buffer.", href: "/settings", done: true },
    { key: "payment", title: "Add your regular payments", detail: "Rent, stock, transport, data. Anything that leaves every week or month.", href: "/commitments", done: ctx.commitments.length > 0 },
    { key: "order", title: "Check your first order", detail: "See if you can afford it before you say yes.", href: "/orders/new", done: ctx.orders.length > 0 },
    { key: "record", title: "Record a customer payment", detail: "When money comes in, mark it. Chrono learns how each customer really pays.", href: "/home", done: anyRecorded },
  ];
}

export function onboardingComplete(steps: OnboardingStep[]): boolean {
  return steps.every((s) => s.done);
}
