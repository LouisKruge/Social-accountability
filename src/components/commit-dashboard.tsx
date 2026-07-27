import Link from "next/link";
import { AppShell, EmptyState } from "@/components/ui";
import { SectionHeader } from "@/components/section-header";
import {
  ActivityFeed,
  Counter,
  DashSection,
  PaceChart,
  StatTile,
} from "@/components/dash";
import {
  Achievements,
  ActiveBet,
  ChallengeCard,
  HistoryRow,
  Standings,
} from "@/components/commit-cards";
import { Pool } from "@/components/pool";
import type { CommitDashboard } from "@/lib/commitDashboard";
import { num, zar } from "@/lib/format";

/**
 * COMMIT — the dashboard.
 *
 * Dense on purpose: a person with money on the line should be able to answer
 * "where do I stand, what do I owe today, what comes back if I finish" without
 * tapping anything. It borrows its density from a trading app and its clarity
 * from a fitness app, and it deliberately borrows nothing from a casino:
 *
 *   • Every outcome shown is a function of the user's own verified effort.
 *     There is no chance element anywhere on this page — no spins, no bonuses,
 *     no multipliers, nothing that resolves on anything but steps walked.
 *   • Gold is only ever money that has actually been paid to you. Projections,
 *     pools and stakes are all cool-toned, so the eye can tell settled from
 *     estimated without reading a word.
 *   • The leaderboards rank effort. Commit has no "top earners" board, because
 *     one person's stake is nobody else's business.
 *
 * Rendered from `CommitDashboard`, which the design harness can also supply, so
 * what gets reviewed in the harness is literally this component.
 */
