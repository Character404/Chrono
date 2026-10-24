import { formatRand, formatShortDate, type DayPoint } from "@/lib/engine";

interface Props {
  /** Unique per page, used for SVG ids. */
  id: string;
  series: DayPoint[];
  /** Optional second line, drawn dashed (e.g. the forecast as entered). */
  compare?: DayPoint[];
  bufferCents: number;
  /** Small sparkline version with no labels. */
  compact?: boolean;
  /** Draw for a dark background (hero cards). */
  onDark?: boolean;
}

/** Each day becomes two points: the low after money out, then the end of day. */
function points(series: DayPoint[]) {
  return series.flatMap((d, i) => [
    { x: i, v: d.balanceAfterOutCents },
    { x: i + 0.5, v: d.balanceEndCents },
  ]);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function CashChart({ id, series, compare, bufferCents, compact = false, onDark = false }: Props) {
  if (series.length === 0) return null;
  const W = 340;
  const H = compact ? 70 : 210;
  const PAD = compact ? { left: 2, right: 2, top: 6, bottom: 6 } : { left: 6, right: 6, top: 20, bottom: 28 };

  const main = points(series);
  const other = compare ? points(compare) : [];
  const values = [...main, ...other].map((p) => p.v);
  let min = Math.min(0, bufferCents, ...values);
  let max = Math.max(bufferCents, ...values);
  const span = Math.max(max - min, 10000);
  min -= span * 0.1;
  max += span * 0.1;

  const lastX = series.length - 0.5;
  const x = (i: number) => PAD.left + (i / lastX) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * (H - PAD.top - PAD.bottom);
  const path = (pts: { x: number; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

  const top = PAD.top;
  const bottom = H - PAD.bottom;
  const zeroY = y(0);
  const bufferY = y(bufferCents);
  const off = (yy: number) => clamp01((yy - top) / (bottom - top));
  const low = main.reduce((a, b) => (b.v < a.v ? b : a), main[0]);
  const lowDay = series[Math.floor(low.x)];
  const linePath = path(main);
  const area = `${linePath} L${x(lastX).toFixed(1)},${bottom} L${x(0).toFixed(1)},${bottom} Z`;
  const below = `${linePath} L${x(lastX).toFixed(1)},${zeroY.toFixed(1)} L${x(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
  const ids = { stroke: `stroke-${id}`, fill: `fill-${id}`, clip: `clip-${id}` };
  const lowColour = low.v < 0 ? "var(--g-down)" : low.v < bufferCents ? "var(--g-mid)" : "var(--g-up)";
  const lowLabelLeft = x(low.x) > W * 0.58;
  const textMuted = onDark ? "rgba(238,246,245,0.65)" : "var(--muted)";
  const baseline = onDark ? "rgba(238,246,245,0.35)" : "var(--ink)";

  return (
    <figure style={{ margin: 0 }}>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Cash forecast from ${formatShortDate(series[0].date)} to ${formatShortDate(series[series.length - 1].date)}. Lowest point ${formatRand(low.v)} on ${formatShortDate(lowDay.date)}.`}
      >
        <defs>
          {/* The line changes colour as cash heads toward danger. */}
          <linearGradient id={ids.stroke} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={bottom}>
            <stop offset="0" stopColor="var(--g-up)" />
            <stop offset={off(bufferY)} stopColor="var(--g-up)" />
            <stop offset={off((bufferY + zeroY) / 2)} stopColor="var(--g-mid)" />
            <stop offset={Math.min(1, off(zeroY) + 0.02)} stopColor="var(--g-down)" />
            <stop offset="1" stopColor="var(--g-down)" />
          </linearGradient>
          <linearGradient id={ids.fill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--g-sky)" stopOpacity={onDark ? 0.35 : 0.22} />
            <stop offset="1" stopColor="var(--g-sky)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={ids.clip}>
            <rect x="0" y={zeroY} width={W} height={Math.max(H - zeroY, 0)} />
          </clipPath>
        </defs>

        <path className="chart-fade" d={area} fill={`url(#${ids.fill})`} />
        <path className="chart-fade" d={below} fill="var(--g-down)" opacity="0.22" clipPath={`url(#${ids.clip})`} />

        {!compact && (
          <>
            <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke={baseline} strokeWidth="1" opacity="0.35" />
            <text x={PAD.left} y={zeroY + 13} fontSize="10" fill={textMuted}>
              R0
            </text>
            {bufferCents > 0 && (
              <>
                <line x1={PAD.left} x2={W - PAD.right} y1={bufferY} y2={bufferY} stroke="var(--g-mid)" strokeWidth="1" strokeDasharray="2 4" opacity="0.8" />
                <text x={W - PAD.right} y={bufferY - 5} textAnchor="end" fontSize="10" fontWeight="600" fill="var(--g-mid)">
                  Safety buffer {formatRand(bufferCents)}
                </text>
              </>
            )}
          </>
        )}

        {other.length > 0 && <path className="chart-fade" d={path(other)} fill="none" stroke={textMuted} strokeWidth="1.5" strokeDasharray="4 4" />}
        <path className="chart-line" pathLength={1} d={linePath} fill="none" stroke={`url(#${ids.stroke})`} strokeWidth={compact ? 2.5 : 3} strokeLinejoin="round" strokeLinecap="round" />

        <circle className="chart-dot" cx={x(low.x)} cy={y(low.v)} r={compact ? 3.5 : 5} fill={lowColour} stroke={onDark ? "#0a1d21" : "var(--surface)"} strokeWidth="2" />
        {!compact && (
          <>
            <text
              className="chart-fade"
              x={x(low.x) + (lowLabelLeft ? -9 : 9)}
              y={Math.min(y(low.v) + 17, H - PAD.bottom + 6)}
              textAnchor={lowLabelLeft ? "end" : "start"}
              fontSize="11.5"
              fontWeight="800"
              fill={lowColour}
            >
              {formatRand(low.v)} on {formatShortDate(lowDay.date)}
            </text>
            <text x={PAD.left} y={H - 7} fontSize="10" fill={textMuted}>
              {formatShortDate(series[0].date)}
            </text>
            <text x={W - PAD.right} y={H - 7} textAnchor="end" fontSize="10" fill={textMuted}>
              {formatShortDate(series[series.length - 1].date)}
            </text>
          </>
        )}
      </svg>
      {compare && !compact && (
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
