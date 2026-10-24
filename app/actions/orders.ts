"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { draftToOrderInput, parseDraftJson, validateDraft } from "@/lib/data/order-draft";
import { validateOrder } from "@/lib/engine/forecast";

export interface SaveOrderState {
  errors: string[];
}

export async function saveOrder(_prev: SaveOrderState | null, formData: FormData): Promise<SaveOrderState> {
  const { business } = await requireBusiness();
  const repo = createRepo(prisma);

  const draft = parseDraftJson(String(formData.get("draft") ?? ""));
  if (!draft) return { errors: ["Something went wrong reading the order. Try again."] };
  const errors = validateDraft(draft);
  if (errors.length) return { errors };

  let customerId = draft.customerId;
  if (customerId) {
    const customer = await repo.getCustomer(business.id, customerId);
    if (!customer) return { errors: ["That customer wasn't found. Choose another or add a new one."] };
  } else {
    customerId = (await repo.createCustomer(business.id, draft.newCustomerName!)).id;
  }

  const order = draftToOrderInput(draft, { id: "new", customerId, status: "DRAFT" });
  const engineErrors = validateOrder(order);
  if (engineErrors.length) return { errors: engineErrors };

  const { id } = await repo.createOrder(business.id, order);
  revalidatePath("/home");
  redirect(`/orders/${id}`);
}

export async function decideOrder(formData: FormData) {
  const { business } = await requireBusiness();
  const orderId = String(formData.get("orderId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const status = decision === "accept" ? "ACCEPTED" : decision === "decline" ? "DECLINED" : null;
  if (!orderId || !status) redirect("/home");

  const changed = await createRepo(prisma).setOrderStatus(business.id, orderId, status);
  if (!changed) redirect("/home");
  revalidatePath("/home");
  redirect(`/orders/${orderId}`);
}
