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
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const { business } = await requireBusiness();
  const repo = createRepo(prisma);

  const row = await repo.getOrder(business.id, id);
  if (!row) notFound();
  const order = orderRowToInput(row);
  const ctx = await repo.loadContext(business, todayInJohannesburg());
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

      <VerdictBand
        verdict={primary.verdict}
        headline={analysis.explanation.headline}
        note={changedByPredictions ? `As you entered it: ${VERDICT_LABEL[asEntered.verdict]}. Adjusted for how your customers really pay:` : undefined}
      />

      <section className="panel" style={{ marginTop: "1rem" }}>
        <CashChart id="order" series={primary.series} compare={changedByPredictions ? asEntered.series : undefined} bufferCents={business.safetyBufferCents} />
      </section>

      <AnalysisDetails analysis={analysis} />

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
