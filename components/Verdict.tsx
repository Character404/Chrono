import { VERDICT_LABEL, type Verdict as VerdictKind } from "@/lib/engine";

export function VerdictBand({ verdict, headline, note }: { verdict: VerdictKind; headline: string; note?: string }) {
  return (
    <section className={`verdict verdict-${verdict}`} aria-live="polite">
      {note && <p className="small muted" style={{ margin: 0 }}>{note}</p>}
      <p className="verdict-word">{VERDICT_LABEL[verdict]}</p>
      <p style={{ margin: 0, fontWeight: 600 }}>{headline}</p>
    </section>
  );
}

export function VerdictBadge({ verdict }: { verdict: VerdictKind }) {
  return <span className={`badge badge-${verdict}`}>{VERDICT_LABEL[verdict]}</span>;
}
