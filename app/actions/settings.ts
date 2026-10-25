"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
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
