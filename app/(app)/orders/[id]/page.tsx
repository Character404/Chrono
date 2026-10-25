import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo, forecastInputFor } from "@/lib/data/repo";
import { orderRowToInput } from "@/lib/data/convert";
import { analyzeOrder, EngineValidationError, formatRand, formatShortDate, todayInJohannesburg, VERDICT_LABEL, type OrderAnalysis } from "@/lib/engine";
import { decideOrder } from "@/app/actions/orders";
import { CashChart } from "@/components/CashChart";
import { VerdictBadge, VerdictBand } from "@/components/Verdict";
import { SubmitButton } from "@/components/SubmitButton";
import { AnalysisDetails } from "@/components/AnalysisDetails";
import { WhatIf } from "@/components/WhatIf";
import { RecordActuals } from "@/components/RecordActuals";
import { TourStep } from "@/components/Tour";
import { Thinking } from "@/components/Thinking";
import { shareQuote, stopSharingQuote } from "@/app/actions/records";
import { DEMO_IDS } from "@/lib/demo/demo-data";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const STATUS_NOTE = {
  DRAFT: null,
  ACCEPTED: "You accepted this order. Its money in and out is now part of every forecast.",
  DECLINED: "You declined this order. It isn't counted in your forecasts.",
  COMPLETED: "This order is complete.",
  CANCELLED: "This order was cancelled.",
} as const;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; tour?: string; error?: string }>;
}) {
  const { id } = await params;
  const { view, tour: tourParam, error } = await searchParams;
  const { business } = await requireBusiness();
  const repo = createRepo(prisma);

  const row = await repo.getOrder(business.id, id);
  if (!row) notFound();
  const order = orderRowToInput(row);
  const today = todayInJohannesburg();
  const ctx = await repo.loadContext(business, today);
  const tour = tourParam === "1" && order.id === DEMO_IDS.wedding;
  const quote = await repo.getActiveQuote(business.id, order.id);
  const host = (await headers()).get("host");
  const quoteUrl = quote && host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}/q/${quote.token}` : null;
  const usePredictions = view !== "entered";

  let analysis: OrderAnalysis;
  try {
    analysis = analyzeOrder(forecastInputFor(ctx, order), { usePredictions });
  } catch (error) {
    if (error instanceof EngineValidationError) {
      return (
        <main>
          <h1 className="h1">{order.title}</h1>
          <p className="error-box">This order can&apos;t be checked yet: {error.errors.join(" ")}</p>
        </main>
      );
    }
    throw error;
  }

  const { primary, asEntered } = analysis;
  const changedByPredictions = usePredictions && analysis.predictions.length > 0 && asEntered.verdict !== primary.verdict;
  const deposit = order.payments.find((p) => p.kind === "DEPOSIT");
  const balance = order.payments.find((p) => p.kind !== "DEPOSIT");
  const statusNote = STATUS_NOTE[order.status];

  // What Chrono actually checked, shown step by step before the verdict.
  const firstName = row.customer?.name.split(" ")[0] ?? "this customer";
  const lateness = analysis.predictions.find((p) => p.kind === "CUSTOMER_LATENESS" && p.orderId === order.id);
  const payday = analysis.predictions.find((p) => p.kind === "PAYDAY_PATTERN" && p.orderId === order.id);
  const bias = analysis.predictions.find((p) => p.kind === "COST_BIAS");
  const accepted = ctx.orders.filter((o) => o.status === "ACCEPTED" && o.id !== order.id).length;
  const steps = [
    `Added ${ctx.commitments.length} regular payment${ctx.commitments.length === 1 ? "" : "s"} and ${accepted} accepted order${accepted === 1 ? "" : "s"}`,
    lateness
      ? `Checked ${firstName}'s last ${lateness.dataPoints} payments: usually late`
      : payday
        ? `Checked when your customers usually pay: mostly at month-end`
        : `Checked how ${firstName} has paid before`,
    bias ? `Adjusted costs using your last ${bias.dataPoints} recorded costs` : `Checked your costs against past orders`,
    `Forecast your cash for ${primary.series.length} days, one day at a time`,
    analysis.deposit.status === "INCREASE" && analysis.deposit.recommendedCents !== null
      ? `Found the smallest safe deposit: ${formatRand(analysis.deposit.recommendedCents)}`
      : analysis.deposit.status === "CANNOT_FIX"
        ? "Tested every deposit up to the full order value"
        : "Confirmed your deposit is enough",
  ];

  return (
    <main>
      <Link href="/home" className="small muted">
        Back to home
      </Link>
      <h1 className="h1">{order.title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {row.customer?.name}, <span className="num">{formatRand(order.valueCents)}</span>
        {deposit && (
          <>
            {" "}
            with a <span className="num">{formatRand(deposit.amountCents)}</span> deposit
          </>
        )}
        {balance?.expectedDate && <> and the balance on {formatShortDate(balance.expectedDate)}</>}
      </p>

      {statusNote && <p className="demo-flag">{statusNote}</p>}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}

      <Thinking runKey={`${order.id}-${order.status}-${usePredictions}`} steps={steps}>
      <div className="layout-2">
      <div className="col-main">
      {tour && (
        <TourStep step={1} total={5}>
          Lerato typed this order in and it looked fine. Chrono checked how Thabo actually pays and found a problem before she said yes.
        </TourStep>
      )}

      <VerdictBand
        verdict={primary.verdict}
        headline={analysis.explanation.headline}
        note={changedByPredictions ? `As you entered it: ${VERDICT_LABEL[asEntered.verdict]}. Adjusted for how your customers really pay:` : undefined}
      />

      {tour && (
        <TourStep step={2} total={5}>
          The dashed line is the order as entered. The solid line is Chrono&apos;s forecast: rent goes out before Thabo&apos;s late balance arrives, and the cash dips below R0.
        </TourStep>
      )}

      <section className="panel" style={{ marginTop: "1rem" }}>
        <CashChart id="order" series={primary.series} compare={changedByPredictions ? asEntered.series : undefined} bufferCents={business.safetyBufferCents} />
      </section>

      </div>
      <div className="col-side">
      {tour && (
        <TourStep step={3} total={5}>
          Chrono works out the smallest deposit that keeps Lerato safe, and explains every number. Try your own deposit in the what-if below.
        </TourStep>
      )}

      <AnalysisDetails analysis={analysis} />


      {order.status === "DRAFT" && (
        <div style={{ marginTop: "1.5rem" }}>
          <WhatIf ctx={ctx} order={order} recommendedCents={analysis.deposit.status === "INCREASE" ? analysis.deposit.recommendedCents : null} canApply />
        </div>
      )}

      {(order.status === "ACCEPTED" || order.status === "COMPLETED") && (
        <div style={{ marginTop: "1.5rem" }}>
          <RecordActuals order={order} today={today} />
        </div>
      )}

      {(order.status === "DRAFT" || order.status === "ACCEPTED") && (
        <section className="panel" id="quote" style={{ marginTop: "1.5rem" }}>
          <h2 className="h2" style={{ marginTop: 0 }}>
            Send the customer a quote
          </h2>
          {quoteUrl && quote ? (
            <>
              <p className="small muted" style={{ marginTop: 0 }}>
                Anyone with this link can see the order name, total, deposit and payment dates. Nothing else.
              </p>
              <p className="quote-link num">{quoteUrl}</p>
              <div className="grid-2">
                <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(`Here is your quote from ${business.name}: ${quoteUrl}`)}`} target="_blank" rel="noopener noreferrer">
                  Share on WhatsApp
                </a>
                <form action={stopSharingQuote}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <SubmitButton className="btn btn-quiet btn-wide" pendingLabel="Stopping…">Stop sharing</SubmitButton>
                </form>
              </div>
            </>
          ) : (
            <form action={shareQuote}>
              <input type="hidden" name="orderId" value={order.id} />
              <p className="small muted" style={{ marginTop: 0 }}>
                Create a link showing the total, the deposit you need and when payments are due.
              </p>
              <SubmitButton className="btn btn-quiet btn-wide" pendingLabel="Creating link…">Create quote link</SubmitButton>
            </form>
          )}
        </section>
      )}

      {tour && (
        <TourStep step={4} total={5}>
          Chrono gets smarter with every payment recorded. <Link href={`/customers/${DEMO_IDS.thabo}?tour=1`}>See what Chrono knows about Thabo</Link>
        </TourStep>
      )}

      <p className="small" style={{ marginTop: "1.25rem" }}>
        {usePredictions ? (
          <Link href={`/orders/${order.id}?view=entered`}>See the forecast exactly as you entered it</Link>
        ) : (
          <Link href={`/orders/${order.id}`}>Turn Chrono&apos;s predictions back on</Link>
        )}
      </p>

      </div>
      </div>
      </Thinking>

      {order.status === "DRAFT" && (
        <div className="decision-bar">
          <div className="decision-summary">
            <VerdictBadge verdict={primary.verdict} />
            <span className="small muted num">
              {primary.shortfall ? `Short by ${formatRand(primary.shortfall.amountCents)}` : `Lowest ${formatRand(primary.minBalanceCents)}`}
            </span>
          </div>
          <form action={decideOrder}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="decision" value="decline" />
            <SubmitButton className="btn btn-quiet" pendingLabel="Declining…">
              Decline
            </SubmitButton>
          </form>
          <form action={decideOrder}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="decision" value="accept" />
            <SubmitButton className="btn" pendingLabel="Accepting…">
              Accept
            </SubmitButton>
          </form>
        </div>
      )}
      {order.status === "DRAFT" && (
        <p className="hint" style={{ textAlign: "center" }}>
          Chrono never decides for you. Accepting adds this order to your forecasts.
        </p>
      )}
    </main>
  );
}
