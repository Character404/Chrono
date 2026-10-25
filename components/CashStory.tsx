import { formatRand, formatShortDate, keepAmountsTogether as nb, type CashStory as Story } from "@/lib/engine";

const ICON: Record<string, string> = { TIMING: "⏱", LATE: "⌛", COSTS_OVER: "↗", BILLS: "▦", OTHER_ORDERS: "⧉" };

/** What the owner entered, in one plain sentence. */
export function OrderSummary({ story }: { story: Story }) {
  return (
    <section className="summary-card">
      <p className="label" style={{ margin: 0 }}>
        The order
      </p>
      <p style={{ margin: "0.3rem 0 0" }}>{nb(story.summary)}</p>
    </section>
  );
}

/** The few moments that explain the verdict at a glance. */
export function KeyMoments({ story }: { story: Story }) {
  if (story.keyMoments.length === 0) return null;
  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <p className="label" style={{ margin: "0 0 0.6rem" }}>
        Why
      </p>
      <TimelineRows rows={story.keyMoments} />
    </section>
  );
}

/** Every rand in and out, by date, until the order is fully paid. */
export function CashTimeline({ story }: { story: Story }) {
  if (story.timeline.length === 0) return null;
  return (
    <>
      <TimelineRows rows={story.timeline} />
    </>
  );
}

function TimelineRows({ rows }: { rows: Story["timeline"] }) {
  return (
      <ol className="timeline">
        {rows.map((r, i) => (
          <li key={`${r.date}-${i}`} className="tl-row" data-out={r.runsOut} data-back={r.recovers} data-negative={r.balanceAfterCents < 0}>
            <span className="tl-date">{formatShortDate(r.date)}</span>
            <span className="tl-body">
              <span className="tl-label">{r.label}</span>
              {r.note && <span className="tl-note">{nb(r.note)}</span>}
              {r.runsOut && <span className="tl-flag">You run out of money here</span>}
              {r.recovers && <span className="tl-flag tl-flag-back">Back above R0</span>}
            </span>
            <span className="tl-amounts">
              <span className={`num tl-amount ${r.direction === "IN" ? "tl-in" : ""}`}>
                {r.direction === "IN" ? "+" : "−"}
                {formatRand(r.amountCents)}
              </span>
              <span className="num tl-balance">{formatRand(r.balanceAfterCents)}</span>
            </span>
          </li>
        ))}
      </ol>
  );
}

/** Every cause squeezing cash on this order. */
export function SqueezeCard({ story }: { story: Story }) {
  if (story.squeeze.length === 0) return null;
  return (
      <ul className="squeeze-list">
        {story.squeeze.map((s) => (
          <li key={s.key}>
            <span className="squeeze-icon" aria-hidden="true">
              {ICON[s.key]}
            </span>
            <span>
              <strong>{s.title}</strong>
              <br />
              <span className="small muted">{nb(s.detail)}</span>
            </span>
          </li>
        ))}
      </ul>
  );
}
