import Link from "next/link";
import { AppShell } from "@/components/ui";
import {
  DIRECTION_LABEL,
  GOAL_LABEL,
  STUDIOS,
  type ElevateState,
} from "@/lib/elevate";

/**
 * ELEVATE — the front door.
 *
 * Commit's exchange leads with a number because money is a number. Elevate
 * leads with a SENTENCE, because the thing a person is actually carrying when
 * they open this is a situation: an interview on Thursday, a profile photo they
 * hate, a wardrobe they can't make an outfit out of.
 *
 * So the hero states, in their own words, what they said they're getting ready
 * for — and the studios below are five doors, each labelled with the question
 * you'd walk in with rather than the feature behind it.
 *
 * There is nothing here about anybody else. No gallery, no comparison, no
 * score. That absence is the product.
 */
export function ElevateHome({ state }: { state: ElevateState }) {
  const { profile, studios, nextStep, wardrobeStats, actions } = state;

  return (
    <AppShell>
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">Private coaching</p>
          <h1 className="font-display text-title font-semibold text-snow">
            Elevate
          </h1>
        </div>
        <Link href="/home" className="shrink-0 text-xs text-sage transition hover:text-snow">
          All sections
        </Link>
      </header>

      {/* ── Hero: the situation, in their words ─────────────────────────── */}
      <section className="relative mb-6 overflow-hidden rounded-card bg-slope px-5 py-6 ring-1 ring-scree/70">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-44 bg-[radial-gradient(ellipse_at_top_right,rgb(var(--snow)/0.07),transparent_65%)]"
        />
        <div className="relative">
          {profile ? (
            <>
              <p className="text-micro uppercase text-sage">
                Getting ready for
              </p>
              <p className="mt-2 font-display text-display font-semibold text-snow">
                {GOAL_LABEL[profile.goalMode] ?? "Your goal"}
              </p>
              <p className="mt-3 text-body text-sage">
                Dressing {DIRECTION_LABEL[profile.direction]?.toLowerCase() ?? "your way"}, at a{" "}
                {profile.budgetTier === "low"
                  ? "careful"
                  : profile.budgetTier === "mid"
                    ? "middling"
                    : "generous"}{" "}
                budget. Everything below is tuned to that.
              </p>
              <Link
                href="/elevate/profile"
                className="mt-4 inline-block text-xs text-sage underline decoration-scree underline-offset-4 transition hover:text-snow"
              >
                Change direction or goal
              </Link>
            </>
          ) : (
            <>
              <p className="text-micro uppercase text-sage">Start here</p>
              <p className="mt-2 font-display text-display font-semibold text-snow">
                What are you
                <br />
                getting ready for?
              </p>
              <p className="mt-3.5 text-body text-sage">
                An interview needs different advice from a first date. Tell Elevate which, and every
                studio below tunes itself to it.
              </p>
              <Link
                href="/elevate/profile"
                className="mt-5 inline-flex w-full items-center justify-center rounded-field bg-snow px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-snow/90"
              >
                Set your direction
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ── The single most useful next step ────────────────────────────── */}
      {nextStep && (
        <Link
          href={nextStep.href}
          className="mb-6 flex items-center gap-3 rounded-field bg-ridge px-4 py-3 text-snow ring-1 ring-scree transition hover:bg-scree"
        >
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-snow/60" />
          <span className="min-w-0 flex-1 text-xs leading-snug">{nextStep.text}</span>
          <span aria-hidden className="shrink-0 text-xs opacity-60">
            →
          </span>
        </Link>
      )}

      {/* ── Five doors ──────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {STUDIOS.map((s, i) => {
          const st = studios[s.key];
          return (
            <Link
              key={s.key}
              href={s.href}
              className="group flex items-center gap-4 rounded-card bg-slope/70 p-5 ring-1 ring-scree/60 transition hover:bg-ridge hover:ring-snow/20"
            >
              <span
                aria-hidden
                className="tnum shrink-0 font-display text-caption text-sage/50"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold tracking-tight text-snow">
                  {s.name}
                </p>
                <p className="mt-0.5 text-sm text-sage">{s.question}</p>
                <p className="mt-1.5 text-caption text-sage/70">
                  {st.value ? (
                    <>
                      <span className="tnum text-snow/80">{st.value}</span> {st.caption}
                    </>
                  ) : (
                    st.caption
                  )}
                </p>
              </div>
              <span
                aria-hidden
                className="shrink-0 text-sage/50 transition group-hover:translate-x-0.5 group-hover:text-snow"
              >
                →
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── What's open, if anything ────────────────────────────────────── */}
      {actions.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-micro uppercase text-sage">
            Working on ({actions.length})
          </h2>
          <ul className="space-y-1.5">
            {actions.slice(0, 4).map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-card bg-slope/50 px-4 py-3 ring-1 ring-scree/40"
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    a.impact >= 3 ? "bg-snow" : a.impact === 2 ? "bg-sage" : "bg-scree"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-snow/90">{a.title}</p>
                  <p className="mt-0.5 text-caption leading-relaxed text-sage">{a.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {wardrobeStats.total > 0 && (
        <p className="mt-8 text-center text-meta text-sage/70">
          {wardrobeStats.total} items catalogued
          {wardrobeStats.neverWornCount > 0 && `, ${wardrobeStats.neverWornCount} never worn`}
          {wardrobeStats.bestValue &&
            ` · best value is your ${wardrobeStats.bestValue.name.toLowerCase()} at R${wardrobeStats.bestValue.cpw} a wear`}
        </p>
      )}

      <p className="mt-6 text-center text-meta text-sage/60">
        Everything here is yours alone. No gallery, no comparison with anyone else, no scores —
        and never a word about your body.
      </p>
    </AppShell>
  );
}
