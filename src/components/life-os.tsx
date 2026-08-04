import Link from "next/link";
import { AppShell } from "@/components/ui";
import { Counter } from "@/components/dash";
import { AscentLine } from "@/components/ascent";
import { UNAVAILABLE_NOTE, type LifeOs } from "@/lib/lifeOs";
import { fracOf, num, zar } from "@/lib/format";

/**
 * THE LIFE OS — Layer 1 made visible.
 *
 * The Discipline Score is the subject, at hero scale, directly on the black.
 * Underneath it, in descending order of what a person can act on: momentum,
 * what the score is actually made of, what the current pace predicts, the
 * simulator, the portfolio, and the record.
 *
 * ── THE COVERAGE PANEL IS NOT AN APOLOGY ─────────────────────────────────────
 * A score that gates access to challenges has to show its working. The panel
 * lists every signal, what it contributed in points, and — for the two Ascend
 * cannot measure — that they are missing and what they are worth. A person who
 * disagrees with their score can see exactly which line to argue with, and a
 * person deciding whether to connect a tracker can see exactly what it buys.
 */
export function LifeOsView({ os }: { os: LifeOs }) {
  const { discipline, momentum, tier, index, percentile, portfolio, legacy, outlook, brief } = os;

  return (
    <AppShell>
      <header className="mb-block flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">Your operating system</p>
          <h1 className="font-display text-title font-semibold text-snow">Discipline</h1>
        </div>
        <div className="flex shrink-0 items-baseline gap-4">
          <Link href="/season" className="text-xs text-sage transition hover:text-snow">
            Season
          </Link>
          <Link href="/home" className="text-xs text-sage transition hover:text-snow">
            Today
          </Link>
        </div>
      </header>

      {/* ── The score ────────────────────────────────────────────────────── */}
      <section className="mb-chapter">
        {discipline.score === null ? (
          <>
            <p className="text-micro uppercase text-sage">Not measured yet</p>
            <h2 className="mt-2 max-w-[18rem] font-display text-display font-semibold text-snow">
              Log one week and this starts
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              Your Discipline Score is built from what you actually do — completion, consistency,
              momentum and verification. It has nothing to score yet.
            </p>
          </>
        ) : (
          <>
            <p className="text-micro uppercase text-sage">Discipline Score</p>
            <p className="tnum -ml-1 mt-2 font-display text-hero font-semibold text-snow">
              <Counter value={discipline.score} />
            </p>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body text-sage">
              <span className="text-snow">{discipline.band}</span>
              <span>of 1,000</span>
              {tier && <span>· {tier.name}</span>}
              {percentile !== null && <span>· top {percentile}%</span>}
            </p>
            {tier?.next && (
              <p className="mt-1.5 text-body text-sage">
                <span className="tnum text-snow">{tier.next.pointsAway}</span> points to{" "}
                {tier.next.name}.
              </p>
            )}
            {percentile === null && discipline.score !== null && (
              <p className="mt-1.5 text-caption text-sage/70">
                A percentile needs a bigger field than Ascend has yet. It appears when there are
                enough climbers for it to mean anything.
              </p>
            )}
          </>
        )}

        {/* The index — only once there is real history behind it. */}
        {index && index.points.length > 1 && (
          <div className="mt-block border-t border-scree/60 pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-micro uppercase text-sage">Performance index</p>
              <p className="tnum text-body text-snow">
                {num(index.value)}
                {index.changePct !== null && (
                  <span className="ml-2 text-sage">
                    {index.changePct >= 0 ? "+" : "−"}
                    {num(Math.abs(index.changePct), fracOf(index.changePct))}%
                  </span>
                )}
              </p>
            </div>
            <div className="mt-2">
              <AscentLine
                values={index.points.map((p) => p.value - 1000)}
                height={110}
                label="Your performance index since you started"
              />
            </div>
            {index.volatility !== null && (
              <p className="mt-1 text-caption text-sage">
                Volatility <span className="tnum text-snow">{num(index.volatility, 1)}</span> — how
                much your score swings day to day. Lower is steadier.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Momentum ─────────────────────────────────────────────────────── */}
      {momentum.score > 0 && (
        <section className="mb-chapter border-t border-snow/25">
          <div className="flex items-baseline justify-between gap-4 py-block">
            <div>
              <h2 className="font-display text-title font-semibold text-snow">Momentum</h2>
              <p className="mt-1.5 text-caption text-sage">
                {momentum.direction === "building"
                  ? "Building"
                  : momentum.direction === "slipping"
                    ? "Slipping"
                    : "Holding"}
                {momentum.delta !== null && (
                  <>
                    {" "}
                    · <span className="tnum">{momentum.delta >= 0 ? "+" : "−"}
                    {Math.abs(momentum.delta)}</span> over seven logged days
                  </>
                )}
              </p>
            </div>
            <p className="tnum shrink-0 font-display text-display font-semibold text-snow">
              {momentum.score}
            </p>
          </div>
          <p className="border-t border-scree/60 pt-4 text-body text-sage">
            {momentum.missStreak === 0 ? (
              "This is not a streak. One missed day barely moves it — a week of missed days does."
            ) : momentum.missStreak < 3 ? (
              <>
                <span className="text-snow">{momentum.missStreak}</span>{" "}
                {momentum.missStreak === 1 ? "day" : "days"} missed. Barely a dent — that is the
                point of measuring momentum instead of a streak.
              </>
            ) : (
              <>
                <span className="text-snow">{momentum.missStreak} days</span> missed in a row. This
                is the part that costs you. One day back starts the recovery.
              </>
            )}
          </p>
        </section>
      )}

      {/* ── What the score is made of ────────────────────────────────────── */}
      {discipline.score !== null && (
        <section className="mb-chapter border-t border-snow/25">
          <div className="flex items-baseline justify-between gap-4 py-block">
            <h2 className="font-display text-title font-semibold text-snow">What it&apos;s made of</h2>
            <span className="shrink-0 text-caption text-sage">
              {Math.round(discipline.coverage * 100)}% measured
            </span>
          </div>

          <ul className="border-t border-scree/60">
            {discipline.contributions.map((c) => (
              <li key={c.key} className="border-b border-scree/40 py-3.5 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-body text-snow">{c.label}</span>
                  <span className="tnum shrink-0 text-body text-sage">
                    +{c.share}
                  </span>
                </div>
                <div aria-hidden className="mt-2 h-px w-full bg-scree">
                  <div
                    className="h-px bg-snow"
                    style={{ width: `${Math.round(c.value * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {discipline.missing.length > 0 && (
            <>
              <p className="pt-block text-micro uppercase text-sage">Not measured</p>
              <ul className="mt-3 border-t border-scree/60">
                {discipline.missing.map((m) => (
                  <li
                    key={m.key}
                    className="flex items-baseline justify-between gap-3 border-b border-scree/40 py-3.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1 text-body text-sage">
                      {m.label}
                      {UNAVAILABLE_NOTE[m.key] && (
                        <span className="block text-caption text-sage/70">
                          {UNAVAILABLE_NOTE[m.key]}
                        </span>
                      )}
                    </span>
                    <span className="tnum shrink-0 text-caption text-sage">
                      worth {m.weight}%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="pt-4 text-meta text-sage/70">
                Missing signals are left out of the calculation rather than counted as zero. Your
                score is measured over what Ascend can actually see.
              </p>
            </>
          )}
        </section>
      )}

      {/* ── Outlook and simulator ────────────────────────────────────────── */}
      {outlook.length > 0 && (
        <section className="mb-chapter border-t border-snow/25">
          <h2 className="py-block font-display text-title font-semibold text-snow">
            What your pace predicts
          </h2>

          {outlook.map((o) => (
            <div key={o.cohortId} className="border-t border-scree/60 py-block">
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0 truncate text-body text-snow">{o.name}</p>
                <p className="tnum shrink-0 text-caption text-sage">{zar(o.stake)} on the line</p>
              </div>

              {o.projection ? (
                <>
                  <p className="tnum mt-3 font-display text-display font-semibold text-snow">
                    {Math.round(o.projection.probability * 100)}%
                  </p>
                  <p className="mt-1.5 text-body text-sage">
                    chance of hitting the target at your current{" "}
                    <span className="tnum text-snow">{num(o.projection.currentRate)}</span> a day.
                    You need <span className="tnum text-snow">{num(o.projection.requiredRate)}</span>
                    .
                    {o.projection.expectedCompletionDay !== null && (
                      <>
                        {" "}
                        On this pace you finish on day{" "}
                        <span className="tnum text-snow">{o.projection.expectedCompletionDay}</span>.
                      </>
                    )}
                  </p>

                  {o.simulation && (
                    <ul className="mt-block border-t border-scree/60">
                      {o.simulation.map((row) => (
                        <li
                          key={row.rate}
                          className="flex items-center gap-3 border-b border-scree/40 py-3 last:border-0"
                        >
                          <span className="tnum w-20 shrink-0 text-body text-snow">
                            {num(row.rate)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span aria-hidden className="block h-px w-full bg-scree">
                              <span
                                className="block h-px bg-snow"
                                style={{ width: `${Math.round(row.probability * 100)}%` }}
                              />
                            </span>
                          </span>
                          <span className="tnum w-12 shrink-0 text-right text-body text-sage">
                            {Math.round(row.probability * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-4 text-meta text-sage/70">
                    Worked out from your own logged days — your average and how much you vary,
                    across the days you have left. Someone steady and someone erratic with the same
                    average do not get the same answer.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-body text-sage">{o.note}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Life portfolio ───────────────────────────────────────────────── */}
      <section className="mb-chapter border-t border-snow/25">
        <h2 className="py-block font-display text-title font-semibold text-snow">
          Your portfolio
        </h2>
        <ul className="border-t border-scree/60">
          {portfolio.map((line) => (
            <li
              key={line.area}
              className="flex items-baseline justify-between gap-3 border-b border-scree/40 py-4 last:border-0"
            >
              <span className="min-w-0 flex-1 truncate text-body text-snow">{line.area}</span>
              {line.change !== null ? (
                <span className="tnum shrink-0 text-body text-snow">
                  {line.change >= 0 ? "+" : "−"}
                  {num(Math.abs(line.change), fracOf(line.change))}
                  {line.unit === "points" ? " pts" : "%"}
                </span>
              ) : (
                <span className="shrink-0 text-caption text-sage">{line.note}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="pt-4 text-meta text-sage/70">
          Change over the last 90 days. Lines already measured in percentages move in points, not
          in percentages of percentages. A line with nothing to compare against says so rather than
          showing you a zero.
        </p>
      </section>

      {/* ── The record ───────────────────────────────────────────────────── */}
      {legacy.firstDay && (
        <section className="border-t border-snow/25">
          <h2 className="py-block font-display text-title font-semibold text-snow">
            Since you started
          </h2>
          <dl className="grid grid-cols-2 gap-x-gutter border-t border-scree/60">
            <Stat label="Logged" value={num(legacy.totalLogged)} />
            <Stat label="Days" value={num(legacy.daysLogged)} border />
            <Stat label="Challenges" value={num(legacy.challengesEntered)} top />
            <Stat label="Won" value={num(legacy.challengesWon)} border top />
            <Stat label="Weeks ranked" value={num(legacy.weeksRanked)} top />
            <Stat label="Earned" value={zar(legacy.earned)} border top gold={legacy.earned > 0} />
          </dl>
          <p className="pt-4 text-meta text-sage/70">
            Since {new Date(`${legacy.firstDay}T00:00:00Z`).toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
            .
          </p>
        </section>
      )}

      {brief.length > 0 && (
        <section className="mt-chapter border-t border-scree/60 pt-block">
          <p className="mb-4 text-micro uppercase text-sage">Today</p>
          <ul>
            {brief.map((b) => {
              const body = (
                <>
                  <span className="w-28 shrink-0 text-micro uppercase text-sage">{b.label}</span>
                  <span className="min-w-0 flex-1 text-body text-snow">{b.value}</span>
                </>
              );
              return (
                <li key={b.label} className="border-b border-scree/40 last:border-0">
                  {b.href ? (
                    <Link href={b.href} className="group flex items-center gap-3 py-3.5">
                      {body}
                      <span
                        aria-hidden
                        className="shrink-0 text-caption text-sage transition group-hover:translate-x-1 group-hover:text-snow"
                      >
                        →
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-3.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="mt-chapter text-meta text-sage/70">
        Every number here is computed from your own logged days by a formula you could reproduce
        with a calculator. Nothing on this screen is generated, estimated from other people, or
        inferred from data Ascend does not have.
      </p>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  border,
  top,
  gold,
}: {
  label: string;
  value: string;
  border?: boolean;
  top?: boolean;
  gold?: boolean;
}) {
  return (
    <div
      className={`py-5 ${border ? "border-l border-scree/60 pl-5" : "pr-3"} ${
        top ? "border-t border-scree/60" : ""
      }`}
    >
      <dt className="text-micro uppercase text-sage">{label}</dt>
      <dd
        className={`tnum mt-2 font-display text-2xl font-semibold leading-none ${
          gold ? "text-summit" : "text-snow"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
