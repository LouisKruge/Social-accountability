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

      {/* ── The figure, at the scale of a magazine cover ───────────────── */}
      <section className="relative mb-chapter">
        {live ? (
          <>
            <p className="text-micro uppercase text-sage">Riding on your discipline</p>
            {/* No card, no border, no background. The number sits directly on
                the black and is the largest thing on screen by a factor of
                four — which is what makes it read as the subject rather than a
                statistic inside a widget. */}
            <p className="tnum -ml-1 mt-2 font-display text-hero font-semibold text-snow">
              <Counter value={wallet.positions.locked} prefix="R" />
            </p>
            <p className="mt-3 max-w-[22rem] text-body text-sage">
              <span className="text-snow">{live.name}</span> · day{" "}
              <span className="tnum text-snow">{live.dayNumber}</span> of {live.totalDays} ·{" "}
              <span className="tnum text-snow">
                {num(Math.max(0, live.target - live.progress))}
              </span>{" "}
              still to walk
            </p>
          </>
        ) : cheapest ? (
          <>
            <p className="text-micro uppercase text-sage">Nothing on the line yet</p>
            <h2 className="mt-2 font-display text-display font-semibold text-snow">
              Put money
              <br />
              on yourself
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              {dashboard.open.length} {dashboard.open.length === 1 ? "challenge" : "challenges"}{" "}
              open, from <span className="tnum text-snow">{zar(cheapest.stakeAmount)}</span>. You
              win it back by walking — never by guessing.
            </p>
            <Link
              href="/commit/market"
              className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
            >
              See what&apos;s open
            </Link>
          </>
        ) : (
          <>
            <p className="text-micro uppercase text-sage">Nothing on the line yet</p>
            <h2 className="mt-2 font-display text-display font-semibold text-snow">
              Set the
              <br />
              first target
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              Nothing is open. Publish a challenge and share it with the people who&apos;ll
              actually hold you to it.
            </p>
            <Link
              href="/commit/new"
              className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
            >
              Start a challenge
            </Link>
          </>
        )}

        {(wallet.positions.comingToYou > 0 || wallet.positions.paidOut > 0 || integrity) && (
          <dl className="mt-block flex flex-wrap gap-x-8 gap-y-3 border-t border-scree/60 pt-4">
            {wallet.positions.comingToYou > 0 && (
              <div>
                <dt className="text-micro uppercase text-sage">Coming</dt>
                <dd className="tnum mt-1 font-display text-lg text-snow">
                  {zar(wallet.positions.comingToYou)}
                </dd>
              </div>
            )}
            {wallet.positions.paidOut > 0 && (
              <div>
                <dt className="text-micro uppercase text-sage">Paid</dt>
                {/* the only hue on the screen */}
                <dd className="tnum mt-1 font-display text-lg text-summit">
                  {zar(wallet.positions.paidOut)}
                </dd>
              </div>
            )}
            {integrity && (
              <div>
                <dt className="text-micro uppercase text-sage">Verified</dt>
                <dd className="tnum mt-1 font-display text-lg text-snow">{integrity.score}%</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {/* ── The modules ──────────────────────────────────────────────────────
          Not a stack of equal rectangles. A lead module with the weight of a
          masthead, then a two-column bed, then a hairline list. Three densities
          on one screen is what a magazine does and a dashboard doesn't: the eye
          is given an order to read in, rather than four identical things to
          choose between. Nothing here is a card. */}
      <div className="mb-chapter">
        <Link href={MODULES[0].href} className="group block border-t border-snow/25 py-block">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-micro uppercase text-sage">{MODULES[0].name}</span>
            <span
              aria-hidden
              className="text-caption text-sage transition group-hover:translate-x-1 group-hover:text-snow"
            >
              →
            </span>
          </div>
          <p className="mt-2 font-display text-title font-semibold text-snow">
            {MODULES[0].question}
          </p>
          <p className="mt-2 text-body text-sage">
            {modules[MODULES[0].key].value ? (
              <>
                <span className="tnum text-snow">{modules[MODULES[0].key].value}</span>{" "}
                {modules[MODULES[0].key].caption}
              </>
            ) : (
              modules[MODULES[0].key].caption
            )}
          </p>
        </Link>

        <div className="grid grid-cols-2 gap-x-gutter border-t border-scree/60">
          {MODULES.slice(1, 5).map((m, i) => {
            const st = modules[m.key];
            return (
              <Link
                key={m.key}
                href={m.href}
                className={`group py-5 ${i % 2 === 0 ? "pr-3" : "border-l border-scree/60 pl-5"} ${
                  i >= 2 ? "border-t border-scree/60" : ""
                }`}
              >
                <span className="flex items-center gap-1.5 text-micro uppercase text-sage">
                  {m.name}
                  {st.alert && <span aria-hidden className="h-1 w-1 rounded-full bg-fall" />}
                </span>
                <p
                  className={`tnum mt-2 font-display font-semibold leading-none ${
                    st.value ? "text-2xl text-snow" : "text-base text-sage/60"
                  }`}
                >
                  {st.value ?? "—"}
                </p>
                <p className="mt-1.5 text-caption text-sage">{st.caption}</p>
              </Link>
            );
          })}
        </div>

        <ul className="border-t border-scree/60">
          {MODULES.slice(5).map((m) => {
            const st = modules[m.key];
            return (
              <li key={m.key} className="border-b border-scree/40 last:border-0">
                <Link href={m.href} className="group flex items-center gap-4 py-4">
                  <span className="w-24 shrink-0 text-micro uppercase text-sage">{m.name}</span>
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
      </div>

      <p className="mt-6 text-center text-meta text-sage/70">
        Every outcome here is decided by your own verified effort. No chance, no odds, no
        multipliers.
      </p>
    </AppShell>
  );
}
