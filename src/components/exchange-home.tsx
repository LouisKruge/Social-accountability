import Link from "next/link";
import { AppShell } from "@/components/ui";
import { Counter } from "@/components/dash";
import { CommandBar, type CommandTarget } from "@/components/exchange-shell";
import { MODULES, type ExchangeState } from "@/lib/exchange";
import { num, zar } from "@/lib/format";

/**
 * THE EXCHANGE — Commit's front page.
 *
 * Not a dashboard and not a feed. One asymmetric screen that answers, in
 * descending order of what it costs you to not know:
 *
 *   1. What is riding on me right now, and am I going to lose it?
 *   2. What needs me today?
 *   3. What is the state of every module?
 *
 * Everything below the fold used to be here. It moved into modules, because a
 * page that grows by stacking is a page that gets worse as the product gets
 * better.
 *
 * The hero is deliberately ONE number. Bloomberg's density works because a
 * trader knows what they are looking for; a person opening this app at 6am does
 * not, so the exchange leads with the figure they came to check and puts the
 * density one tap away.
 */
export function ExchangeHome({ state }: { state: ExchangeState }) {
  const { dashboard, wallet, modules, headline, integrity } = state;
  const live = dashboard.active[0];
  // The lowest way in, so an empty exchange can name a real price instead of
  // an abstraction.
  const cheapest = dashboard.open.length
    ? dashboard.open.reduce((lo, c) => (c.stakeAmount < lo.stakeAmount ? c : lo))
    : null;

  const targets: CommandTarget[] = [
    ...dashboard.active.map((a) => ({
      id: `a-${a.cohortId}`,
      label: a.name,
      sub: `Day ${a.dayNumber} of ${a.totalDays} · R${Math.round(a.stake)} on the line`,
      href: `/commit/${a.cohortId}`,
      group: "Challenge" as const,
    })),
    ...dashboard.open.map((c) => ({
      id: `o-${c.id}`,
      label: c.name,
      sub: `${c.targetLabel} · ${zar(c.stakeAmount)} stake`,
      href: `/commit/${c.id}`,
      group: "Challenge" as const,
    })),
    {
      id: "new",
      label: "Start a challenge",
      sub: "Publish terms other people can stake against",
      href: "/commit/new",
      group: "Action" as const,
    },
    {
      id: "bank",
      label: "Bank details",
      sub: "Where payouts are sent",
      href: "/commit/wallet/bank",
      group: "Action" as const,
    },
    {
      id: "statement",
      label: "Download statement",
      sub: "Every movement as CSV",
      href: "/api/commit/statement",
      group: "Action" as const,
    },
  ];

  return (
    <AppShell>
      {/* ── Masthead ────────────────────────────────────────────────────── */}
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">The exchange</p>
          <h1 className="font-display text-title font-semibold text-ice">
            Commit
          </h1>
        </div>
        <Link href="/home" className="shrink-0 text-xs text-sage transition hover:text-ice">
          All sections
        </Link>
      </header>

      <div className="mb-5">
        <CommandBar targets={targets} />
      </div>

      {/* ── The one thing that needs saying ─────────────────────────────── */}
      {headline && (
        <Link
          href={headline.href}
          className={`mb-5 flex items-center gap-3 rounded-field px-4 py-3 ring-1 transition ${
            headline.tone === "warn"
              ? "bg-fall/10 text-fall ring-fall/25 hover:bg-fall/15"
              : headline.tone === "good"
                ? "bg-ice/10 text-ice ring-ice/20 hover:bg-ice/15"
                : "bg-ridge text-snow ring-scree hover:bg-scree"
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              headline.tone === "warn" ? "bg-fall" : headline.tone === "good" ? "bg-ice" : "bg-sage"
            }`}
          />
          <span className="min-w-0 flex-1 text-xs leading-snug">{headline.text}</span>
          <span aria-hidden className="shrink-0 text-xs opacity-60">
            →
          </span>
        </Link>
      )}

      {/* ── Hero: the exposure. One number, editorial scale. ────────────── */}
      <section className="relative mb-3 overflow-hidden rounded-card bg-slope px-5 py-6 ring-1 ring-scree/70">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-28 h-48 bg-[radial-gradient(ellipse_at_top_left,rgb(var(--ice)/0.14),transparent_65%)]"
        />
        <div className="relative">
          {live ? (
            <>
              <p className="text-micro uppercase text-sage">
                Riding on your discipline
              </p>
              <p className="tnum mt-2 font-display text-hero font-semibold text-snow">
                <Counter value={wallet.positions.locked} prefix="R" />
              </p>
              <p className="mt-3 text-body text-sage">
                <span className="text-snow/90">{live.name}</span> · day{" "}
                <span className="tnum text-snow/90">{live.dayNumber}</span> of {live.totalDays} ·{" "}
                <span className="tnum text-snow/90">
                  {num(Math.max(0, live.target - live.progress))}
                </span>{" "}
                still to walk
              </p>
            </>
          ) : cheapest ? (
            <>
              <p className="text-micro uppercase text-sage">
                Nothing on the line yet
              </p>
              <p className="mt-2 font-display text-display font-semibold text-snow">
                Put money
                <br />
                on yourself
              </p>
              <p className="mt-3.5 text-body text-sage">
                {dashboard.open.length} {dashboard.open.length === 1 ? "challenge" : "challenges"}{" "}
                open, from <span className="tnum text-snow/90">{zar(cheapest.stakeAmount)}</span>.
                You win it back by walking — never by guessing.
              </p>
              <Link
                href="/commit/market"
                className="mt-5 inline-flex w-full items-center justify-center rounded-field bg-ice px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-ice-soft"
              >
                See what&apos;s open
              </Link>
            </>
          ) : (
            <>
              <p className="text-micro uppercase text-sage">
                Nothing on the line yet
              </p>
              <p className="mt-2 font-display text-display font-semibold text-snow">
                Set the
                <br />
                first target
              </p>
              <p className="mt-3.5 text-body text-sage">
                Nothing is open. Publish a challenge and share it with the people who&apos;ll
                actually hold you to it.
              </p>
              <Link
                href="/commit/new"
                className="mt-5 inline-flex w-full items-center justify-center rounded-field bg-ice px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-ice-soft"
              >
                Start a challenge
              </Link>
            </>
          )}

          {/* Secondary figures, deliberately small: they are context, not the point. */}
          {(wallet.positions.comingToYou > 0 || wallet.positions.paidOut > 0 || integrity) && (
            <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-scree/50 pt-4">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[0.62rem] uppercase tracking-wider text-sage">Coming</dt>
              <dd className="tnum text-sm text-ice">{zar(wallet.positions.comingToYou)}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[0.62rem] uppercase tracking-wider text-sage">Paid</dt>
              <dd className="tnum text-sm text-summit">{zar(wallet.positions.paidOut)}</dd>
            </div>
            {integrity && (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-[0.62rem] uppercase tracking-wider text-sage">Verified</dt>
                <dd
                  className={`tnum text-sm ${
                    integrity.tone === "good"
                      ? "text-snow"
                      : integrity.tone === "watch"
                        ? "text-summit"
                        : "text-fall"
                  }`}
                >
                  {integrity.score}%
                </dd>
              </div>
            )}
            </dl>
          )}
        </div>
      </section>

      {/* ── The floor plan: asymmetric, variable-weight module tiles ────── */}
      <div className="grid grid-cols-2 gap-2.5">
        {MODULES.map((m, i) => {
          const s = modules[m.key];
          // The first two tiles run full width — they are the two questions a
          // person opening this app is most likely to have.
          const wide = i < 2;
          return (
            <Link
              key={m.key}
              href={m.href}
              className={`group relative overflow-hidden rounded-card bg-slope/70 p-4 ring-1 transition hover:bg-ridge ${
                s.alert ? "ring-fall/30" : "ring-scree/60 hover:ring-ice/25"
              } ${wide ? "col-span-2" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-micro uppercase text-sage">
                    {m.name}
                    {s.alert && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-fall" />}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-sage/80">{m.question}</p>
                </div>
                <span
                  aria-hidden
                  className="shrink-0 text-sage/50 transition group-hover:translate-x-0.5 group-hover:text-ice"
                >
                  →
                </span>
              </div>
              {s.value === null ? (
                <p className="mt-3 text-xs leading-snug text-sage/70">{s.caption}</p>
              ) : (
                <>
                  <p
                    className={`tnum mt-3 font-display font-semibold leading-none ${
                      wide ? "text-2xl" : "text-xl"
                    } ${
                      s.tone === "money"
                        ? "text-summit"
                        : s.tone === "warn"
                          ? "text-fall"
                          : "text-snow"
                    }`}
                  >
                    {s.value}
                  </p>
                  <p className="mt-1 text-caption leading-tight text-sage">{s.caption}</p>
                </>
              )}
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-center text-meta text-sage/70">
        Every outcome here is decided by your own verified effort. No chance, no odds, no
        multipliers.
      </p>
    </AppShell>
  );
}
