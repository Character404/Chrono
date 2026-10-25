"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBusiness, requireUser } from "@/lib/auth/guards";
import { destroySession } from "@/lib/auth/session";
import { DEMO_EMAIL } from "@/lib/demo/demo-data";
import { isoToDate } from "@/lib/data/convert";
import { todayInJohannesburg } from "@/lib/engine/dates";
import { parseRandInput } from "@/lib/engine/money";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your business name.").max(80),
  type: z.string().trim().max(80),
  buffer: z.string(),
  cash: z.string(),
});

/** Updates the signed-in user's own business. Cash on hand is optional: blank keeps the current figure. */
export async function updateBusiness(formData: FormData) {
  const { business } = await requireBusiness();
  const fail = (m: string): never => redirect(`/settings?error=${encodeURIComponent(m)}`);
  const parsed = schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") ?? "",
    buffer: formData.get("buffer") ?? "",
    cash: formData.get("cash") ?? "",
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check your details.");
  const data = parsed.data!;

  const buffer = parseRandInput(data.buffer);
  if (buffer === null) fail("Enter a safety buffer in rands, for example 500. Use 0 for no buffer.");
  if (buffer! > 100_000_000) fail("That safety buffer looks too large.");

  const update: { name: string; type: string; safetyBufferCents: number; openingCashCents?: number; openingCashDate?: Date } = {
    name: data.name,
    type: data.type,
    safetyBufferCents: buffer!,
  };
  if (data.cash.trim() !== "") {
    const cash = parseRandInput(data.cash);
    if (cash === null) fail("Enter today's cash in rands, for example 4500.");
    // Cash on hand restarts the forecast from today with the new figure.
    update.openingCashCents = cash!;
    update.openingCashDate = isoToDate(todayInJohannesburg());
  }

  await prisma.business.update({ where: { id: business.id }, data: update });
  revalidatePath("/home");
  redirect("/settings?saved=1");
}

/**
 * Permanently deletes the signed-in user and everything they own (POPIA: right to erasure).
 * Database relations cascade: sessions, business, customers, orders, payments, costs,
 * commitments and quote links are all removed.
 */
export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    redirect(`/settings?error=${encodeURIComponent('Type DELETE to confirm.')}`);
  }
  if (user.email === DEMO_EMAIL) {
    redirect(`/settings?error=${encodeURIComponent("The shared demo record can't be deleted.")}`);
  }
  await destroySession();
  await prisma.user.delete({ where: { id: user.id } });
  redirect("/login?deleted=1");
}
