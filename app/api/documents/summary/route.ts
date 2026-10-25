import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { createRepo } from "@/lib/data/repo";
import { computeMonthlySummary } from "@/lib/data/monthly-summary";
import { isDocLang } from "@/lib/documents/i18n";
import { renderSummaryDocument } from "@/lib/documents/summary-document";
import { todayInJohannesburg } from "@/lib/engine/dates";

export const dynamic = "force-dynamic";

/** GET /api/documents/summary?month=YYYY-MM&lang=en|nso, for the signed-in owner only. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  const business = await prisma.business.findUnique({ where: { userId: user.id } });
  if (!business) return new Response("Not found.", { status: 404 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new Response("Choose a month like 2026-09.", { status: 400 });
  const langParam = url.searchParams.get("lang");
  const lang = isDocLang(langParam) ? langParam : "en";

  const ctx = await createRepo(prisma).loadContext(business, todayInJohannesburg());
  const bytes = await renderSummaryDocument({ summary: computeMonthlySummary(ctx, month), lang, businessName: business.name, businessType: business.type });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="summary-${month}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