export function CommitDashboardView({ data }: { data: CommitDashboard }) {
  const { hero, active, open, activity, standings, climbers, analytics, achievements, history } =
    data;
  const hasAnything = active.length > 0 || history.length > 0;
  const primary = active[0];
  const totalPool = active.reduce((t, a) => t + a.poolTotal, 0);
  const totalInPlay = active.reduce((t, a) => t + a.participants, 0);
  const nextClose = active.length ? Math.min(...active.map((a) => a.daysRemaining)) : null;
  // Pools are drawn to a shared scale, so a fuller vessel really does hold more.
  const biggestOpenPool = Math.max(1, ...open.map((c) => c.poolTotal));

  return (
    <AppShell>
      <SectionHeader
        eyebrow="Bet on yourself"
        title="Commit"
        blurb="Put money on a target you set. You win it back by walking, not by guessing."
        accent="ice"
      />

      {/* ── 1 · Status strip — the state of play, above everything ─────────── */}
      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 text-[0.68rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ice/10 px-2.5 py-1 text-ice ring-1 ring-ice/20">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ice" />
          {hero.activeCount} live
        </span>
        {nextClose !== null && (
          <span className="shrink-0 rounded-full bg-ridge px-2.5 py-1 text-sage ring-1 ring-scree">
            Next settles in {nextClose}d
          </span>
        )}
        <span className="shrink-0 rounded-full bg-ridge px-2.5 py-1 text-sage ring-1 ring-scree">
          {open.length} open to join
        </span>
      </div>

      {/* ── 2 · Your position ──────────────────────────────────────────────── */}
      <section className="relative mb-6 overflow-hidden rounded-card bg-slope p-5 ring-1 ring-scree/70">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(ellipse_at_top,rgba(127,220,192,0.13),transparent_70%)]"
        />
        <div className="relative">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-sage">
                Riding on your discipline
              </p>
              <p className="tnum mt-1.5 font-display text-[2.75rem] font-semibold leading-none tracking-tightest text-snow">
                <Counter value={hero.atStake} prefix="R" />
              </p>
              {hero.awaitingEft > 0 && (
                <p className="mt-2 text-xs text-sage">
                  <span className="tnum text-snow/80">{zar(hero.awaitingEft)}</span> waiting on your
                  EFT
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-sage">Paid to you</p>
              {/* the one gold figure up here: money that actually landed */}
              <p className="tnum mt-1.5 font-display text-2xl font-semibold leading-none text-summit">
                <Counter value={hero.lifetimeWon} prefix="R" />
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-scree/50 pt-4 text-center">
            {[
              { k: "Hit rate", v: hero.winRate === null ? "—" : `${Math.round(hero.winRate * 100)}%` },
              { k: "Finished", v: String(hero.cohortsCompleted) },
              { k: "Streak", v: `${hero.streak}d` },
              {
                k: "Logged",
                v:
                  hero.totalLogged >= 1000
                    ? `${Math.round(hero.totalLogged / 1000)}k`
                    : String(hero.totalLogged),
              },
            ].map((s) => (
              <div key={s.k}>
                <dt className="text-[0.6rem] uppercase tracking-wider text-sage">{s.k}</dt>
                <dd className="tnum mt-1 font-display text-base font-semibold text-snow">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 3 · Your live bet ──────────────────────────────────────────────── */}
      {primary ? (
        <div className="mb-7 space-y-3">
          {active.map((b) => (
            <ActiveBet key={b.cohortId} b={b} />
          ))}
        </div>
      ) : (
        <div className="mb-7">
          <EmptyState
            title="Nothing on the line yet"
            body="Pick a challenge below, stake what it costs, and the only thing between you and the pool is your own step count."
          />
        </div>
      )}

      {/* ── 4 · Quick actions ──────────────────────────────────────────────── */}
      <div className="mb-7 grid grid-cols-3 gap-2">
        {[
          { href: primary ? `/commit/${primary.cohortId}` : "/commit", label: "Log steps", glyph: "＋" },
          { href: "/commit/new", label: "Start one", glyph: "◎" },
          { href: "/you", label: "Ledger", glyph: "≡" },
        ].map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex flex-col items-center gap-1.5 rounded-field bg-ridge py-3 text-[0.7rem] text-snow ring-1 ring-scree transition hover:bg-scree"
          >
            <span aria-hidden className="text-base text-ice">
              {a.glyph}
            </span>
            {a.label}
          </Link>
        ))}
      </div>

      {/* ── 5 · Open challenges — the market ───────────────────────────────── */}
      <div id="open">
        <DashSection
          title="Open to join"
          action={
            <Link href="/commit/new" className="text-[0.68rem] text-ice transition hover:text-snow">
              Start one →
            </Link>
          }
        >
          {open.length === 0 ? (
            <EmptyState
              title="Nothing open right now"
              body="Set a target and a stake, share it with the people who will actually hold you to it, and it shows up here for them to join."
              cta={
                <Link
                  href="/commit/new"
                  className="inline-flex w-full items-center justify-center rounded-field bg-ice px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-ice-soft"
                >
                  Start a challenge
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {open.map((c) => (
                <ChallengeCard key={c.id} c={c} scale={biggestOpenPool} />
              ))}
            </div>
          )}
        </DashSection>
      </div>

      {/* ── 6 · Live pools rail ────────────────────────────────────────────── */}
      {active.length > 0 && (
        <DashSection
          title="Pools you're in"
          action={
            <span className="tnum text-[0.68rem] text-sage">
              {zar(totalPool)} · {totalInPlay} in
            </span>
          }
        >
          {/* A one-item "rail" is just a card that stops short of the edge, so a
              single pool goes full width and only a real set scrolls. */}
          <div
            className={
              active.length > 1
                ? "-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                : "block"
            }
          >
            {active.map((a) => (
              <Link
                key={a.cohortId}
                href={`/commit/${a.cohortId}`}
                className={`block rounded-card bg-slope p-4 ring-1 ring-scree/70 transition hover:ring-ice/25 ${
                  active.length > 1 ? "w-[13.5rem] shrink-0" : "w-full"
                }`}
              >
                <p className="truncate text-sm text-snow/90">{a.name}</p>
                <div className="mt-2">
                  <Pool
                    filled={a.poolTotal}
                    capacity={Math.max(a.poolTotal, a.stake * 20)}
                    participants={a.participants}
                    height={68}
                  />
                </div>
                <p className="tnum mt-2 flex justify-between text-[0.68rem]">
                  <span className="text-snow/90">{zar(a.poolTotal)}</span>
                  <span className="text-sage">{a.participants} in</span>
                </p>
              </Link>
            ))}
          </div>
        </DashSection>
      )}

      {/* ── 7 · Activity ───────────────────────────────────────────────────── */}
      {activity.length > 0 && (
        <DashSection title="Recent activity">
          <div className="rounded-card bg-slope/60 px-4 py-1 ring-1 ring-scree/50">
            <ActivityFeed items={activity} />
          </div>
        </DashSection>
      )}

      {/* ── 8 · Cohort standings — effort only ─────────────────────────────── */}
      {standings && (
        <DashSection
          title="Standings"
          action={<span className="truncate text-[0.68rem] text-sage">{standings.cohortName}</span>}
        >
          <Standings rows={standings.rows} />
        </DashSection>
      )}

      {/* ── 9 · Across every challenge you've shared ───────────────────────── */}
      {data.cohortsJoined > 1 && climbers.length > 1 && (
        <DashSection
          title="Best runs, all challenges"
          action={<span className="text-[0.68rem] text-sage">% of own target</span>}
        >
          <Standings rows={climbers} limit={5} />
        </DashSection>
      )}

      {/* ── 10 · Performance ───────────────────────────────────────────────── */}
      {analytics && (
        <DashSection
          title="Your pace"
          action={<span className="truncate text-[0.68rem] text-sage">{analytics.cohortName}</span>}
        >
          <div className="rounded-card bg-slope p-5 ring-1 ring-scree/70">
            <PaceChart actual={analytics.actual} required={analytics.required} />
            <p className="mt-2 flex items-center justify-center gap-4 text-[0.65rem] text-sage">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-4 rounded-full bg-ice" /> you
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-0 w-4 border-t border-dashed border-scree"
                />{" "}
                needed to finish
              </span>
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <StatTile
                label="Consistency"
                tone={analytics.consistency !== null && analytics.consistency >= 0.7 ? "good" : "default"}
                hint={`${analytics.loggedDays} of ${analytics.elapsedDays} days at target`}
              >
                {analytics.consistency === null ? "—" : `${Math.round(analytics.consistency * 100)}%`}
              </StatTile>
              <StatTile label="Best day">{num(analytics.bestDay)}</StatTile>
              <StatTile label="Daily average">
                {num(analytics.avgDay)}
              </StatTile>
              <StatTile
                label="On this pace"
                tone={
                  analytics.projectedTotal !== null && analytics.projectedTotal >= analytics.target
                    ? "good"
                    : "bad"
                }
                hint="Your rate so far, run to the last day"
              >
                {analytics.projectedTotal === null
                  ? "—"
                  : num(analytics.projectedTotal)}
              </StatTile>
            </div>
          </div>
        </DashSection>
      )}

      {/* ── 11 · Achievements ──────────────────────────────────────────────── */}
      <DashSection
        title="Milestones"
        action={
          <span className="tnum text-[0.68rem] text-sage">
            {achievements.filter((a) => a.unlocked).length}/{achievements.length}
          </span>
        }
      >
        <Achievements items={achievements} />
      </DashSection>

      {/* ── 12 · History ───────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <DashSection title="Finished">
          <ul className="space-y-1.5">
            {history.map((h) => (
              <HistoryRow key={h.id} h={h} />
            ))}
          </ul>
        </DashSection>
      )}

      {/* ── The terms, stated plainly at the bottom of every visit ─────────── */}
      <section className="rounded-card bg-slope/50 p-5 ring-1 ring-scree/50">
        <h2 className="text-xs uppercase tracking-[0.16em] text-sage">How this pays</h2>
        <ol className="mt-3 space-y-2 text-xs leading-relaxed text-sage">
          <li>
            <span className="text-snow/90">1.</span> Everyone who joins stakes the same amount. That
            is the pool.
          </li>
          <li>
            <span className="text-snow/90">2.</span> Hit your target by the closing date and you
            share the pool with everyone else who did, after a{" "}
            {Math.round(data.feeRate * 100)}% platform fee.
          </li>
          <li>
            <span className="text-snow/90">3.</span> Miss it and your stake goes to the people who
            made it.
          </li>
          <li>
            <span className="text-snow/90">4.</span> If nobody hits it, everybody is refunded in
            full and no fee is charged.
          </li>
        </ol>
        <p className="mt-4 border-t border-scree/50 pt-3 text-[0.68rem] leading-relaxed text-sage/80">
          Every outcome here is decided by your own verified steps. There is no chance element, no
          bonus round and no multiplier — you cannot get lucky and you cannot get unlucky. Stakes are
          collected and paid by manual EFT while this is in beta.
        </p>
      </section>

      {!hasAnything && (
        <p className="mt-5 text-center text-xs leading-relaxed text-sage/70">
          Your numbers fill in as you go — nothing above is a sample.
        </p>
      )}
    </AppShell>
  );
}
