"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { isoToDate } from "@/lib/data/convert";
import { todayInJohannesburg } from "@/lib/engine/dates";
import { parseRandInput } from "@/lib/engine/money";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your business name.").max(80),
  type: z.string().trim().max(80),
  cash: z.string(),
  buffer: z.string(),
});

export async function setupBusiness(formData: FormData) {
  const user = await requireUser();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") ?? "",
    cash: formData.get("cash") ?? "",
    buffer: formData.get("buffer") ?? "",
  });
  const fail = (m: string): never => redirect(`/setup?error=${encodeURIComponent(m)}`);
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check your details.");
  const data = parsed.data!;

  const cash = parseRandInput(data.cash);
  if (cash === null) fail("Enter how much cash the business has today, for example 4500.");
  const buffer = data.buffer.trim() === "" ? 50000 : parseRandInput(data.buffer);
  if (buffer === null) fail("Enter a safety buffer in rands, for example 500.");

  const existing = await prisma.business.findUnique({ where: { userId: user.id } });
  if (!existing) {
    await prisma.business.create({
      data: {
        userId: user.id,
        name: data.name,
        type: data.type,
        openingCashCents: cash!,
        openingCashDate: isoToDate(todayInJohannesburg()),
        safetyBufferCents: buffer!,
      },
    });
  }
  redirect("/home");
}
