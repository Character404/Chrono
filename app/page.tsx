import { analyzeOrder, todayInJohannesburg, VERDICT_LABEL, type Verdict } from "@/lib/engine";
import { sampleCheck } from "@/lib/demo/sample";

// Milestone 1 placeholder: proves the forecasting engine runs inside Next.js.
// Replaced by the real home screen in Milestone 2.
export const dynamic = "force-dynamic";

const verdictColour: Record<Verdict, string> = {
  SAFE: "var(--safe)",
  TIGHT: "var(--tight)",
  SHORTFALL: "var(--short)",
};

export default function Home() {
  const analysis = analyzeOrder(sampleCheck(todayInJohannesburg()));
  const { primary, asEntered, explanation } = analysis;

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <p className="text-sm font-semibold tracking-wide" style={{ color: "var(--muted)" }}>
        CHRONO
      </p>
      <h1 className="mt-1 text-3xl font-bold">Know before you commit.</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>
        Engine check: a R5 000 wedding order for a customer who usually pays late.
      </p>

      <section className="mt-8 rounded-2xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          As entered: {VERDICT_LABEL[asEntered.verdict]}
        </p>
        <p className="mt-1 text-2xl font-bold" style={{ color: verdictColour[primary.verdict] }}>
          {VERDICT_LABEL[primary.verdict]}
        </p>
        <p className="mt-3 font-medium">{explanation.headline}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {explanation.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
          {explanation.footnote}
        </p>
      </section>
    </main>
  );
}
