import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { computeMonthlySummary, recentMonths } from "@/lib/data/monthly-summary";
import { monthTitle } from "@/lib/documents/summary-document";
import { formatRand, todayInJohannesburg } from "@/lib/engine";
import { PdfShare } from "@/components/PdfShare";

export const dynamic = "force-dynamic";

export default async function SummaryPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { business } = await requireBusiness();
  const today = todayInJohannesburg();
  const ctx = await createRepo(prisma).loadContext(business, today);
  const months = recentMonths(today, 3);
  const { month: requested } = await searchParams;
  const month = requested && months.includes(requested) ? requested : months[0];
  const s = computeMonthlySummary(ctx, month);
  const name = monthTitle(month, "en");
  const leftOver = s.netCents;

  const monthName = name.split(" ")[0];
  const signed = (cents: number, sign: "+" | "−") => `${sign}${formatRand(Math.abs(cents))}`;

  return (
    <main className="page-narrow">
      <h1 className="h1">Monthly summary</h1>

      <nav className="month-tabs" aria-label="Choose a month">
        {months.map((m) => (
          <Link key={m} href={`/summary?month=${m}`} aria-current={m === month ? "page" : undefined}>
            {monthTitle(m, "en").split(" ")[0]}
          </Link>
        ))}
      </nav>

      <section className="summary-hero" data-tour="summary-hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>
          Left over in {monthName}
        </p>
        <p className="big-number num" style={{ margin: "0.4rem 0 0.8rem", color: leftOver < 0 ? "#ff8a96" : "#7ee2b8" }}>
          {leftOver < 0 ? "−" : ""}
          {formatRand(Math.abs(leftOver))}
        </p>
        <div className="summary-figures">
          <span>Money in</span>
          <strong className="num" style={{ color: "#7ee2b8" }}>{signed(s.moneyInCents + s.regularInCents, "+")}</strong>
          <span>Order costs</span>
          <strong className="num">{signed(s.orderCostsCents, "−")}</strong>
          <span>Regular payments</span>
          <strong className="num">{signed(s.regularOutCents, "−")}</strong>
        </div>
      </section>

      <h2 className="h2">Orders paid in full</h2>
      {s.ordersPaidInFull.length === 0 ? (
        <p className="muted">None this month.</p>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {s.ordersPaidInFull.map((o, i) => (
            <div key={`${o.title}-${i}`} className="row">
              <span>
                <strong>{o.title}</strong>
                <br />
                <span className="small muted">{o.customerName}</span>
              </span>
              <span className="num">{signed(o.valueCents, "+")}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="h2">Paid late</h2>
      {s.latePayments.length === 0 ? (
        <p className="muted">Nobody this month.</p>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {s.latePayments.map((l, i) => (
            <div key={`${l.customerName}-${i}`} className="row">
              <span>
                <strong>{l.customerName}</strong>
                <br />
                <span className="small muted">{l.orderTitle}</span>
              </span>
              <span className="badge badge-TIGHT">{l.daysLate} days late</span>
            </div>
          ))}
        </div>
      )}

      {s.topCustomer && (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0, marginTop: "1rem" }}>
          <div className="row">
            <span>
              <span className="small muted">Biggest customer</span>
              <br />
              <strong>{s.topCustomer.name}</strong>
            </span>
            <span className="num">{signed(s.topCustomer.amountCents, "+")}</span>
          </div>
        </div>
      )}

      <section className="panel" style={{ marginTop: "1.5rem" }}>
        <p className="label" style={{ marginTop: 0 }}>
          {monthName}&apos;s summary
        </p>
        <PdfShare path={`/api/documents/summary?month=${month}`} label="Print summary" mode="print" shareText={`${business.name}: summary for ${name}`} />
      </section>
    </main>
  );
}
