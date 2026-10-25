import { formatShortDate } from "@/lib/engine";
import type { PaymentHistoryRow } from "@/lib/data/insights";

/** A ring showing how often a customer pays on time. Grey when there's no history yet. */
export function ReliabilityRing({ onTimeRate, hasHistory, size = 48 }: { onTimeRate: number; hasHistory: boolean; size?: number }) {
  const pct = Math.round(onTimeRate * 100);
  const colour = !hasHistory ? "var(--line)" : pct >= 75 ? "var(--g-up)" : pct >= 40 ? "var(--g-mid)" : "var(--g-down)";
  return (
    <span
      className="ring"
      style={{ width: size, height: size, background: `radial-gradient(closest-side, var(--surface) 74%, transparent 76%), conic-gradient(${colour} ${hasHistory ? pct : 0}%, ${hasHistory ? `color-mix(in srgb, ${colour} 22%, transparent)` : "var(--line)"} 0)` }}
      role="img"
      aria-label={hasHistory ? `Pays on time ${pct}% of the time` : "Not enough history yet"}
    >
      <span className="num" style={{ fontSize: size > 56 ? "1rem" : "0.75rem", color: hasHistory ? colour : "var(--muted)" }}>
        {hasHistory ? `${pct}%` : "–"}
      </span>
    </span>
  );
}

/** Days late for each recorded payment, oldest to newest. The bars grow in when the page opens. */
export function LatenessChart({ rows }: { rows: PaymentHistoryRow[] }) {
  if (rows.length === 0) return null;
  const data = [...rows].reverse().slice(-12);
  const W = 340;
  const H = 150;
  const top = 18;
  const bottom = 30;
  const max = Math.max(7, ...data.map((r) => r.daysLate));
  const slot = W / data.length;
  const barW = Math.min(34, slot * 0.6);
  const h = (d: number) => Math.max(4, (Math.max(d, 0) / max) * (H - top - bottom));
  const colour = (d: number) => (d <= 1 ? "var(--g-up)" : d <= 4 ? "var(--g-mid)" : "var(--g-down)");

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Days late for the last ${data.length} payments`}>
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
      {data.map((r, i) => {
        const cx = slot * i + slot / 2;
        const bh = h(r.daysLate);
        return (
          <g key={`${r.orderId}-${r.receivedDate}-${i}`} className="bar-grow" style={{ animationDelay: `${i * 70}ms` }}>
            <rect x={cx - barW / 2} y={H - bottom - bh} width={barW} height={bh} rx="6" fill={colour(r.daysLate)} />
            <text x={cx} y={H - bottom - bh - 5} textAnchor="middle" fontSize="11" fontWeight="800" fill={colour(r.daysLate)}>
              {r.daysLate <= 0 ? "on time" : `${r.daysLate}d`}
            </text>
            <text x={cx} y={H - 10} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
              {formatShortDate(r.expectedDate).slice(4)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
