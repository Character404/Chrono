import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "./session";

/** Redirects to the login page when nobody is signed in. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirects to login, or to business setup when the user has no business yet. */
export async function requireBusiness() {
  const user = await requireUser();
  if (user.role === "CUSTOMER") redirect("/shop");
  const business = await prisma.business.findUnique({ where: { userId: user.id } });
  if (!business) redirect("/setup");
  return { user, business };
}
