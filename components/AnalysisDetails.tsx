import { formatRand, type OrderAnalysis } from "@/lib/engine";

const CONFIDENCE_LABEL = { LOW: "Low confidence", MEDIUM: "Medium confidence", HIGH: "High confidence" } as const;

/** Everything under the verdict: the fix, why, what Chrono learned and the assumptions. */
export function AnalysisDetails({ analysis }: { analysis: OrderAnalysis }) {
  const { deposit, explanation, predictions, primary } = analysis;
  const predictionReasons = new Set(predictions.map((p) => p.reason));
  const fixLine = explanation.lines.find((l) => l.startsWith("Ask for a deposit"));
  // The verdict band already says when predictions changed the verdict.
  const lines = explanation.lines.filter((l) => l !== fixLine && !predictionReasons.has(l) && !l.startsWith("As you entered it"));

  return (
    <>
      {fixLine && deposit.status === "INCREASE" && (
        <p className="fix">
          {fixLine}
          <br />
          <span className="small muted" style={{ fontWeight: 400 }}>
            That&apos;s {formatRand((deposit.recommendedCents ?? 0) - deposit.currentDepositCents)} more upfront than you planned.
          </span>
        </p>
      )}

      <ul className="list-plain" style={{ marginTop: "1rem" }}>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {analysis.usePredictions && predictions.length > 0 && (
        <>
          <h2 className="h2">What Chrono learned from your history</h2>
          <ul className="list-plain">
            {predictions.map((p) => (
              <li key={`${p.kind}-${p.paymentId ?? p.orderId}`} className="panel">
                <span className="confidence">
                  <span className="meter" aria-hidden="true">
                    <i data-on="true" />
                    <i data-on={p.confidence !== "LOW"} />
                    <i data-on={p.confidence === "HIGH"} />
                  </span>
                  {CONFIDENCE_LABEL[p.confidence]}, from {p.dataPoints} record{p.dataPoints === 1 ? "" : "s"}
                </span>
                <p style={{ margin: "0.25rem 0 0" }}>{p.reason}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="h2">How this was worked out</h2>
      <ul className="small muted" style={{ paddingLeft: "1.1rem", margin: 0 }}>
        {primary.assumptions.map((a) => (
          <li key={a}>{a}</li>
        ))}
        <li>{explanation.footnote}</li>
      </ul>
    </>
  );
}
