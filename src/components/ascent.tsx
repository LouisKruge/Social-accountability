/**
 * THE SIGNATURE — the ascent line.
 *
 * This is not decoration: it is Ascend's data model drawn literally. Every line
 * begins at a shared origin on the left (your baseline = 0%) and climbs from
 * there, because in this product nobody competes on absolute standing — only on
 * distance travelled from their own starting line.
 *
 * The stroke runs ICE (cold start) → SUMMIT (warm light at the leading tip), so
 * gold only ever appears at the point you have climbed to. That is the whole
 * thesis in one gesture, and it structurally keeps gold rare.
 *
 * Gradients live in one shared <AscentDefs /> sprite (rendered once in the root
 * layout) so these stay server components with zero client JS. The draw-in is
 * pure CSS via pathLength="1" + stroke-dashoffset, and snaps to its finished
 * shape under prefers-reduced-motion (see globals.css).
 */

/** Rendered once, in the root layout. Referenced by every ascent line. */
export function AscentDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        <linearGradient id="ascent-up" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(var(--ice-deep))" />
          <stop offset="55%" stopColor="rgb(var(--ice))" />
          <stop offset="100%" stopColor="rgb(var(--summit))" />
        </linearGradient>
        {/*
          A descent does NOT end in red. Red is reserved for genuine errors and
          destructive actions (design language §2), and a week where someone's
          savings went backwards is neither — it is the week they are most
          likely to close the app if the screen shouts at them. The line simply
          fails to reach summit light and fades toward grey, which says the same
          thing without an accusation.
        */}
        <linearGradient id="ascent-down" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(var(--ice-deep))" />
          <stop offset="55%" stopColor="rgb(var(--ice-deep))" />
          <stop offset="100%" stopColor="rgb(var(--sage))" />
        </linearGradient>
        <radialGradient id="summit-glow">
          <stop offset="0%" stopColor="rgb(var(--summit))" stopOpacity="0.5" />
          <stop offset="100%" stopColor="rgb(var(--summit))" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function toPath(values: number[], w: number, h: number, pad: number) {
  // Always start at the shared origin (0% at the left edge).
  const series = [0, ...values];
  const max = Math.max(1, ...series.map((v) => Math.abs(v)));
  const stepX = (w - pad * 2) / Math.max(1, series.length - 1);
  const mid = h / 2; // the horizon: 0% from baseline
  const scale = (h / 2 - pad) / max;

  const pts = series.map((v, i) => [pad + i * stepX, mid - v * scale] as const);

  // Smooth it so it reads as a trajectory, not a plotted chart.
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const cx = px + (x - px) / 2;
    d += ` C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }
  return { d, pts, mid };
}

export function AscentLine({
  values,
  height = 168,
  label,
  className = "",
}: {
  /** % change per period, oldest → newest. Empty = nothing climbed yet. */
  values: number[];
  height?: number;
  label?: string;
  className?: string;
}) {
  const w = 320;
  const pad = 14;
  const hasClimb = values.length > 0;
  const { d, pts, mid } = toPath(hasClimb ? values : [0], w, height, pad);
  const tip = pts[pts.length - 1];
  const climbing = hasClimb && values[values.length - 1] >= 0;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className="w-full overflow-visible"
        style={{ height }}
        role="img"
        aria-label={
          label ??
          (hasClimb
            ? `Your trajectory: ${values[values.length - 1]}% from your baseline`
            : "No climb recorded yet")
        }
      >
        {/* The shared starting line — everyone climbs from here. */}
        <line
          x1={pad}
          y1={mid}
          x2={w - pad}
          y2={mid}
          stroke="rgb(var(--scree))"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        <circle cx={pad} cy={mid} r="3" fill="rgb(var(--ice-deep))" />

        {hasClimb && (
          <>
            {climbing && <circle cx={tip[0]} cy={tip[1]} r="22" fill="url(#summit-glow)" />}
            <path
              className="ascent-path motion-safe:animate-draw"
              d={d}
              fill="none"
              stroke={climbing ? "url(#ascent-up)" : "url(#ascent-down)"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1"
              style={{ ["--dash" as string]: "1" }}
            />
            <circle cx={tip[0]} cy={tip[1]} r="4.5" fill={climbing ? "rgb(var(--summit))" : "rgb(var(--sage))"} />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * Row-scale ascent line — the rank-change indicator. A trajectory, never a flat
 * up/down arrow. Carries the same origin rule as the hero, so a column of these
 * visibly climbs from one shared starting line.
 */
export function MiniAscent({
  values,
  climbing,
  width = 68,
  height = 28,
}: {
  values: number[];
  climbing?: boolean;
  width?: number;
  height?: number;
}) {
  const pad = 2;
  const { d, pts } = toPath(values.length ? values : [0], width, height, pad);
  const tip = pts[pts.length - 1];
  const up = climbing ?? (values.length ? values[values.length - 1] >= 0 : true);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgb(var(--scree))" strokeWidth="1" />
      <path
        d={d}
        fill="none"
        stroke={up ? "url(#ascent-up)" : "url(#ascent-down)"}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={tip[0]} cy={tip[1]} r="2.5" fill={up ? "rgb(var(--summit))" : "rgb(var(--sage))"} />
    </svg>
  );
}

/** Flat horizon — the empty state. Nothing climbed yet, so the line is level. */
export function Horizon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 64" className={`w-full ${className}`} aria-hidden="true">
      <line
        x1="14"
        y1="32"
        x2="306"
        y2="32"
        stroke="rgb(var(--scree))"
        strokeWidth="1"
        strokeDasharray="2 6"
      />
      <circle cx="14" cy="32" r="3" fill="rgb(var(--ice-deep))" />
    </svg>
  );
}
