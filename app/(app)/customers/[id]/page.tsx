import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { customerPaymentHistory, summarizeCustomers } from "@/lib/data/insights";
import { formatRand, formatShortDate, todayInJohannesburg } from "@/lib/engine";
import { DEMO_IDS } from "@/lib/demo/demo-data";
import { TourStep } from "@/components/Tour";

export const dynamic = "force-dynamic";

const CONFIDENCE = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tour?: string }> }) {
  const { id } = await params;
  const { tour } = await searchParams;
  const { business } = await requireBusiness();
  const repo = createRepo(prisma);
  const customer = await repo.getCustomer(business.id, id);
  if (!customer) notFound();

  const ctx = await repo.loadContext(business, todayInJohannesburg());
  const summary = summarizeCustomers(ctx).find((c) => c.id === id)!;
  const history = customerPaymentHistory(ctx, id);
  const orders = ctx.orders.filter((o) => o.customerId === id);
  const r = summary.reliability;
  const pendingCake = orders.find((o) => o.id === DEMO_IDS.cake && o.payments.some((p) => !p.receivedDate));

  return (
    <main>
      <Link href="/customers" className="small muted">
        All customers
      </Link>
      <h1 className="h1">{customer.name}</h1>
      <p style={{ marginTop: 0, fontWeight: 600, color: r.shiftDays > 0 ? "var(--tight)" : "var(--ink)" }}>{summary.summary}</p>

      {tour === "1" && pendingCake && (
        <TourStep step={5} total={5}>
          Thabo&apos;s R600 cake balance is still outstanding. <Link href={`/orders/${DEMO_IDS.cake}#record`}>Record it as received today</Link> and come back: Chrono adds it to his history and updates every forecast.
        </TourStep>
      )}

      <section className="panel">
        {r.scope === "CUSTOMER" ? (
          <p style={{ margin: 0 }}>
            Based on <strong>{r.records}</strong> recorded payment{r.records === 1 ? "" : "s"}, {customer.name.split(" ")[0]} paid on time{" "}
            <strong>{Math.round(r.onTimeRate * 100)}%</strong> of the time
            {r.partialRate > 0 ? (
              <>
                {" "}
                and paid in parts <strong>{Math.round(r.partialRate * 100)}%</strong> of the time
              </>
            ) : null}
            . Chrono has {r.confidence ? CONFIDENCE[r.confidence] : "no"} confidence in this pattern
            {r.shiftDays > 0 ? `, so it expects their payments about ${r.shiftDays} days after the agreed date.` : "."}
          </p>
        ) : (
          <p style={{ margin: 0 }}>Record at least two payments from this customer and Chrono will start learning how they pay.</p>
        )}
      </section>

      <h2 className="h2">Payment history</h2>
      {history.length === 0 ? (
        <p className="muted">No payments recorded yet.</p>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {history.map((h) => (
            <div key={`${h.orderId}-${h.receivedDate}-${h.amountCents}`} className="row">
              <span>
                {h.orderTitle}
                <br />
                <span className="small muted">
                  Due {formatShortDate(h.expectedDate)}, paid {formatShortDate(h.receivedDate)}
                </span>
              </span>
              <span style={{ textAlign: "right" }}>
                <span className="num">{formatRand(h.amountCents)}</span>
                <br />
                <span className="small" style={{ color: h.daysLate > 1 ? "var(--tight)" : "var(--safe)", fontWeight: 600 }}>
                  {h.daysLate <= 0 ? "On time" : `${h.daysLate} day${h.daysLate === 1 ? "" : "s"} late`}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="h2">Orders</h2>
      <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
        {orders.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="row">
            <span>{o.title}</span>
            <span className="small muted">{o.status.charAt(0) + o.status.slice(1).toLowerCase()}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
