import Link from "next/link";
import { AppShell } from "@/components/ui";
import { Counter } from "@/components/dash";
import { CommandBar, type CommandTarget } from "@/components/exchange-shell";
import { MODULES, type ExchangeState } from "@/lib/exchange";
import { probabilityPct, type Position, type PositionHealth } from "@/lib/position";
import { fracOf, num, zar } from "@/lib/format";

/**
 * THE DISCIPLINE EXCHANGE — the terminal.
 *
 * ── WHAT MAKES THIS A TERMINAL AND NOT A DASHBOARD ───────────────────────────
 * A dashboard shows you how things are. A terminal shows you what your position
 * is and what it needs from you today. So the hero is CAPITAL AT RISK — not a
 * balance, not a streak, not a greeting — and directly underneath it sits the
 * single number that changes the outcome: what today has to produce.
 *
 * Everything below is the position book: one row per open challenge, with its
 * exposure, its health, and the strain it is currently under. Dense on purpose,
 * because a person with three positions open is checking, not browsing.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 * No "AI confidence" (there is no model in this path — the probability comes
 * from the person's own mean and variance and says so). No weather impact, no
 * GPS, no recovery score: Ascend has no feed for any of them, and a number
 * about somebody's body that nothing measured is the one thing this product
 * will not print.
 */
