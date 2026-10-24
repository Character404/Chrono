import { formatRand, formatShortDate, type DayPoint } from "@/lib/engine";

interface Props {
  /** Unique per page, used for the SVG clip path. */
  id: string;
  series: DayPoint[];
  /** Optional second line, drawn dashed (e.g. the forecast as entered). */
  compare?: DayPoint[];
  bufferCents: number;
}

const W = 340;
const H = 200;
const PAD = { left: 6, right: 6, top: 16, bottom: 24 };

/** Each day becomes two points: the low after money out, then the end of day. */
function points(series: DayPoint[]) {
  return series.flatMap((d, i) => [
    { x: i, v: d.balanceAfterOutCents },
    { x: i + 0.5, v: d.balanceEndCents },
  ]);
}

export function CashChart({ id, series, compare, bufferCents }: Props) {
  if (series.length === 0) return null;
  const main = points(series);
  const other = compare ? points(compare) : [];
  const values = [...main, ...other].map((p) => p.v);
  let min = Math.min(0, bufferCents, ...values);
  let max = Math.max(bufferCents, ...values);
  const span = Math.max(max - min, 10000);
  min -= span * 0.08;
  max += span * 0.08;

  const lastX = series.length - 0.5;
  const x = (i: number) => PAD.left + (i / lastX) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * (H - PAD.top - PAD.bottom);
  const path = (pts: { x: number; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

  const zeroY = y(0);
  const bufferY = y(bufferCents);
  const low = main.reduce((a, b) => (b.v < a.v ? b : a), main[0]);
  const lowDay = series[Math.floor(low.x)];
  const area = `${path(main)} L${x(lastX).toFixed(1)},${zeroY.toFixed(1)} L${x(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
  const clip = `below-zero-${id}`;
  const lowLabelLeft = x(low.x) > W * 0.6;

  return (
    <figure style={{ margin: 0 }}>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Cash forecast from ${formatShortDate(series[0].date)} to ${formatShortDate(series[series.length - 1].date)}. Lowest point ${formatRand(low.v)} on ${formatShortDate(lowDay.date)}.`}
      >
        <defs>
          <clipPath id={clip}>
            <rect x="0" y={zeroY} width={W} height={Math.max(H - zeroY, 0)} />
          </clipPath>
        </defs>

        {/* Money below R0 */}
        <path d={area} fill="var(--short)" opacity="0.18" clipPath={`url(#${clip})`} />

        {/* Zero and buffer lines */}
        <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke="var(--ink)" strokeWidth="1" opacity="0.5" />
        <text x={PAD.left} y={zeroY + 12} fontSize="10" fill="var(--muted)">
          R0
        </text>
        {bufferCents > 0 && (
          <>
            <line x1={PAD.left} x2={W - PAD.right} y1={bufferY} y2={bufferY} stroke="var(--tight)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={W - PAD.right} y={bufferY - 4} textAnchor="end" fontSize="10" fill="var(--tight)">
              Safety buffer {formatRand(bufferCents)}
            </text>
          </>
        )}

        {/* As entered (dashed) and Chrono's forecast (solid) */}
        {other.length > 0 && <path d={path(other)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" />}
        <path d={path(main)} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Lowest point */}
        <circle cx={x(low.x)} cy={y(low.v)} r="4" fill={low.v < 0 ? "var(--short)" : "var(--ink)"} />
        <text
          x={x(low.x) + (lowLabelLeft ? -7 : 7)}
          y={Math.min(y(low.v) + 16, H - PAD.bottom + 4)}
          textAnchor={lowLabelLeft ? "end" : "start"}
          fontSize="11"
          fontWeight="700"
          fill={low.v < 0 ? "var(--short)" : "var(--ink)"}
        >
          {formatRand(low.v)} on {formatShortDate(lowDay.date)}
        </text>

        {/* Dates */}
        <text x={PAD.left} y={H - 6} fontSize="10" fill="var(--muted)">
          {formatShortDate(series[0].date)}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="10" fill="var(--muted)">
          {formatShortDate(series[series.length - 1].date)}
        </text>
      </svg>
      {compare && (
        <figcaption className="legend">
          <span>
            <i />
            Chrono&apos;s forecast
          </span>
          <span>
            <i className="dashed" />
            As you entered it
          </span>
        </figcaption>
      )}
    </figure>
  );
}
