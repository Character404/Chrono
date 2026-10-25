import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { createRepo } from "@/lib/data/repo";
import { orderRowToInput } from "@/lib/data/convert";
import { isDocLang } from "@/lib/documents/i18n";
import { documentNumber, renderOrderDocument, type DocKind } from "@/lib/documents/order-document";
import { todayInJohannesburg } from "@/lib/engine/dates";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:orderId?type=quote|invoice&lang=en|nso
 * Returns the PDF for the signed-in owner of the order only.
 */
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  const business = await prisma.business.findUnique({ where: { userId: user.id } });
  if (!business) return new Response("Not found.", { status: 404 });

  const { orderId } = await params;
  const row = await createRepo(prisma).getOrder(business.id, orderId);
  if (!row) return new Response("Not found.", { status: 404 });

  const url = new URL(request.url);
  const kind: DocKind = url.searchParams.get("type") === "invoice" ? "invoice" : "quote";
  const langParam = url.searchParams.get("lang");
  const lang = isDocLang(langParam) ? langParam : "en";
  if (kind === "invoice" && row.status !== "ACCEPTED" && row.status !== "COMPLETED") {
    return new Response("Invoices are available once an order is accepted.", { status: 400 });
  }

  const bytes = await renderOrderDocument({
    kind,
    lang,
    today: todayInJohannesburg(),
    businessName: business.name,
    businessType: business.type,
    customerName: row.customer?.name ?? "",
    order: orderRowToInput(row),
  });
  const filename = `${documentNumber(kind, row.id)}.pdf`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
