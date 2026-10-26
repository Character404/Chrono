import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { dateToISO } from "@/lib/data/convert";
import { formatRand, formatShortDate } from "@/lib/engine";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: (b: string) => string; badge: string }> = {
  DRAFT: { label: (b) => `Waiting for ${b}`, badge: "badge-TIGHT" },
  ACCEPTED: { label: () => "Accepted", badge: "badge-SAFE" },
  COMPLETED: { label: () => "Completed", badge: "badge-SAFE" },
  DECLINED: { label: () => "Declined", badge: "badge-SHORTFALL" },
};

export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<{ placed?: string }> }) {
  const user = await requireUser();
  const { placed } = await searchParams;
  // Only this customer's own orders, and only what a customer needs to see.
  const orders = await prisma.order.findMany({
    where: { customerUserId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, valueCents: true, status: true, business: { select: { name: true } }, payments: { select: { kind: true, amountCents: true, expectedDate: true } } },
  });
  return (
    <main className="page-narrow">
      <h1 className="h1">My orders</h1>
      {placed && (
        <p className="success-box" role="status">
          Order placed. It&apos;s with the business now.
        </p>
      )}
      {orders.length === 0 ? (
        <div className="empty">
          <p style={{ margin: 0, fontWeight: 700 }}>No orders yet</p>
          <Link href="/shop" className="btn" style={{ marginTop: "0.9rem" }}>
            Find a business
          </Link>
        </div>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {orders.map((o) => {
            const deposit = o.payments.find((p) => p.kind === "DEPOSIT");
            const balance = o.payments.find((p) => p.kind !== "DEPOSIT");
            const status = STATUS[o.status] ?? STATUS.DRAFT;
            const due = balance?.expectedDate ? dateToISO(balance.expectedDate) : null;
            return (
              <div key={o.id} className="row">
                <span>
                  <strong>{o.title}</strong>
                  <br />
                  <span className="small muted">
                    {o.business.name}
                    {due ? ` · ${formatShortDate(due)}` : ""}
                  </span>
                  <br />
                  <span className="small num">
                    {formatRand(o.valueCents)} · deposit {formatRand(deposit?.amountCents ?? 0)}
                  </span>
                </span>
                <span className={`badge ${status.badge}`}>{status.label(o.business.name)}</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
