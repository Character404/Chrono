import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo, forecastInputFor } from "@/lib/data/repo";
import { analyzeOrder, forecast, formatRand, formatShortDate, todayInJohannesburg } from "@/lib/engine";
import { CashChart } from "@/components/CashChart";
import { VerdictBadge } from "@/components/Verdict";
import { computeImpact } from "@/lib/data/insights";
import { DEMO_IDS } from "@/lib/demo/demo-data";
import { CountUp } from "@/components/CountUp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { user, business } = await requireBusiness();
  const today = todayInJohannesburg();
  const ctx = await createRepo(prisma).loadContext(business, today);
  const outlook = forecast(forecastInputFor(ctx, null));
  const series30 = outlook.series.slice(0, 31);
  const upcoming = outlook.events.filter((e) => e.date <= series30[series30.length - 1].date).slice(0, 6);

  const drafts = ctx.orders.filter((o) => o.status === "DRAFT");
  const pending = drafts.map((o) => {
    try {
      return { order: o, verdict: analyzeOrder(forecastInputFor(ctx, o)).primary.verdict };
    } catch {
      return { order: o, verdict: null };
    }
  });
  const accepted = ctx.orders.filter((o) => o.status === "ACCEPTED");
  const customerName = (id: string) => ctx.customers.find((c) => c.id === id)?.name ?? "";
  const impact = computeImpact(ctx);
  const showTour = user.isDemo && drafts.some((o) => o.id === DEMO_IDS.wedding);

  return (
    <main className="layout-2">
      <div className="col-main">
      <section className="hero-card">
        <div className="hero-top">
          <span className="muted small">{business.name}</span>
          <span className="chip">
            <span className="live-dot" aria-hidden="true" />
            Live forecast
          </span>
        </div>
        <p className="big-number" style={{ margin: "0.9rem 0 0.2rem" }}>
          <CountUp cents={outlook.startingBalanceCents} />
        </p>
        <p className="muted small" style={{ margin: 0 }}>
          Cash on hand today
        </p>
        <div style={{ margin: "0.9rem -0.25rem 0" }}>
          <CashChart id="hero" series={series30} bufferCents={business.safetyBufferCents} compact onDark />
        </div>
        <p className="small" style={{ margin: "0.4rem 0 0.4rem", color: "rgba(238,246,245,0.8)" }}>
          Lowest in the next 30 days: <strong className="num">{formatRand(outlook.minBalanceCents)}</strong> on {formatShortDate(outlook.minBalanceDate)}
        </p>
      </section>


      <section className="panel" style={{ marginTop: "1rem" }}>
        <p className="label" style={{ marginTop: 0 }}>
          Your next 30 days, day by day
        </p>
        <CashChart id="home" series={series30} bufferCents={business.safetyBufferCents} />
        <p className="small muted" style={{ marginBottom: 0 }}>
          With the orders you&apos;ve accepted and your regular payments, your lowest point is{" "}
          <strong className="num">{formatRand(outlook.minBalanceCents)}</strong> on {formatShortDate(outlook.minBalanceDate)}.
        </p>
      </section>

      <h2 className="h2">Coming up</h2>
      {upcoming.length === 0 ? (
        <p className="muted">Nothing due in the next 30 days.</p>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {upcoming.map((e) => (
            <div key={`${e.refId}-${e.date}`} className="row">
              <span>
                {e.label}
                <br />
                <span className="small muted">{formatShortDate(e.date)}</span>
              </span>
              <strong className="num" style={{ color: e.direction === "IN" ? "var(--safe)" : "var(--ink)" }}>
                {e.direction === "IN" ? "+" : "−"}
                {formatRand(e.amountCents)}
              </strong>
            </div>
          ))}
        </div>
      )}

      </div>
      <div className="col-side">
      {showTour && (
        <Link href={`/orders/${DEMO_IDS.wedding}?tour=1`} className="tour" style={{ textDecoration: "none" }}>
          <span className="tour-step">60s</span>
          <span>
            <strong>New here? Take the 60-second tour.</strong>
            <br />
            See how Chrono spots a cash shortfall that Lerato couldn&apos;t see.
          </span>
        </Link>
      )}

      {impact.shortfallsSpotted > 0 && (
        <p className="impact">
          <span className="impact-ring num">{impact.shortfallsSpotted}</span>
          <span className="small">
            cash shortfall{impact.shortfallsSpotted === 1 ? "" : "s"} spotted before you said yes, worth{" "}
            <strong className="num">{formatRand(impact.cashAtRiskCents)}</strong>
          </span>
        </p>
      )}

      <Link href="/orders/new" className="btn btn-wide" style={{ margin: "0.5rem 0 1.5rem" }}>
        Check a new order
      </Link>

      <h2 className="h2">Orders waiting for your decision</h2>
      {pending.length === 0 ? (
        <p className="muted">No orders waiting. When a customer asks for something, check it here before you say yes.</p>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {pending.map(({ order, verdict }) => (
            <Link key={order.id} href={`/orders/${order.id}`} className="row">
              <span>
                <strong>{order.title}</strong>
                <br />
                <span className="small muted">
                  {customerName(order.customerId)}, <span className="num">{formatRand(order.valueCents)}</span>
                </span>
              </span>
              {verdict && <VerdictBadge verdict={verdict} />}
            </Link>
          ))}
        </div>
      )}

      {accepted.length > 0 && (
        <>
          <h2 className="h2">Accepted orders</h2>
          <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
            {accepted.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="row">
                <span>
                  {o.title}
                  <br />
                  <span className="small muted">{customerName(o.customerId)}</span>
                </span>
                <span className="num">{formatRand(o.valueCents)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      </div>
    </main>
  );
}
