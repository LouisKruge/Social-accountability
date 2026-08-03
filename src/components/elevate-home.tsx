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
      <header className="mb-chapter flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">Private coaching</p>
          <h1 className="font-display text-title font-semibold text-snow">Elevate</h1>
        </div>
        <Link href="/home" className="shrink-0 text-caption text-sage transition hover:text-snow">
          All sections
        </Link>
      </header>

      {/* ── The situation, set as a statement rather than housed in a card ──
          Commit leads with a figure because money is a figure. What a person
          carries in here is a SITUATION, so the situation is the display type
          and sits directly on the black. */}
      <section className="mb-chapter">
        {profile ? (
          <>
            <p className="text-micro uppercase text-sage">Getting ready for</p>
            <h2 className="mt-2 font-display text-display font-semibold text-snow">
              {GOAL_LABEL[profile.goalMode] ?? "Your goal"}
            </h2>
            <p className="mt-3 max-w-[22rem] text-body text-sage">
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
              className="mt-4 inline-block text-caption text-sage underline decoration-scree underline-offset-4 transition hover:text-snow"
            >
              Change direction or goal
            </Link>
          </>
        ) : (
          <>
            <p className="text-micro uppercase text-sage">Start here</p>
            <h2 className="mt-2 font-display text-display font-semibold text-snow">
              What are you
              <br />
              getting ready for?
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              An interview needs different advice from a first date. Tell Elevate which, and every
              studio below tunes itself to it.
            </p>
            <Link
              href="/elevate/profile"
              className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
            >
              Set your direction
            </Link>
          </>
        )}
      </section>

      {nextStep && (
        <Link
          href={nextStep.href}
          className="group mb-chapter flex items-baseline gap-3 border-y border-scree/60 py-4"
        >
          <span className="text-micro uppercase text-sage">Next</span>
          <span className="min-w-0 flex-1 text-body text-snow">{nextStep.text}</span>
          <span
            aria-hidden
            className="shrink-0 text-caption text-sage transition group-hover:translate-x-1 group-hover:text-snow"
          >
            →
          </span>
        </Link>
      )}

      {/* ── The five studios as an INDEX, not five cards ───────────────────
          A numbered index is how a magazine opens: the number is the smallest
          thing on the row and the question is the largest, so the eye reads
          down the questions and the numerals just keep the rhythm. Nothing is
          boxed — the hairline between rows is the only structure needed. */}
      <ol className="mb-chapter border-t border-snow/25">
        {STUDIOS.map((s, i) => {
          const st = studios[s.key];
          return (
            <li key={s.key} className="border-b border-scree/50">
              <Link href={s.href} className="group flex items-baseline gap-4 py-5">
                <span className="tnum w-6 shrink-0 font-display text-caption text-sage/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl font-semibold tracking-tight text-snow">
                    {s.question}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-caption text-sage">
                    <span className="uppercase tracking-[0.14em]">{s.name}</span>
                    <span aria-hidden className="text-sage/40">
                      ·
                    </span>
                    <span>
                      {st.value ? (
                        <>
                          <span className="tnum text-snow">{st.value}</span> {st.caption}
                        </>
                      ) : (
                        st.caption
                      )}
                    </span>
                  </span>
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
      </ol>

      {/* ── What's open, if anything ────────────────────────────────────── */}
      {actions.length > 0 && (
        <section className="mb-chapter">
          <h2 className="mb-2 text-micro uppercase text-sage">
            Working on ({actions.length})
          </h2>
          <ul className="border-t border-scree/60">
            {actions.slice(0, 4).map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 border-b border-scree/40 py-3.5 last:border-0"
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    a.impact >= 3 ? "bg-snow" : a.impact === 2 ? "bg-sage" : "bg-scree"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-body leading-snug text-snow">{a.title}</p>
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
