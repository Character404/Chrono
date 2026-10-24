"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { isISODate } from "@/lib/engine/dates";
import { parseRandInput } from "@/lib/engine/money";

const schema = z.object({
  description: z.string().trim().min(1, "Describe the commitment, like \"Rent\".").max(80),
  direction: z.enum(["IN", "OUT"]),
  amount: z.string(),
  startDate: z.string().refine(isISODate, "Choose the date it's next due."),
  recurrence: z.enum(["NONE", "WEEKLY", "MONTHLY"]),
  endDate: z.string(),
});

export async function addCommitment(formData: FormData) {
  const { business } = await requireBusiness();
  const fail = (m: string): never => redirect(`/commitments?error=${encodeURIComponent(m)}`);
  const parsed = schema.safeParse({
    description: formData.get("description"),
    direction: formData.get("direction"),
    amount: formData.get("amount") ?? "",
    startDate: formData.get("startDate") ?? "",
    recurrence: formData.get("recurrence"),
    endDate: formData.get("endDate") ?? "",
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const data = parsed.data!;
  const amountCents = parseRandInput(data.amount);
  if (!amountCents) fail("Enter an amount in rands, for example 2500.");
  const endDate = data.endDate.trim() || null;
  if (endDate && (!isISODate(endDate) || endDate < data.startDate)) fail("The end date must be after the start date.");

  await createRepo(prisma).createCommitment(business.id, {
    description: data.description,
    direction: data.direction,
    amountCents: amountCents!,
    startDate: data.startDate,
    recurrence: data.recurrence,
    endDate,
  });
  revalidatePath("/commitments");
  revalidatePath("/home");
  redirect("/commitments");
}

export async function removeCommitment(formData: FormData) {
  const { business } = await requireBusiness();
  await createRepo(prisma).deleteCommitment(business.id, String(formData.get("id") ?? ""));
  revalidatePath("/commitments");
  revalidatePath("/home");
  redirect("/commitments");
}
