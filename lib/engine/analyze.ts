/**
 * The full order check: as-entered forecast, prediction-adjusted forecast,
 * recommended deposit and plain-language explanations.
 * Explanations are templates filled from engine output; no LLM is involved.
 */
import { formatShortDate } from "./dates";
import { currentDeposit, recommendDeposit, type DepositRecommendation } from "./deposit";
import { forecast, type ForecastResult, type Verdict } from "./forecast";
import { applyPredictions, type CostDriftWarning, type Prediction } from "./intelligence";
import { formatRand } from "./money";
import type { ForecastInput } from "./types";

export interface OrderAnalysis {
  /** The forecast the headline verdict is based on (adjusted when predictions are on). */
  primary: ForecastResult;
  asEntered: ForecastResult;
  adjusted: ForecastResult;
  usePredictions: boolean;
  predictions: Prediction[];
  driftWarnings: CostDriftWarning[];
  deposit: DepositRecommendation;
  explanation: Explanation;
}

export interface Explanation {
  headline: string;
  lines: string[];
  footnote: string;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  SAFE: "Safe",
  TIGHT: "Tight",
  SHORTFALL: "Cash shortfall",
};

const VERDICT_PHRASE: Record<Verdict, string> = {
  SAFE: "looks safe",
  TIGHT: "looks tight",
  SHORTFALL: "leaves you short of cash",
};

export function analyzeOrder(input: ForecastInput, options: { usePredictions?: boolean } = {}): OrderAnalysis {
  const usePredictions = options.usePredictions ?? true;
  const asEntered = forecast(input);
  const predicted = applyPredictions(input);
  const adjusted = forecast(predicted.input);
  const primary = usePredictions ? adjusted : asEntered;

  const deposit = recommendDeposit(input, usePredictions ? { transform: (i) => applyPredictions(i).input } : {});
  const explanation = explain(input, primary, asEntered, usePredictions ? predicted.predictions : [], deposit, predicted.driftWarnings);

  return { primary, asEntered, adjusted, usePredictions, predictions: predicted.predictions, driftWarnings: predicted.driftWarnings, deposit, explanation };
}

export function explain(
  input: ForecastInput,
  result: ForecastResult,
  asEntered: ForecastResult,
  predictions: Prediction[],
  deposit: DepositRecommendation | null,
  driftWarnings: CostDriftWarning[] = [],
): Explanation {
  const lines: string[] = [];
  const buffer = result.safetyBufferCents;
  let headline: string;

  if (result.shortfall) {
    const s = result.shortfall;
    const days = s.daysBelowZero === 1 ? "1 day" : `${s.daysBelowZero} days`;
    headline = `You'll be ${formatRand(s.amountCents)} short from ${formatShortDate(s.firstDate)} for ${days}.`;
    const cause = s.causes[0];
    const nextIn = result.events.find((e) => e.direction === "IN" && e.date >= s.firstDate);
    if (cause && nextIn) {
      lines.push(`${cause.name} (${formatRand(cause.amountCents)}) is due before ${nextIn.name} (${formatRand(nextIn.amountCents)}) arrives.`);
    } else if (cause) {
      lines.push(`${cause.name} (${formatRand(cause.amountCents)}) causes the gap.`);
    }
  } else if (result.verdict === "TIGHT") {
    headline = `You stay above R0, but drop to ${formatRand(result.minBalanceCents)} on ${formatShortDate(result.minBalanceDate)}, below your ${formatRand(buffer)} safety buffer.`;
  } else {
    headline = `You have enough cash at every point. Your lowest balance is ${formatRand(result.minBalanceCents)} on ${formatShortDate(result.minBalanceDate)}.`;
  }

  if (deposit) {
    if (deposit.status === "INCREASE" && deposit.recommendedCents !== null) {
      const target = buffer > 0 ? `you stay above your ${formatRand(buffer)} safety buffer` : "you stay above R0";
      lines.push(`Ask for a deposit of at least ${formatRand(deposit.recommendedCents)} and ${target}.`);
    } else if (deposit.status === "CANNOT_FIX" && result.verdict !== "SAFE") {
      const cause = result.shortfall?.causes.find((c) => !c.isProposed) ?? result.shortfall?.causes[0];
      lines.push(
        cause
          ? `A bigger deposit won't fix this. ${cause.name} (${formatRand(cause.amountCents)}) on ${formatShortDate(cause.date)} causes the gap. Try moving a cost later or finding a cheaper supplier.`
          : "A bigger deposit won't fix this. Try moving a cost later or finding a cheaper supplier.",
      );
    }
  }

  if (result.profitCents !== null) {
    if (result.notProfitable) {
      lines.push(`This order doesn't make a profit: costs are ${formatRand(-result.profitCents)} more than the order value.`);
    } else {
      const timing = result.verdict === "SAFE" ? "" : " Cash timing is the risk, not profit.";
      lines.push(`This order makes ${formatRand(result.profitCents)} profit (${Math.round(result.profitMarginPct ?? 0)}%).${timing}`);
    }
  }

  if (predictions.length && asEntered.verdict !== result.verdict) {
    lines.push(`As you entered it, this order ${VERDICT_PHRASE[asEntered.verdict]}. Adjusted for how your customers actually pay, it ${VERDICT_PHRASE[result.verdict]}.`);
  }
  for (const p of predictions) lines.push(p.reason);
  for (const w of driftWarnings) lines.push(w.message);

  for (const u of result.uncounted.filter((x) => x.isProposed)) {
    lines.push(`${u.label} (${formatRand(u.amountCents)}) has no date yet, so it isn't counted in this forecast.`);
  }

  const proposed = input.proposedOrder;
  if (proposed && deposit && deposit.status === "ALREADY_ENOUGH" && currentDeposit(proposed) > 0 && result.verdict === "SAFE") {
    lines.push(`Your ${formatRand(currentDeposit(proposed))} deposit is enough.`);
  }

  return { headline, lines, footnote: "Estimate based on what you entered and your past orders." };
}
