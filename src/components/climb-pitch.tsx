import Link from "next/link";
import { AppShell } from "@/components/ui";
import { AscentLine, Horizon } from "@/components/ascent";
import { LeaderboardRow } from "@/components/leaderboard-row";
import { recomputeCategory } from "@/app/groups/[id]/actions";
import { createShareCard } from "@/app/share/actions";
import type { ClimbPitch, Momentum } from "@/lib/climb";
import { formatPeriod, type Period } from "@/lib/period";
import { fracOf, num } from "@/lib/format";

/**
 * A PITCH — one category's leaderboard, and the screen the whole product exists
 * to show.
 *
 * ── WHAT CHANGED ─────────────────────────────────────────────────────────────
 * The hero used to be a rounded panel with a gold radial glow behind it and the
 * rank in a corner. Now the rank sits directly on the black at hero scale with
 * the ascent line under it, because the position is the subject and a panel
 * around a subject makes it a statistic.
 *
 * ── ONE THING THIS SCREEN WILL NOT DO ────────────────────────────────────────
 * It never shows anyone's raw logged number unless that person opted in with
 * `share_raw_value`. Someone competing on debt paydown is publishing a rate,
 * not a balance — and that distinction is the only reason a person will put a
 * real number into an app their friends can see.
 */
export function ClimbPitchView({
  pitch: p,
  period,
  routeName,
  userId,
  isOwner,
  isPremium,
  momentum,
  notice,
}: {
  pitch: ClimbPitch;
  period: Period;
  routeName: string;
  userId: string;
  isOwner: boolean;
  isPremium: boolean;
  momentum: Momentum | null;
  notice: { tone: "good" | "bad"; text: string } | null;
}) {
  const isStreak = p.metricType === "streak";
  const me = p.viewer;
  const above = me ? p.rows.find((r) => r.rank === me.rank - 1) : undefined;

  return (
    <AppShell>
      <header className="mb-block">
        <Link
          href={`/groups/${p.groupId}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-sage transition hover:text-snow"
        >
          <span aria-hidden>←</span> {routeName}
        </Link>
        <h1 className="font-display text-title font-semibold text-snow">{p.name}</h1>
        <p className="mt-1.5 text-body text-sage">{formatPeriod(period)}</p>
      </header>

      {notice && (
        <p
          className={`mb-block rounded-field px-4 py-3 text-body ring-1 ${
            notice.tone === "bad"
              ? "bg-fall/10 text-fall ring-fall/25"
              : "bg-ridge text-snow ring-scree"
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* ── Your position, at the scale of the thing you came to check ───── */}
      <section className="mb-chapter">
        {me ? (
          <>
            <p className="text-micro uppercase text-sage">Your position</p>
            <p className="mt-2 flex items-baseline gap-3">
              <span className="tnum -ml-1 font-display text-hero font-semibold text-snow">
                {me.rank}
              </span>
              <span className="text-lead text-sage">of {p.rows.length}</span>
              <span className="tnum ml-auto text-title font-medium text-snow">
                {isStreak
                  ? `${num(me.pctChange)}d`
                  : `${me.pctChange > 0 ? "+" : ""}${num(me.pctChange, fracOf(me.pctChange))}${
                      me.isAbsolute ? "" : "%"
                    }`}
              </span>
            </p>

            {p.gap !== null && above && (
              <p className="mt-3 text-body text-sage">
                <span className="tnum text-snow">
                  {num(p.gap, fracOf(p.gap))}
                  {isStreak ? " days" : me.isAbsolute ? "" : "%"}
                </span>{" "}
                to catch <span className="text-snow">{above.displayName}</span>
              </p>
            )}
            {p.gap === null && me.rank === 1 && (
              <p className="mt-3 text-body text-sage">
                Top of the pitch. {p.rows.length > 1 && "Everyone behind you can see it."}
              </p>
            )}
            {momentum && momentum.direction !== "steady" && (
              <p className="mt-1.5 text-body text-sage">
                {momentum.direction === "accelerating" ? "Faster" : "Slower"} than your own{" "}
                {momentum.over}-week average by{" "}
                <span className="tnum text-snow">
                  {num(Math.abs(momentum.delta), fracOf(momentum.delta))}
                </span>
                {isStreak ? " days" : me.isAbsolute ? "" : " points"}.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-micro uppercase text-sage">No position yet</p>
            <h2 className="mt-2 font-display text-display font-semibold text-snow">
              {p.logged ? (
                <>
                  Logged.
                  <br />
                  Waiting on
                  <br />
                  the ranking
                </>
              ) : (
                <>
                  Log a number
                  <br />
                  to join the
                  <br />
                  climb
                </>
              )}
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              {p.logged
                ? "Your line appears the moment the week's ranking runs."
                : "You are ranked on how far you move from your own baseline, not on where you start."}
            </p>
          </>
        )}

        <div className="mt-block">
          {p.series.length > 1 ? (
            <AscentLine values={p.series} height={150} label="Your trajectory" />
          ) : (
            <div className="py-6">
              <Horizon />
              <p className="mt-2 text-center text-caption text-sage">
                {p.series.length === 1
                  ? "One week in. The line needs a second point."
                  : "Your line starts the week you log."}
              </p>
            </div>
          )}
        </div>
      </section>

      {!p.logged && (
        <Link
          href={`/groups/${p.groupId}/categories/${p.id}/log-entry`}
          className="mb-chapter flex min-h-[3rem] w-full items-center justify-center rounded-pill bg-snow px-6 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
        >
          Log this week
        </Link>
      )}

      {/* ── The climb ────────────────────────────────────────────────────── */}
      <section className="mb-chapter border-t border-snow/25">
        <div className="flex items-baseline justify-between gap-4 py-block">
          <h2 className="font-display text-title font-semibold text-snow">The climb</h2>
          <span className="text-caption text-sage">
            {p.rows.length} ranked
          </span>
        </div>

        {p.rows.length === 0 ? (
          <p className="border-t border-scree/60 py-5 text-body text-sage">
            No one has been ranked this week. Be the first to move.
          </p>
        ) : (
          <ol className="border-t border-scree/60">
            {p.rows.map((r) => (
              <LeaderboardRow
                key={r.userId}
                isViewer={r.userId === userId}
                metricType={p.metricType}
                unit={p.unit}
                row={r}
              />
            ))}
          </ol>
        )}

        {p.rows.some((r) => r.isAbsolute) && !isStreak && (
          <p className="pt-4 text-meta text-sage/80">
            Some climbers started from zero, so their move is shown as an absolute change rather
            than a percentage. There is no honest percentage of nothing.
          </p>
        )}
      </section>

      {/* ── Trend ────────────────────────────────────────────────────────── */}
      <section className="mb-chapter border-t border-scree/60 pt-block">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <p className="text-micro uppercase text-sage">Your trend</p>
          {!isPremium && <span className="text-micro uppercase text-sage">Premium</span>}
        </div>
        {isPremium ? (
          p.series.length > 1 ? (
            <AscentLine values={p.series} height={110} label="Your trend over recent weeks" />
          ) : (
            <p className="text-body text-sage">
              One week in. Your trend fills out as you keep logging.
            </p>
          )
        ) : (
          <>
            <p className="max-w-[22rem] text-body text-sage">
              See whether your rate of climb is speeding up or slowing down, week over week.
            </p>
            <Link
              href="/billing"
              className="mt-5 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-ridge px-6 text-body text-snow ring-1 ring-scree transition hover:bg-scree"
            >
              Unlock trends
            </Link>
          </>
        )}
      </section>

      <div className="space-y-2.5">
        {me && (
          <form action={createShareCard}>
            <input type="hidden" name="group_id" value={p.groupId} />
            <input type="hidden" name="category_id" value={p.id} />
            <button className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-pill bg-ridge px-6 text-body text-snow ring-1 ring-scree transition hover:bg-scree">
              Make a rank card
            </button>
          </form>
        )}

        {isOwner && (
          <form action={recomputeCategory}>
            <input type="hidden" name="group_id" value={p.groupId} />
            <input type="hidden" name="category_id" value={p.id} />
            <button className="min-h-[3rem] w-full rounded-pill px-6 text-body text-sage transition hover:text-snow">
              Run the ranking now
            </button>
          </form>
        )}
      </div>

      <p className="mt-block text-meta text-sage/70">
        Positions come from each climber&apos;s rate of improvement against their own baseline.
        Nobody sees anyone else&apos;s raw number unless that person chose to show it.
      </p>
    </AppShell>
  );
}

/** Turn the action redirect's query into one sentence, or nothing. */
export function pitchNotice(sp: {
  logged?: string;
  recomputed?: string;
  error?: string;
}): { tone: "good" | "bad"; text: string } | null {
  if (sp.error) {
    return {
      tone: "bad",
      text:
        sp.error === "not_owner"
          ? "Only the group owner can run the ranking."
          : sp.error === "no_ranking"
            ? "You don't have a position yet. Log this week, then run the ranking."
            : "That didn't work. Try again.",
    };
  }
  if (sp.logged) return { tone: "good", text: "Logged. Your line moves when the ranking runs." };
  if (sp.recomputed) return { tone: "good", text: "Ranking updated." };
  return null;
}
