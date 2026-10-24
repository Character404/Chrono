"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { orderRowToInput } from "@/lib/data/convert";
import { newQuoteToken } from "@/lib/data/quote-token";
import { addDays, isISODate, todayInJohannesburg } from "@/lib/engine/dates";
import { withDeposit } from "@/lib/engine/deposit";
import { validateOrder } from "@/lib/engine/forecast";
import { parseRandInput } from "@/lib/engine/money";

function orderUrl(orderId: string, error?: string) {
  return error ? `/orders/${orderId}?error=${encodeURIComponent(error)}` : `/orders/${orderId}`;
}

function refresh(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/home");
  revalidatePath("/customers");
}

/** Records that a customer payment came in (date and amount). */
export async function recordPayment(formData: FormData) {
  const { business } = await requireBusiness();
  const orderId = String(formData.get("orderId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  const date = String(formData.get("date") ?? "");
  const amount = parseRandInput(String(formData.get("amount") ?? ""));
  const today = todayInJohannesburg();
  if (!isISODate(date) || date > today) redirect(orderUrl(orderId, "Choose the date the money came in (today or earlier)."));
  if (!amount) redirect(orderUrl(orderId, "Enter the amount you received."));

  const ok = await createRepo(prisma).recordPaymentReceived(business.id, paymentId, date, amount);
  if (!ok) redirect("/home");
  refresh(orderId);
  redirect(orderUrl(orderId));
}

/** Records that an order cost was paid (date and actual amount). */
export async function recordCost(formData: FormData) {
  const { business } = await requireBusiness();
  const orderId = String(formData.get("orderId") ?? "");
  const costId = String(formData.get("costId") ?? "");
  const date = String(formData.get("date") ?? "");
  const amount = parseRandInput(String(formData.get("amount") ?? ""));
  const today = todayInJohannesburg();
  if (!isISODate(date) || date > today) redirect(orderUrl(orderId, "Choose the date you paid (today or earlier)."));
  if (!amount) redirect(orderUrl(orderId, "Enter the amount you actually paid."));

  const ok = await createRepo(prisma).recordCostPaid(business.id, costId, date, amount);
  if (!ok) redirect("/home");
  refresh(orderId);
  redirect(orderUrl(orderId));
}

/** Marks an accepted order as complete once everything is settled. */
export async function completeOrder(formData: FormData) {
  const { business } = await requireBusiness();
  const orderId = String(formData.get("orderId") ?? "");
  await createRepo(prisma).setOrderStatus(business.id, orderId, "COMPLETED");
  refresh(orderId);
  redirect(orderUrl(orderId));
}

/** Applies a deposit and balance date from the what-if to a draft order. */
export async function applyTerms(formData: FormData) {
  const { business } = await requireBusiness();
  const repo = createRepo(prisma);
  const orderId = String(formData.get("orderId") ?? "");
  const deposit = parseRandInput(String(formData.get("deposit") ?? ""));
  const balanceDate = String(formData.get("balanceDate") ?? "");
  const today = todayInJohannesburg();

  const row = await repo.getOrder(business.id, orderId);
  if (!row || row.status !== "DRAFT") redirect("/home");
  if (deposit === null || deposit > row.valueCents) redirect(orderUrl(orderId, "The deposit must be between R0 and the order value."));
  if (balanceDate && (!isISODate(balanceDate) || balanceDate > addDays(today, 365))) redirect(orderUrl(orderId, "Choose a valid balance date."));

  const updated = withDeposit(orderRowToInput(row), deposit, today);
  const payments = updated.payments.map((p) =>
    p.kind !== "DEPOSIT" && balanceDate ? { ...p, expectedDate: balanceDate, dateCertainty: p.dateCertainty === "UNKNOWN" ? "ESTIMATED" as const : p.dateCertainty } : p,
  );
  if (validateOrder({ ...updated, payments }).length) redirect(orderUrl(orderId, "Those terms don't add up to the order value."));

  await repo.replaceDraftPayments(business.id, orderId, payments);
  refresh(orderId);
  redirect(orderUrl(orderId));
}

/** Creates (or reuses) a public, read-only quote link for an order. */
export async function shareQuote(formData: FormData) {
  const { business } = await requireBusiness();
  const repo = createRepo(prisma);
  const orderId = String(formData.get("orderId") ?? "");
  const existing = await repo.getActiveQuote(business.id, orderId);
  if (!existing) {
    const created = await repo.createQuote(business.id, orderId, newQuoteToken());
    if (!created) redirect("/home");
  }
  refresh(orderId);
  redirect(`${orderUrl(orderId)}#quote`);
}

export async function stopSharingQuote(formData: FormData) {
  const { business } = await requireBusiness();
  const orderId = String(formData.get("orderId") ?? "");
  await createRepo(prisma).revokeQuote(business.id, String(formData.get("quoteId") ?? ""));
  refresh(orderId);
  redirect(`${orderUrl(orderId)}#quote`);
}
