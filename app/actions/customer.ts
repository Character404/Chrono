"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { customerTerms, validateCustomerOrder } from "@/lib/data/customer-orders";
import { customerRecordFor, orderableBusiness } from "@/lib/data/marketplace";
import { getListing } from "@/lib/demo/listings";
import { todayInJohannesburg } from "@/lib/engine/dates";

/**
 * A customer places an order with a business on Chrono. The terms are worked out again here on
 * the server (never trusted from the page), from the business's own forecast and this customer's
 * payment history, so the order arrives already checked.
 */
export async function placeOrder(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const offeringId = String(formData.get("item") ?? "");
  const date = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  const back = (message: string): never => redirect(`/shop/${encodeURIComponent(slug)}?item=${encodeURIComponent(offeringId)}&date=${encodeURIComponent(date)}&error=${encodeURIComponent(message)}`);

  const listing = getListing(slug);
  if (!listing || !listing.orderable) back("This business isn't taking orders through Chrono yet.");
  const offering = listing!.offerings.find((o) => o.id === offeringId);
  const today = todayInJohannesburg();
  const problem = validateCustomerOrder(offering, date, today);
  if (problem) back(problem);

  const business = await orderableBusiness(user);
  if (!business) back("This business isn't available right now.");
  if (!user.isDemo && business!.userId === user.id) back("You can't order from your own business.");

  const customer = await customerRecordFor(user, business!.id);
  const repo = createRepo(prisma);
  const ctx = await repo.loadContext(business!, today);
  const terms = customerTerms(ctx, offering!, date, customer.id);
  const { id } = await repo.createOrder(business!.id, terms.order);
  await prisma.order.update({ where: { id }, data: { source: "CHRONO", customerUserId: user.id, note: note || null } });

  revalidatePath("/home");
  revalidatePath("/shop/orders");
  redirect("/shop/orders?placed=1");
}
