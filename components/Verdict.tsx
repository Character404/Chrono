import { keepAmountsTogether, VERDICT_LABEL, type Verdict as VerdictKind } from "@/lib/engine";

const ICON: Record<VerdictKind, string> = { SAFE: "✓", TIGHT: "!", SHORTFALL: "!" };

export function VerdictBand({ verdict, headline, note, children }: { verdict: VerdictKind; headline: string; note?: string; children?: React.ReactNode }) {
  return (
    <section className={`verdict verdict-${verdict}`} aria-live="polite">
      {note && (
        <p className="small muted" style={{ margin: "0 0 0.7rem" }}>
          {note}
        </p>
      )}
      <div className="verdict-head">
        <span className="verdict-icon" aria-hidden="true">
          {ICON[verdict]}
        </span>
        <p className="verdict-word">{VERDICT_LABEL[verdict]}</p>
      </div>
      <p className="verdict-headline">{keepAmountsTogether(headline)}</p>
      {children}
    </section>
  );
}

export function VerdictBadge({ verdict }: { verdict: VerdictKind }) {
  return <span className={`badge badge-${verdict}`}>{VERDICT_LABEL[verdict]}</span>;
}
