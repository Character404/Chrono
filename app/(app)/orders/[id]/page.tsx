import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo, forecastInputFor } from "@/lib/data/repo";
import { orderRowToInput } from "@/lib/data/convert";
import { analyzeOrder, buildCashStory, spokenDayMonth, EngineValidationError, formatRand, formatShortDate, todayInJohannesburg, VERDICT_LABEL, type OrderAnalysis, type CashStory } from "@/lib/engine";
import { decideOrder } from "@/app/actions/orders";
import { CashChart } from "@/components/CashChart";
import { VerdictBadge, VerdictBand } from "@/components/Verdict";
import { SubmitButton } from "@/components/SubmitButton";
import { AnalysisDetails } from "@/components/AnalysisDetails";
import { WhatIf } from "@/components/WhatIf";
import { RecordActuals } from "@/components/RecordActuals";
import { TourStep } from "@/components/Tour";
import { Thinking } from "@/components/Thinking";
import { CashTimeline, KeyMoments, OrderSummary, SqueezeCard } from "@/components/CashStory";
import { Fold } from "@/components/Fold";
import { DocumentShare } from "@/components/DocumentShare";
import { buildDocPreview } from "@/lib/documents/preview";
import { TourScene, type TourScriptStep } from "@/components/AutoTour";
import { applyTerms, shareQuote, stopSharingQuote } from "@/app/actions/records";
import { DEMO_IDS, isDemoRecord } from "@/lib/demo/demo-data";
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
  const tour = tourParam === "1" && isDemoRecord(order.id, DEMO_IDS.wedding);
  const quote = await repo.getActiveQuote(business.id, order.id);
  const host = (await headers()).get("host");
  const quoteUrl = quote && host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}/q/${quote.token}` : null;
  const usePredictions = view !== "entered";

  let analysis: OrderAnalysis;
  let story: CashStory;
  try {
    analysis = analyzeOrder(forecastInputFor(ctx, order), { usePredictions });
    story = buildCashStory(forecastInputFor(ctx, order), analysis);
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

  // What the customer will receive, previewed on screen in both languages.
  const previewKind = order.status === "DRAFT" ? ("quote" as const) : ("invoice" as const);
  const previewBase = { kind: previewKind, today, businessName: business.name, businessType: business.type, customerName: row.customer?.name ?? "", order };
  const docPreviews = { en: buildDocPreview({ ...previewBase, lang: "en" }), nso: buildDocPreview({ ...previewBase, lang: "nso" }) };

  // The order part of the narrated tour, built from this order's real numbers.
  const isTourOrder = isDemoRecord(order.id, DEMO_IDS.wedding) && order.status === "DRAFT";
  let tourScript: TourScriptStep[] = [];
  if (isTourOrder && primary.shortfall && analysis.deposit.recommendedCents !== null) {
    const deposit = Math.round(analysis.deposit.recommendedCents / 100).toLocaleString("en-US");
    tourScript = [
      { target: "verdict", say: `Chrono spots a problem: her cash is projected to run short on ${spokenDayMonth(primary.shortfall.firstDate)}.` },
      { target: "why", say: `${firstName} usually pays a week late, so Chrono forecasts his payment after rent is due.` },
      {
        target: "fix",
        say: `Instead of just warning her, Chrono finds the deposit that covers the gap: R${deposit}.`,
        speech: `Instead of just warning her, Chrono finds the deposit that covers the gap: ${deposit} rand.`,
      },
    ];
  }

  return (
    <main>
      <Link href="/home" className="small muted">
        Back to home
      </Link>
      <h1 className="h1">{order.title}</h1>
      <div data-tour="summary">
        <OrderSummary story={story} />
      </div>
      {row.source === "CHRONO" && (
        <p className="via-chrono-note">
          <span className="chip-chrono">via Chrono</span> {firstName} ordered through Chrono. Chrono set the deposit from your schedule when they ordered
          {primary.verdict === "SAFE" ? ", so it’s ready to approve." : "."}
          {row.note ? ` Note: “${row.note}”` : ""}
        </p>
      )}

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
                Lerato typed in Thabo&apos;s order and it looked fine. Chrono played her cash forward day by day: she&apos;d run out of money before he pays.
              </TourStep>
            )}

            <div data-tour="verdict">
            <VerdictBand
              verdict={primary.verdict}
              headline={story.headline}
              note={changedByPredictions ? `As planned it looks ${VERDICT_LABEL[asEntered.verdict].toLowerCase()}. With how things really go for your business:` : undefined}
            >
              {order.status === "DRAFT" && analysis.deposit.status === "INCREASE" && analysis.deposit.recommendedCents !== null && (
                <div className="verdict-fix" data-tour="fix">
                  <p style={{ margin: 0 }}>
                    <strong>Fix: ask for {formatRand(analysis.deposit.recommendedCents)} upfront</strong>
                    <br />
                    <span className="small muted">
                      That&apos;s {formatRand(analysis.deposit.recommendedCents - analysis.deposit.currentDepositCents)} more than planned, and you never run short.
                    </span>
                  </p>
                  <form action={applyTerms}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="deposit" value={String(analysis.deposit.recommendedCents / 100)} />
                    <input type="hidden" name="balanceDate" value="" />
                    <SubmitButton className="btn" pendingLabel="Updating…">
                      Use this deposit
                    </SubmitButton>
                  </form>
                </div>
              )}
              {order.status === "DRAFT" && analysis.deposit.status === "CANNOT_FIX" && primary.verdict !== "SAFE" && (
                <p className="verdict-fix small" style={{ margin: 0 }}>
                  A bigger deposit alone won&apos;t fix this. Try moving a cost later or paying a supplier after the customer.
                </p>
              )}
            </VerdictBand>
            </div>

            {tour && (
              <TourStep step={2} total={5}>
                Three moments tell the story: ingredients go out, rent takes her below R0, and Thabo pays a week late, as he always does.
              </TourStep>
            )}

            <div data-tour="why">
              <KeyMoments story={story} />
            </div>
            {order.status === "DRAFT" && (
              <div className="decision-bar" data-tour="decision">
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
                <form action={decideOrder} data-tour="accept-form">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="decision" value="accept" />
                  <SubmitButton className="btn" pendingLabel="Accepting…">
                    Accept
                  </SubmitButton>
                </form>
              </div>
            )}

          </div>

          <div className="col-side">
            {tour && (
              <TourStep step={3} total={5}>
                Open any section below for the detail: everything squeezing her cash, every day ahead, or your own deposit to test.
              </TourStep>
            )}

            {(order.status === "ACCEPTED" || order.status === "COMPLETED") && <RecordActuals order={order} today={today} />}

            <div className="folds">
              {story.squeeze.length > 0 && (
                <Fold title="What's squeezing your cash" count={story.squeeze.length} tour="squeeze">
                  <SqueezeCard story={story} />
                </Fold>
              )}

              <Fold title="See your cash day by day">
                <CashChart id="order" series={primary.series} compare={changedByPredictions ? asEntered.series : undefined} bufferCents={business.safetyBufferCents} />
                <div style={{ marginTop: "1rem" }}>
                  <CashTimeline story={story} />
                </div>
              </Fold>

              {order.status === "DRAFT" && (
                <Fold title="Try a different deposit or date" id="what-if" tour="whatif">
                  <WhatIf ctx={ctx} order={order} recommendedCents={analysis.deposit.status === "INCREASE" ? analysis.deposit.recommendedCents : null} canApply />
                </Fold>
              )}

              {(order.status === "DRAFT" || order.status === "ACCEPTED") && (
                <Fold title={order.status === "DRAFT" ? "Send the customer a quote" : "Send a quote or invoice"} id="quote" tour="share">
                  <DocumentShare orderId={order.id} kinds={order.status === "DRAFT" ? ["quote"] : ["quote", "invoice"]} businessName={business.name} previews={docPreviews} />
                  <details className="more">
                    <summary>Prefer a link instead?</summary>
                    {quoteUrl && quote ? (
                      <>
                        <p className="quote-link num">{quoteUrl}</p>
                        <div className="grid-2">
                          <a className="btn btn-quiet" href={`https://wa.me/?text=${encodeURIComponent(`Here is your quote from ${business.name}: ${quoteUrl}`)}`} target="_blank" rel="noopener noreferrer">
                            Send link on WhatsApp
                          </a>
                          <form action={stopSharingQuote}>
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="quoteId" value={quote.id} />
                            <SubmitButton className="btn btn-quiet btn-wide" pendingLabel="Stopping…">Stop sharing</SubmitButton>
                          </form>
                        </div>
                      </>
                    ) : (
                      <form action={shareQuote} style={{ marginTop: "0.6rem" }}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <SubmitButton className="btn btn-quiet btn-wide" pendingLabel="Creating link…">Create quote link</SubmitButton>
                      </form>
                    )}
                  </details>
                </Fold>
              )}

              <Fold title="How Chrono worked this out">
                <AnalysisDetails analysis={analysis} />
                <p className="small" style={{ marginTop: "1rem" }}>
                  {usePredictions ? (
                    <Link href={`/orders/${order.id}?view=entered`}>See the forecast exactly as you entered it</Link>
                  ) : (
                    <Link href={`/orders/${order.id}`}>Turn Chrono&apos;s predictions back on</Link>
                  )}
                </p>
              </Fold>
            </div>

            {tour && (
              <TourStep step={4} total={5}>
                Chrono gets smarter with every payment recorded. <Link href={`/customers/${order.customerId}?tour=1`}>See what Chrono knows about Thabo</Link>
              </TourStep>
            )}
          </div>
        </div>
      </Thinking>

      {tourScript.length > 0 && <TourScene name="order" steps={tourScript} />}
    </main>
  );
}
