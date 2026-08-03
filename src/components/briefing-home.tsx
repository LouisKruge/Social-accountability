import Link from "next/link";
import { AppShell } from "@/components/ui";
import type { Briefing, BriefingItem } from "@/lib/briefing";

/**
 * THE BRIEFING — Ascend's front door.
 *
 * ── WHAT THIS REPLACED ───────────────────────────────────────────────────────
 * Three equal cards, one per mode, each with a mint radial glow behind it. It
 * was a launcher: it asked "which of our three products would you like to open
 * today", which is a question about the company's org chart rather than about
 * the person holding the phone. It also still carried hardcoded
 * `rgba(127,220,192,…)` — the green that was removed everywhere else.
 *
 * ── THE ORDER IS THE PRODUCT ─────────────────────────────────────────────────
 * The lead is the single thing it costs the most to not know, at editorial
 * scale, directly on the black. Everything else that needs the user follows as
 * a hairline list, and the three modes sit underneath as an index rather than
 * as a choice.
 *
 * When nothing needs the user, it says exactly that. A briefing that always has
 * five things on it is a to-do list nobody reads by week three.
 */
export function BriefingHome({ briefing }: { briefing: Briefing }) {
  const [lead, ...rest] = briefing.items;

  return (
    <AppShell>
      <header className="mb-block flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">Ascend</p>
          <h1 className="font-display text-title font-semibold text-snow">
            {briefing.greeting ? `Hi ${briefing.greeting}` : "Today"}
          </h1>
        </div>
        {/* The score follows the person. It is the one number that describes
            them rather than a mode, so it belongs beside their name — and it is
            the entry point into the OS, which nothing else links to. */}
        {briefing.discipline.score !== null ? (
          <Link href="/os" className="group shrink-0 text-right">
            <span className="tnum block font-display text-2xl font-semibold leading-none text-snow transition group-hover:opacity-80">
              {briefing.discipline.score}
            </span>
            <span className="mt-1 block text-micro uppercase text-sage">
              {briefing.tier?.name ?? "Discipline"}
            </span>
          </Link>
        ) : (
          <Link href="/you" className="shrink-0 text-xs text-sage transition hover:text-snow">
            You
          </Link>
        )}
      </header>

      {/* ── The lead ─────────────────────────────────────────────────────── */}
      <section className="mb-chapter">
        {lead ? (
          <>
            <p className="text-micro uppercase text-sage">{LABEL[lead.kind]}</p>
            <h2 className="mt-2 max-w-[20rem] text-balance font-display text-display font-semibold text-snow">
              {lead.text}
            </h2>
            <Link
              href={lead.href}
              className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
            >
              {ACTION[lead.kind]}
            </Link>
          </>
        ) : (
          <>
            <p className="text-micro uppercase text-sage">Nothing needs you</p>
            <h2 className="mt-2 max-w-[20rem] font-display text-display font-semibold text-snow">
              You&apos;re
              <br />
              up to date
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              Everything you&apos;ve committed to is logged and on pace. Nothing here is waiting on
              you.
            </p>
          </>
        )}
      </section>

      {/* ── Everything else that needs the user ──────────────────────────── */}
      {rest.length > 0 && (
        <section className="mb-chapter border-t border-snow/25">
          <p className="py-block text-micro uppercase text-sage">Also waiting</p>
          <ul className="border-t border-scree/60">
            {rest.map((item) => (
              <li key={item.id} className="border-b border-scree/40 last:border-0">
                <Link href={item.href} className="group flex items-center gap-3 py-4">
                  <span className="w-16 shrink-0 text-micro uppercase text-sage">
                    {MODE_NAME[item.mode]}
                  </span>
                  <span className="min-w-0 flex-1 text-body text-snow">{item.text}</span>
                  <span
                    aria-hidden
                    className="shrink-0 text-caption text-sage transition group-hover:translate-x-1 group-hover:text-snow"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── The three modes, as an index rather than a choice ────────────── */}
      <section className="border-t border-snow/25">
        {briefing.modes.map((m, i) => (
          <Link
            key={m.mode}
            href={m.href}
            className={`group flex items-baseline justify-between gap-4 py-block ${
              i > 0 ? "border-t border-scree/60" : ""
            }`}
          >
            <div className="min-w-0">
              <h3 className="font-display text-title font-semibold text-snow">{m.name}</h3>
              <p className="mt-1.5 text-caption text-sage">
                {m.value ? (
                  <>
                    <span className="tnum text-snow">{m.value}</span> · {m.caption}
                  </>
                ) : (
                  m.caption
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
        ))}
      </section>

      <p className="mt-chapter text-meta text-sage/70">
        Every figure on this screen is read from your own records. Nothing here is estimated,
        projected or generated.
      </p>
    </AppShell>
  );
}

const LABEL: Record<BriefingItem["kind"], string> = {
  blocked: "Waiting on you",
  at_risk: "At risk today",
  due: "Due this week",
  ready: "Ready for you",
  next: "Where to start",
};

const ACTION: Record<BriefingItem["kind"], string> = {
  blocked: "Sort it out",
  at_risk: "See the challenge",
  due: "Log it",
  ready: "Open it",
  next: "Start",
};

const MODE_NAME: Record<BriefingItem["mode"], string> = {
  climb: "Climb",
  commit: "Commit",
  elevate: "Elevate",
};
