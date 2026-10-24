"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "@/lib/auth/rate-limit";
import { createSession, destroySession } from "@/lib/auth/session";
import { ensureDemoUser } from "@/lib/demo/seed-demo";
import { todayInJohannesburg } from "@/lib/engine/dates";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
});

function back(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) back("/login", "Enter your email and password.");
  const { email, password } = parsed.data;

  if (isLoginBlocked(email)) back("/login", "Too many attempts. Wait 15 minutes, then try again.");

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    recordLoginFailure(email);
    back("/login", "That email and password don't match.");
  }
  clearLoginFailures(email);
  await createSession(user.id);
  redirect("/home");
}

export async function signup(formData: FormData) {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) back("/signup", parsed.error.issues[0]?.message ?? "Check your details.");
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) back("/signup", "There's already an account with that email. Log in instead.");

  const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  redirect("/setup");
}

export async function demoLogin() {
  const user = await ensureDemoUser(prisma, todayInJohannesburg());
  await createSession(user.id);
  redirect("/home");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
