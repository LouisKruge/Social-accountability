import { MiniAscent } from "./ascent";
import { formatMetric } from "./ui";

export interface ClimbRow {
  userId: string;
  displayName: string;
  rank: number;
  pctChange: number;
  isAbsolute: boolean;
  /** trajectory across recent periods, for the row sparkline */
  series: number[];
  /** opted-in raw value, if the climber chose to show it */
  sharedValue?: number;
}

/**
 * One rung of the climb.
 *
 * Rank reads as altitude: the leader sits in summit light (warm ring + crest
 * glow), everyone below is cooler and dimmer. The viewer's own row is marked
 * with a quiet ice left-border rather than a loud highlight.
 */
export function LeaderboardRow({
  row,
  isViewer,
  metricType,
  unit,
}: {
  row: ClimbRow;
  isViewer: boolean;
  metricType: "percentage_change" | "streak";
  unit: string | null;
}) {
  const isStreak = metricType === "streak";
  const lead = row.rank === 1;
  const climbing = isStreak ? true : row.pctChange >= 0;

  return (
    <li
      className={[
        "relative flex items-center gap-3 overflow-hidden rounded-card px-4 py-3.5 transition",
        lead ? "bg-slope shadow-crest ring-1 ring-summit/25" : "bg-slope/60",
      ].join(" ")}
    >
      {/* your own rung — a quiet ice marker, not a garish highlight */}
      {isViewer && (
        <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-ice" />
      )}

      <span className={`tnum w-6 shrink-0 text-center text-sm ${lead ? "text-summit" : "text-sage"}`}>
        {row.rank}
      </span>

      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${lead ? "text-snow" : "text-snow/90"}`}>
          {row.displayName}
          {isViewer && <span className="text-sage"> · you</span>}
        </span>
        {row.sharedValue !== undefined && (
          <span className="tnum block text-xs text-sage">
            {row.sharedValue.toLocaleString("en-ZA")} {unit}
          </span>
        )}
      </span>

      {/*
       * On the narrowest phones the name matters more than the trajectory
       * glyph, so the sparkline steps aside rather than truncating people's
       * names to "Tha…".
       */}
      <span className="hidden shrink-0 min-[360px]:block">
        <MiniAscent
          values={row.series.length ? row.series : [row.pctChange]}
          climbing={climbing}
          width={68}
          height={28}
        />
      </span>

      {/*
       * Gold is summit light, so it is reserved for the leader. Everyone else's
       * positive move reads in plain snow — otherwise "gold" degrades into
       * meaning nothing more than "a positive number".
       */}
      <span className="w-[5rem] shrink-0 text-right">
        <span
          className={`tnum block text-sm ${
            lead ? "text-summit" : climbing ? "text-snow" : "text-fall"
          }`}
        >
          {formatMetric(metricType, row.pctChange, row.isAbsolute, unit)}
        </span>
        {row.isAbsolute && !isStreak && (
          <span className="block text-[0.6rem] uppercase tracking-wider text-sage/70">
            from zero
          </span>
        )}
      </span>
    </li>
  );
}
