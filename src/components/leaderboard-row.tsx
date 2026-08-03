import { MiniAscent } from "./ascent";
import { fracOf, num } from "@/lib/format";

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
 * ── WHY THIS STOPPED BEING A CARD ────────────────────────────────────────────
 * It was a rounded rectangle with its own background, which meant a leaderboard
 * of eight people was eight stacked rectangles — the exact pattern the design
 * pass removed everywhere else. A ranked list is the one place where alignment
 * alone is enough: the numbers line up, so the columns are already legible
 * without a container drawing a box around each one.
 *
 * ── WHY THE GOLD WENT ────────────────────────────────────────────────────────
 * The leader used to sit in a gold ring with a crest glow. Gold now means one
 * thing in this product — money confirmed as yours — and a leaderboard position
 * is not money. Using it here would have made the one accent mean "important",
 * which is how an accent stops meaning anything.
 *
 * Rank reads by BRIGHTNESS instead: the leader is the brightest thing in the
 * list and every rung below it recedes toward grey. In a monochrome system that
 * is a stronger signal than a hue, and it costs no colour.
 *
 * ── WHY A NEGATIVE MOVE IS NOT RED ───────────────────────────────────────────
 * Red is reserved for genuine errors and destructive actions. Someone who went
 * backwards this week has not made an error — they have had a bad week, and
 * they are the person most likely to close the app if the screen shouts at
 * them. It reads in grey, with a downward glyph carrying the direction.
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
    <li className="relative border-b border-scree/40 last:border-0">
      <div className={`flex items-center gap-3 py-4 ${isViewer ? "pl-3" : ""}`}>
        {/* Your own rung, marked by a hairline rather than a highlight. */}
        {isViewer && (
          <span aria-hidden className="absolute inset-y-3 left-0 w-px bg-snow" />
        )}

        <span
          className={`tnum w-5 shrink-0 font-display text-lg leading-none ${
            lead ? "text-snow" : "text-sage"
          }`}
        >
          {row.rank}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-body ${lead ? "text-snow" : "text-snow/75"}`}
          >
            {row.displayName}
            {isViewer && <span className="text-sage"> · you</span>}
          </span>
          {row.sharedValue !== undefined && (
            <span className="tnum mt-0.5 block text-caption text-sage">
              {num(row.sharedValue)} {unit}
            </span>
          )}
          {row.isAbsolute && !isStreak && (
            // The unit belongs here rather than beside the figure: "+500" in a
            // savings pitch could be read as 500%, and "+500 ZAR" does not fit
            // the value column without wrapping every other row.
            <span className="mt-0.5 block text-micro uppercase text-sage/70">
              from zero{unit ? ` · ${unit}` : ""}
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

        <span className="w-[4.75rem] shrink-0 text-right">
          <span className={`tnum block text-body ${lead ? "text-snow" : "text-snow/75"}`}>
            {isStreak ? (
              `${num(row.pctChange)} ${unit || "day"}${row.pctChange === 1 ? "" : "s"}`
            ) : (
              <>
                {!climbing && (
                  <span aria-hidden className="mr-0.5 text-sage">
                    ↓
                  </span>
                )}
                {climbing && row.pctChange > 0 ? "+" : ""}
                {num(climbing ? row.pctChange : Math.abs(row.pctChange), fracOf(row.pctChange))}
                {row.isAbsolute ? "" : "%"}
              </>
            )}
          </span>
        </span>
      </div>
    </li>
  );
}
