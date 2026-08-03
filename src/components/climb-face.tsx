import Link from "next/link";
import { AppShell } from "@/components/ui";
import { Counter } from "@/components/dash";
import { MiniAscent } from "@/components/ascent";
import { CreateOrJoin } from "@/app/groups/group-forms";
import type { ClimbPitch, ClimbState } from "@/lib/climb";
import { formatPeriod } from "@/lib/period";
import { fracOf, num, ordinal } from "@/lib/format";

/**
 * THE FACE — Climb's front page.
 *
 * Commit's home is a grid of module tiles; Elevate's is a column of studios.
 * Climb is neither, and copying either would have made three modes that look
 * the same and mean different things. Climb is about other people, so its
 * structure is a BANDED INDEX: each route is a full-width band with its own
 * masthead, and the pitches inside it are hairline rows. Nothing is a card.
 *
 * The hero is one move — the strongest thing the person did this week — at four
 * times the size of anything near it, sitting directly on the black. Not a
 * composite score, because a composite of a savings percentage and a step
 * streak is a number nobody could reproduce from their own data.
 */
export function ClimbFace({ state }: { state: ClimbState }) {
  const { best, momentum, weeks, routes, pending, period } = state;
  const climbers = new Set(routes.flatMap((r) => r.members.map((m) => m.userId))).size;

  return (
    <AppShell>
      <header className="mb-block flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">The face</p>
          <h1 className="font-display text-title font-semibold text-snow">Climb</h1>
        </div>
        <Link href="/home" className="shrink-0 text-xs text-sage transition hover:text-snow">
          All sections
        </Link>
      </header>

      {/* ── The figure ──────────────────────────────────────────────────────
          No card, no ring, no background. §1.1 of the design language: what
          makes a number read as the subject rather than a statistic inside a
          widget is that nothing contains it. */}
      <section className="mb-chapter">
        {best ? (
          <>
            <p className="text-micro uppercase text-sage">Your strongest move this week</p>
            <p className="tnum -ml-1 mt-2 font-display text-hero font-semibold text-snow">
              {best.metricType === "streak" ? (
                <>
                  <Counter value={best.value} />
                  <span className="ml-2 font-sans text-display text-sage">
                    {best.unit || "day"}
                    {best.value === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <>
                  <span className={best.value < 0 ? "text-sage" : undefined}>
                    {best.value > 0 ? "+" : best.value < 0 ? "−" : ""}
                  </span>
                  <Counter value={Math.abs(best.value)} decimals={fracOf(best.value)} />
                  <span className="font-sans text-display">
                    {best.isAbsolute ? (best.unit ? ` ${best.unit}` : "") : "%"}
                  </span>
                </>
              )}
            </p>
            <p className="mt-3 max-w-[22rem] text-body text-sage">
              <span className="text-snow">{best.pitchName}</span> in {best.routeName} —{" "}
              <span className="tnum text-snow">{ordinal(best.rank)}</span> of {best.fieldSize}
              {best.isAbsolute && best.metricType !== "streak" && (
                <span className="text-sage"> · measured from zero</span>
              )}
            </p>
            {momentum && momentum.direction !== "steady" && (
              <p className="mt-2 max-w-[22rem] text-body text-sage">
                {momentum.direction === "accelerating" ? "Faster" : "Slower"} than your own{" "}
                {momentum.over}-week average by{" "}
                <span className="tnum text-snow">{num(Math.abs(momentum.delta), fracOf(momentum.delta))}</span>
                {best.metricType === "streak" ? " days" : best.isAbsolute ? "" : " points"}.
              </p>
            )}
          </>
        ) : routes.length === 0 ? (
          <>
            <p className="text-micro uppercase text-sage">No route yet</p>
            <h2 className="mt-2 font-display text-display font-semibold text-snow">
              Climb with
              <br />
              people who
              <br />
              will notice
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              Start a group or join a friend&apos;s with their code. You compete on how fast you
              improve from your own starting point — so the person furthest behind can still win the
              week.
            </p>
          </>
        ) : (
          <>
            <p className="text-micro uppercase text-sage">Nothing ranked yet</p>
            <h2 className="mt-2 font-display text-display font-semibold text-snow">
              Your line
              <br />
              starts the
              <br />
              week you log
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              {pending.length > 0 ? (
                <>
                  <span className="text-snow">{pending[0].pitchName}</span> in {pending[0].routeName}{" "}
                  is waiting for a number.
                </>
              ) : (
                <>The ranking runs once the week&apos;s numbers are in.</>
              )}
            </p>
            {pending.length > 0 && (
              <Link
                href={`/groups/${pending[0].routeId}/categories/${pending[0].pitchId}/log-entry`}
                className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
              >
                Log this week
              </Link>
            )}
          </>
        )}

        {routes.length > 0 && (
          <dl className="mt-block flex flex-wrap gap-x-8 gap-y-3 border-t border-scree/60 pt-4">
            <Figure label="Weeks" value={weeks} caption={weeks === 1 ? "logged" : "in a row"} />
            <Figure label="Routes" value={routes.length} caption={routes.length === 1 ? "group" : "groups"} />
            <Figure label="Climbers" value={climbers} caption="with you" />
          </dl>
        )}
      </section>

      {/* ── Performance DNA ───────────────────────────────────────────────
          Computed from the viewer's OWN entries and shown only to them. A
          group cannot see a member's raw logs, so a roster-wide label derived
          from them would launder private data into a public one. */}
      {state.dna.primary && (
        <section className="mb-chapter border-t border-snow/25">
          <div className="flex items-baseline justify-between gap-4 py-block">
            <h2 className="font-display text-title font-semibold text-snow">
              {state.dna.primary.name}
            </h2>
            <span className="shrink-0 text-caption text-sage">
              {state.dna.daysAnalysed} weeks read
            </span>
          </div>
          <p className="border-t border-scree/60 pt-4 text-body text-sage">
            {state.dna.primary.blurb}
          </p>
          <ul className="mt-block border-t border-scree/60">
            {state.dna.traits.map((t) => (
              <li
                key={t.key}
                className="flex items-baseline justify-between gap-3 border-b border-scree/40 py-3.5 last:border-0"
              >
                <span className="min-w-0 flex-1 text-body text-snow">{t.name}</span>
                <span className="shrink-0 text-caption text-sage">{t.evidence}</span>
              </li>
            ))}
          </ul>
          <p className="pt-4 text-meta text-sage/70">
            Read from your own weeks, and shown only to you — your group sees rates of change, not
            the numbers behind them.
          </p>
        </section>
      )}

      {/* ── Anything waiting on the viewer ───────────────────────────────── */}
      {best && pending.length > 0 && (
        <Link
          href={`/groups/${pending[0].routeId}/categories/${pending[0].pitchId}/log-entry`}
          className="mb-chapter flex items-center gap-3 rounded-field bg-ridge px-4 py-3 ring-1 ring-scree transition hover:bg-scree"
        >
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
          <span className="min-w-0 flex-1 text-xs leading-snug text-snow">
            {pending.length === 1
              ? `${pending[0].pitchName} has no number this week`
              : `${pending.length} pitches have no number this week`}
          </span>
          <span aria-hidden className="shrink-0 text-xs text-sage">
            →
          </span>
        </Link>
      )}

      {/* ── The routes ───────────────────────────────────────────────────── */}
      {routes.map((r) => (
        <section key={r.id} className="mb-chapter border-t border-snow/25">
          <Link href={`/groups/${r.id}`} className="group flex items-baseline justify-between gap-4 py-block">
            <div className="min-w-0">
              <h2 className="truncate font-display text-title font-semibold text-snow">{r.name}</h2>
              <p className="mt-1.5 text-caption text-sage">
                {r.memberCount} {r.memberCount === 1 ? "climber" : "climbers"}
                {r.isOwner && " · yours"}
                {r.bestRank !== null && (
                  <>
                    {" "}
                    · best position <span className="tnum text-snow">{ordinal(r.bestRank)}</span>
                  </>
                )}
              </p>
            </div>
            <span
              aria-hidden
              className="shrink-0 text-caption text-sage transition group-hover:translate-x-1 group-hover:text-snow"
            >
              →
            </span>
          </Link>

          {r.pitches.length === 0 ? (
            <p className="border-t border-scree/60 py-5 text-body text-sage">
              Nothing to climb yet.{" "}
              <Link href={`/groups/${r.id}`} className="text-snow underline underline-offset-4">
                Add the first pitch
              </Link>
              .
            </p>
          ) : (
            <ul className="border-t border-scree/60">
              {r.pitches.map((p) => (
                <li key={p.id} className="border-b border-scree/40 last:border-0">
                  <PitchLine pitch={p} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="border-t border-scree/60 pt-block">
        <p className="mb-4 text-micro uppercase text-sage">Add a route</p>
        <CreateOrJoin />
        <p className="mt-4 text-meta text-sage/80">
          Week of {formatPeriod(period)}. Free plan: one group you own, one pitch.{" "}
          <Link href="/billing" className="text-snow underline underline-offset-4">
            See Premium
          </Link>
        </p>
      </section>
    </AppShell>
  );
}

/**
 * One pitch, as a line rather than a card.
 *
 * The position is the loud part and the rate is the quiet part, because a rank
 * is what someone came to check and a percentage is what they read second.
 */
function PitchLine({ pitch: p }: { pitch: ClimbPitch }) {
  const href = p.viewer
    ? `/groups/${p.groupId}/categories/${p.id}/leaderboard`
    : `/groups/${p.groupId}/categories/${p.id}/log-entry`;

  return (
    <Link href={href} className="group flex items-center gap-3 py-4">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-snow">{p.name}</span>
        <span className="mt-0.5 block text-caption text-sage">
          {p.viewer ? (
            <>
              <span className="tnum">{ordinal(p.viewer.rank)}</span> of {p.rows.length}
              {p.gap !== null && (
                <>
                  {" "}
                  · <span className="tnum">{num(p.gap, fracOf(p.gap))}</span>
                  {p.metricType === "streak" ? " days" : p.viewer.isAbsolute ? "" : "%"} to the rung
                  above
                </>
              )}
            </>
          ) : p.logged ? (
            "Logged — waiting on the ranking"
          ) : (
            "No number this week"
          )}
        </span>
      </span>

      {p.series.length > 1 && (
        <span className="hidden shrink-0 min-[360px]:block">
          <MiniAscent
            values={p.series}
            climbing={p.series[p.series.length - 1] >= p.series[0]}
            width={60}
            height={24}
          />
        </span>
      )}

      <span className="tnum w-[4.5rem] shrink-0 text-right text-body text-snow">
        {p.viewer ? (
          p.metricType === "streak" ? (
            `${num(p.viewer.pctChange)}d`
          ) : (
            `${p.viewer.pctChange > 0 ? "+" : ""}${num(p.viewer.pctChange, fracOf(p.viewer.pctChange))}${
              p.viewer.isAbsolute ? "" : "%"
            }`
          )
        ) : (
          <span className="text-sage/60">—</span>
        )}
      </span>

      <span
        aria-hidden
        className="shrink-0 text-caption text-sage transition group-hover:translate-x-1 group-hover:text-snow"
      >
        →
      </span>
    </Link>
  );
}

function Figure({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div>
      <dt className="text-micro uppercase text-sage">{label}</dt>
      <dd className="tnum mt-1 font-display text-lg text-snow">
        {value}
        <span className="ml-1.5 font-sans text-caption text-sage">{caption}</span>
      </dd>
    </div>
  );
}

