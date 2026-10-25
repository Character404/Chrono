import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { computeMonthlySummary, defaultSummaryMonth, recentMonths } from "@/lib/data/monthly-summary";
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
  const month = requested && months.includes(requested) ? requested : defaultSummaryMonth(ctx);
  const s = computeMonthlySummary(ctx, month);
  const name = monthTitle(month, "en");
  const leftOver = s.netCents;

  return (
    <main className="page-narrow">
      <h1 className="h1">Monthly summary</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Your month in plain words, with nothing to decode.
      </p>

      <nav className="month-tabs" aria-label="Choose a month">
        {months.map((m) => (
          <Link key={m} href={`/summary?month=${m}`} aria-current={m === month ? "page" : undefined}>
            {monthTitle(m, "en").split(" ")[0]}
          </Link>
        ))}
      </nav>

      <section className="summary-hero" data-tour="summary-hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>
          Left over in {name}
        </p>
        <p className="big-number num" style={{ margin: "0.4rem 0", color: leftOver < 0 ? "#ff8a96" : "#7ee2b8" }}>
          {leftOver < 0 ? "−" : ""}
          {formatRand(Math.abs(leftOver))}
        </p>
        <p style={{ margin: 0 }}>
          You took in <strong className="num">{formatRand(s.moneyInCents)}</strong> from {s.paymentsReceived} payment{s.paymentsReceived === 1 ? "" : "s"}. You paid{" "}
          <strong className="num">{formatRand(s.orderCostsCents)}</strong> for order costs and <strong className="num">{formatRand(s.regularOutCents)}</strong> in regular payments.
        </p>
      </section>

      <h2 className="h2">Orders paid in full</h2>
      {s.ordersPaidInFull.length === 0 ? (
        <p className="muted">No orders were fully paid this month.</p>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {s.ordersPaidInFull.map((o, i) => (
            <div key={`${o.title}-${i}`} className="row">
              <span>
                <strong>{o.title}</strong>
                <br />
                <span className="small muted">{o.customerName}</span>
              </span>
              <span className="num">{formatRand(o.valueCents)}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="h2">Who paid late</h2>
      {s.latePayments.length === 0 ? (
        <p className="muted">{s.onTimeRate === null ? "No balance payments came in this month." : "Everyone paid on time. "}</p>
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
      {s.onTimeRate !== null && (
        <p className="small muted">
          {Math.round(s.onTimeRate * 100)}% of balance payments arrived on time.
          {s.topCustomer ? ` Your biggest customer was ${s.topCustomer.name} (${formatRand(s.topCustomer.amountCents)}).` : ""}
        </p>
      )}

      <section className="panel" style={{ marginTop: "1.5rem" }}>
        <p className="label" style={{ marginTop: 0 }}>
          Keep or share this summary
        </p>
        <p className="small muted" style={{ marginTop: 0 }}>
          A one-page PDF of {name}: useful for your records, or when you talk to a funder or a bigger client.
        </p>
        <PdfShare path={`/api/documents/summary?month=${month}`} label="Share summary (PDF)" shareText={`${business.name}: summary for ${name}`} />
      </section>
    </main>
  );
}
