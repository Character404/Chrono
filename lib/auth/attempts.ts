import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { shouldBlock, WINDOW_MS } from "./rate-limit";

/** Only a SHA-256 hash of the email is stored, never the email itself. */
function keyHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function isLoginBlocked(email: string): Promise<boolean> {
  const recent = await prisma.loginAttempt.count({ where: { keyHash: keyHash(email), createdAt: { gte: new Date(Date.now() - WINDOW_MS) } } });
  return shouldBlock(recent);
}

export async function recordLoginFailure(email: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { keyHash: keyHash(email) } });
  // Housekeeping: attempts older than a day are no longer needed.
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
}

export async function clearLoginFailures(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { keyHash: keyHash(email) } });
}