export function ExchangeTerminal({ state }: { state: ExchangeState }) {
  const { dashboard, wallet, positions, portfolio, modules, headline, integritySummary } = state;

  const cheapest = dashboard.open.length
    ? dashboard.open.reduce((lo, c) => (c.stakeAmount < lo.stakeAmount ? c : lo))
    : null;

  // The one number that changes today's outcome: total output still required
  // across every position, for today.
  const todaysRequirement = positions.reduce((t, p) => t + p.requiredVelocity, 0);

  const targets: CommandTarget[] = [
    ...positions.map((p) => ({
      id: `p-${p.cohortId}`,
      label: p.name,
      sub: `${zar(p.exposure)} at risk · ${num(p.requiredVelocity)} a day`,
      href: `/commit/${p.cohortId}`,
      group: "Challenge" as const,
    })),
    ...dashboard.open.map((c) => ({
      id: `o-${c.id}`,
      label: c.name,
      sub: `${c.targetLabel} · ${zar(c.stakeAmount)}`,
      href: `/commit/${c.id}`,
      group: "Challenge" as const,
    })),
    { id: "new", label: "Open a position", sub: "Publish terms others can stake against", href: "/commit/new", group: "Action" as const },
    { id: "port", label: "Performance portfolio", sub: "Every position, in full", href: "/commit/portfolio", group: "Action" as const },
    { id: "trust", label: "Integrity record", sub: "Everything committed, checked and paid", href: "/commit/trust", group: "Action" as const },
    { id: "bank", label: "Bank details", sub: "Where payouts are sent", href: "/commit/wallet/bank", group: "Action" as const },
    { id: "statement", label: "Download statement", sub: "Every movement as CSV", href: "/api/commit/statement", group: "Action" as const },
  ];

  return (
    <AppShell>
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">The discipline exchange</p>
          <h1 className="font-display text-title font-semibold text-snow">Commit</h1>
        </div>
        <Link href="/home" className="shrink-0 text-xs text-sage transition hover:text-snow">
          Today
        </Link>
      </header>

      <div className="mb-5">
        <CommandBar targets={targets} />
      </div>

      {headline && (
        <Link
          href={headline.href}
          className={`mb-5 flex items-center gap-3 rounded-field px-4 py-3 ring-1 transition ${
            headline.tone === "warn"
              ? "bg-fall/10 text-fall ring-fall/25 hover:bg-fall/15"
              : "bg-ridge text-snow ring-scree hover:bg-scree"
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${headline.tone === "warn" ? "bg-fall" : "bg-sage"}`}
          />
          <span className="min-w-0 flex-1 text-xs leading-snug">{headline.text}</span>
          <span aria-hidden className="shrink-0 text-xs opacity-60">→</span>
        </Link>
      )}

      {/* ── Capital at risk ──────────────────────────────────────────────── */}
      <section className="mb-chapter">
        {positions.length > 0 ? (
          <>
            <p className="text-micro uppercase text-sage">Capital at risk</p>
            <p className="tnum -ml-1 mt-2 font-display text-hero font-semibold text-snow">
              <Counter value={portfolio.exposure} prefix="R" />
            </p>
            <p className="mt-3 max-w-[24rem] text-body text-sage">
              across {positions.length} open {positions.length === 1 ? "position" : "positions"}.
              Today needs <span className="tnum text-snow">{num(todaysRequirement)}</span> to hold
              every one of them.
            </p>

            <dl className="mt-block flex flex-wrap gap-x-8 gap-y-3 border-t border-scree/60 pt-4">
              {portfolio.weightedCompletion !== null && (
                <Figure
                  label="Complete"
                  value={`${Math.round(portfolio.weightedCompletion * 100)}%`}
                  caption="weighted by rand"
                />
              )}
              {portfolio.atRisk > 0 && (
                <Figure label="Behind" value={zar(portfolio.atRisk)} caption="off pace" />
              )}
              {wallet.positions.comingToYou > 0 && (
                <Figure label="Coming" value={zar(wallet.positions.comingToYou)} caption="settled" />
              )}
              {wallet.positions.paidOut > 0 && (
                <Figure label="Paid" value={zar(wallet.positions.paidOut)} caption="landed" gold />
              )}
            </dl>
          </>
        ) : cheapest ? (
          <>
            <p className="text-micro uppercase text-sage">No open position</p>
            <h2 className="mt-2 font-display text-display font-semibold text-snow">
              Allocate against
              <br />
              your own
              <br />
              performance
            </h2>
            <p className="mt-3.5 max-w-[23rem] text-body text-sage">
              {dashboard.open.length} {dashboard.open.length === 1 ? "challenge" : "challenges"}{" "}
              open, from <span className="tnum text-snow">{zar(cheapest.stakeAmount)}</span>. The
              outcome is decided by your own verified effort — never by chance, odds or a
              multiplier.
            </p>
            <Link
              href="/commit/market"
              className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
            >
              See the market
            </Link>
          </>
        ) : (
          <>
            <p className="text-micro uppercase text-sage">No open position</p>
            <h2 className="mt-2 font-display text-display font-semibold text-snow">
              Write the
              <br />
              first terms
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              Nothing is open. Publish a challenge and share it with the people who will actually
              hold you to it.
            </p>
            <Link
              href="/commit/new"
              className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
            >
              Open a position
            </Link>
          </>
        )}
      </section>

      {/* ── The position book ────────────────────────────────────────────── */}
      {positions.length > 0 && (
        <section className="mb-chapter border-t border-snow/25">
          <div className="flex items-baseline justify-between gap-4 py-block">
            <h2 className="font-display text-title font-semibold text-snow">Positions</h2>
            <Link
              href="/commit/portfolio"
              className="shrink-0 text-caption text-sage transition hover:text-snow"
            >
              In full →
            </Link>
          </div>
          <ul className="border-t border-scree/60">
            {positions.map((p) => (
              <PositionRow key={p.cohortId} position={p} />
            ))}
          </ul>
        </section>
      )}

      {/* ── The record ───────────────────────────────────────────────────── */}
      {integritySummary.daysVerified + integritySummary.daysHeld > 0 && (
        <section className="mb-chapter border-t border-snow/25">
          <div className="flex items-baseline justify-between gap-4 py-block">
            <h2 className="font-display text-title font-semibold text-snow">Verification</h2>
            <Link href="/commit/trust" className="shrink-0 text-caption text-sage transition hover:text-snow">
              The record →
            </Link>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-scree/60 pt-4">
            <Figure label="Verified" value={num(integritySummary.daysVerified)} caption="days" />
            {integritySummary.daysHeld > 0 && (
              <Figure label="Held" value={num(integritySummary.daysHeld)} caption="for review" />
            )}
            {integritySummary.challengesClosed > 0 && (
              <Figure
                label="Closed"
                value={`${integritySummary.challengesMet}/${integritySummary.challengesClosed}`}
                caption="met"
              />
            )}
          </dl>
        </section>
      )}

      {/* ── The rest of the exchange ─────────────────────────────────────── */}
      <section className="border-t border-scree/60">
        <ul>
          {MODULES.map((m) => {
            const st = modules[m.key];
            return (
              <li key={m.key} className="border-b border-scree/40 last:border-0">
                <Link href={m.href} className="group flex items-center gap-4 py-4">
                  <span className="flex w-24 shrink-0 items-center gap-1.5 text-micro uppercase text-sage">
                    {m.name}
                    {st.alert && <span aria-hidden className="h-1 w-1 rounded-full bg-fall" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body text-sage">
                    {st.value ? (
                      <>
                        <span className="tnum text-snow">{st.value}</span> {st.caption}
                      </>
                    ) : (
                      st.caption
                    )}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-caption text-sage transition group-hover:translate-x-1 group-hover:text-snow"
                  >
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-chapter text-meta text-sage/70">
        Every outcome here is decided by your own verified effort. No chance, no odds, no
        multipliers. Probabilities are computed from your own logged days, not from other people.
      </p>
    </AppShell>
  );
}

/**
 * One position.
 *
 * Health reads by BRIGHTNESS and by a word, never by colour — the palette has
 * one accent and it means money confirmed as yours. A challenge going badly is
 * not an error, so it is not red either; it is simply the dimmest row with the
 * bluntest label.
 */
export function PositionRow({ position: p }: { position: Position }) {
  return (
    <li className="border-b border-scree/40 last:border-0">
      <Link href={`/commit/${p.cohortId}`} className="group block py-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-body text-snow">{p.name}</span>
          <span className="tnum shrink-0 text-body text-snow">{zar(p.exposure)}</span>
        </div>

        {/* Completion against where an even pace would be. The tick is the
            honest part: it is what the calendar expects, not a decoration. */}
        <div aria-hidden className="relative mt-2.5 h-px w-full bg-scree">
          <div className="h-px bg-snow" style={{ width: `${Math.round(p.completion * 100)}%` }} />
          <span
            className="absolute -top-1 h-[9px] w-px bg-sage"
            style={{ left: `${Math.round(p.expected * 100)}%` }}
          />
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-sage">
          <span className={HEALTH_TONE[p.health]}>{HEALTH_LABEL[p.health]}</span>
          <span>
            day <span className="tnum">{p.dayNumber}</span>/{p.totalDays}
          </span>
          <span>
            needs <span className="tnum text-snow">{num(p.requiredVelocity)}</span>/day
          </span>
          {p.strain !== null && p.strain > 1.05 && (
            <span>
              <span className="tnum text-snow">{num(p.strain, fracOf(p.strain))}×</span> your pace
            </span>
          )}
          {p.projection && (
            <span>
              <span className="tnum text-snow">{probabilityPct(p.projection.probability)}%</span>{" "}
              likely
            </span>
          )}
          {p.volatility && <span>{p.volatility.label}</span>}
        </p>
      </Link>
    </li>
  );
}

const HEALTH_LABEL: Record<PositionHealth, string> = {
  ahead: "Ahead",
  on_pace: "On pace",
  behind: "Behind",
  critical: "At risk",
  closed: "Target met",
};

const HEALTH_TONE: Record<PositionHealth, string> = {
  ahead: "text-snow",
  on_pace: "text-snow",
  behind: "text-sage",
  critical: "text-snow",
  closed: "text-snow",
};

function Figure({
  label,
  value,
  caption,
  gold,
}: {
  label: string;
  value: string;
  caption: string;
  gold?: boolean;
}) {
  return (
    <div>
      <dt className="text-micro uppercase text-sage">{label}</dt>
      <dd className={`tnum mt-1 font-display text-lg ${gold ? "text-summit" : "text-snow"}`}>
        {value}
        <span className="ml-1.5 font-sans text-caption text-sage">{caption}</span>
      </dd>
    </div>
  );
}
