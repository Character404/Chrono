import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo, forecastInputFor } from "@/lib/data/repo";
import { orderRowToInput } from "@/lib/data/convert";
import { analyzeOrder, EngineValidationError, formatRand, formatShortDate, todayInJohannesburg, VERDICT_LABEL, type OrderAnalysis } from "@/lib/engine";
import { decideOrder } from "@/app/actions/orders";
import { CashChart } from "@/components/CashChart";
import { VerdictBand } from "@/components/Verdict";
import { AnalysisDetails } from "@/components/AnalysisDetails";
import { WhatIf } from "@/components/WhatIf";
import { RecordActuals } from "@/components/RecordActuals";
import { TourStep } from "@/components/Tour";
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
                  <button className="btn btn-quiet btn-wide" type="submit">
                    Stop sharing
                  </button>
                </form>
              </div>
            </>
          ) : (
            <form action={shareQuote}>
              <input type="hidden" name="orderId" value={order.id} />
              <p className="small muted" style={{ marginTop: 0 }}>
                Create a link showing the total, the deposit you need and when payments are due.
              </p>
              <button className="btn btn-quiet btn-wide" type="submit">
                Create quote link
              </button>
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

      {order.status === "DRAFT" && (
        <div className="grid-2" style={{ marginTop: "1.5rem" }}>
          <form action={decideOrder}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="decision" value="decline" />
            <button className="btn btn-quiet btn-wide" type="submit">
              Decline
            </button>
          </form>
          <form action={decideOrder}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="decision" value="accept" />
            <button className="btn btn-wide" type="submit">
              Accept order
            </button>
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
