import Link from "next/link";
import { AppShell } from "@/components/ui";
import { Counter } from "@/components/dash";
import { STUDIOS } from "@/lib/studios";
import { EVENT_LABEL, daysBetween, todayIso, upcoming, whenLabel } from "@/lib/events";
import { TRANSFORMATION_UNAVAILABLE } from "@/lib/transformation";
import type { ElevateOs } from "@/lib/elevateOs";
import { num } from "@/lib/format";

/**
 * ELEVATE — the command centre.
 *
 * ── THE ORDERING PRINCIPLE ───────────────────────────────────────────────────
 * What has a DATE attached beats what does not. A wedding in nine days outranks
 * a wardrobe gap that has been there for a month, because one has a deadline
 * the world imposed and the other is a preference. So the lead is the nearest
 * event and its next task — not a score, not a studio grid.
 *
 * The Transformation Score sits second, and it is a count of things done rather
 * than an opinion about a face. That is the difference between a transformation
 * score and an attractiveness score, and it is enforced by what the inputs are
 * rather than by what the label says.
 */
export function ElevateCommand({ os }: { os: ElevateOs }) {
  const { state, focus, events, transformation } = os;
  const today = todayIso();
  // Sorted and horizon-bounded by the same helper the loader uses to pick the
  // focus, then deduped BY ID. Slicing by index assumed the focus was first in
  // document order; it is not — it is whichever event is nearest — so the lead
  // event appeared again immediately underneath itself.
  const ahead = upcoming(events, today)
    .filter((e) => e.id !== focus?.id)
    .slice(0, 3);

  return (
    <AppShell>
      <header className="mb-block flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">Transformation</p>
          <h1 className="font-display text-title font-semibold text-snow">Elevate</h1>
        </div>
        <Link href="/home" className="shrink-0 text-xs text-sage transition hover:text-snow">
          Today
        </Link>
      </header>

      {/* ── The lead: the nearest thing with a date on it ─────────────────── */}
      <section className="mb-chapter">
        {focus ? (
          <>
            <p className="text-micro uppercase text-sage">
              {EVENT_LABEL[focus.kind]} · {whenLabel(daysBetween(today, focus.eventDate))}
            </p>
            <h2 className="mt-2 max-w-[20rem] text-balance font-display text-display font-semibold text-snow">
              {focus.title}
            </h2>

            {focus.plan.next ? (
              <p className="mt-3.5 max-w-[22rem] text-body text-sage">
                Next: <span className="text-snow">{focus.plan.next.title}</span>
                {focus.plan.next.inDays > 0 ? (
                  <> — {whenLabel(focus.plan.next.inDays)}</>
                ) : focus.plan.next.inDays === 0 ? (
                  <> — today</>
                ) : (
                  <> — {Math.abs(focus.plan.next.inDays)} days late</>
                )}
              </p>
            ) : (
              <p className="mt-3.5 max-w-[22rem] text-body text-sage">
                Everything on the plan is done.
              </p>
            )}

            {focus.readiness !== null && (
              <div className="mt-block">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-micro uppercase text-sage">Ready</span>
                  <span className="tnum text-body text-snow">
                    {Math.round(focus.readiness * 100)}%
                  </span>
                </div>
                <div aria-hidden className="mt-2 h-px w-full bg-scree">
                  <div
                    className="h-px bg-snow transition-[width] duration-500 ease-ascend"
                    style={{ width: `${Math.round(focus.readiness * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <Link
              href={`/elevate/events/${focus.id}`}
              className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
            >
              Open the plan
            </Link>
          </>
        ) : (
          <>
            <p className="text-micro uppercase text-sage">Nothing on the calendar</p>
            <h2 className="mt-2 max-w-[18rem] font-display text-display font-semibold text-snow">
              What are you getting ready for?
            </h2>
            <p className="mt-3.5 max-w-[22rem] text-body text-sage">
              An interview, a wedding, a first date, a shoot. Give Ascend the date and it works
              backwards — haircut timing, outfit, practice, the lot.
            </p>
            <Link
              href="/elevate/events/new"
              className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
            >
              Add an event
            </Link>
          </>
        )}
      </section>

      {/* ── Everything else with a date ──────────────────────────────────── */}
      {ahead.length > 0 && (
        <section className="mb-chapter border-t border-snow/25">
          <div className="flex items-baseline justify-between gap-4 py-block">
            <h2 className="font-display text-title font-semibold text-snow">Coming up</h2>
            <Link href="/elevate/events/new" className="shrink-0 text-caption text-sage transition hover:text-snow">
              Add →
            </Link>
          </div>
          <ul className="border-t border-scree/60">
            {ahead.map((e) => (
              <li key={e.id} className="border-b border-scree/40 last:border-0">
                <Link href={`/elevate/events/${e.id}`} className="group flex items-center gap-3 py-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-snow">{e.title}</span>
                    <span className="mt-0.5 block text-caption text-sage">
                      {EVENT_LABEL[e.kind]} · {whenLabel(daysBetween(today, e.eventDate))}
                      {e.plan.missed.length > 0 && (
                        <> · {e.plan.missed.length} window{e.plan.missed.length === 1 ? "" : "s"} closed</>
                      )}
                    </span>
                  </span>
                  {e.readiness !== null && (
                    <span className="tnum shrink-0 text-body text-sage">
                      {Math.round(e.readiness * 100)}%
                    </span>
                  )}
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

      {/* ── The Transformation Score ─────────────────────────────────────── */}
      <section className="mb-chapter border-t border-snow/25">
        <div className="flex items-baseline justify-between gap-4 py-block">
          <h2 className="font-display text-title font-semibold text-snow">Transformation</h2>
          {transformation.score !== null && (
            <span className="shrink-0 text-caption text-sage">
              {Math.round(transformation.coverage * 100)}% measured
            </span>
          )}
        </div>

        {transformation.score === null ? (
          <p className="border-t border-scree/60 py-5 text-body text-sage">
            Nothing measured yet. This score counts what you actually do — actions completed,
            clothes worn, events prepared for — and it moves only when one of those does.
          </p>
        ) : (
          <>
            <p className="tnum -ml-1 font-display text-hero font-semibold text-snow">
              <Counter value={transformation.score} />
            </p>
            <p className="mt-2 text-body text-sage">
              <span className="text-snow">{transformation.band}</span> · of 1,000
            </p>

            <ul className="mt-block border-t border-scree/60">
              {transformation.contributions.map((c) => (
                <li key={c.key} className="border-b border-scree/40 py-3.5 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-body text-snow">{c.label}</span>
                    <span className="tnum shrink-0 text-body text-sage">+{c.share}</span>
                  </div>
                  <div aria-hidden className="mt-2 h-px w-full bg-scree">
                    <div className="h-px bg-snow" style={{ width: `${Math.round(c.value * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>

            {transformation.missing.length > 0 && (
              <ul className="mt-block border-t border-scree/60">
                {transformation.missing.map((m) => (
                  <li
                    key={m.key}
                    className="flex items-baseline justify-between gap-3 border-b border-scree/40 py-3.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1 text-body text-sage">
                      {m.label}
                      {TRANSFORMATION_UNAVAILABLE[m.key] && (
                        <span className="block text-caption text-sage/70">
                          {TRANSFORMATION_UNAVAILABLE[m.key]}
                        </span>
                      )}
                    </span>
                    <span className="tnum shrink-0 text-caption text-sage">worth {m.weight}%</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="pt-4 text-meta text-sage/70">
              This is a count of things you did, never an opinion about how you look. It moves when
              you complete an action, wear something you own, or prepare for a real event.
            </p>
          </>
        )}
      </section>

      {/* ── The studios ──────────────────────────────────────────────────── */}
      <section className="border-t border-snow/25">
        <h2 className="py-block font-display text-title font-semibold text-snow">The studios</h2>
        <ul className="border-t border-scree/60">
          {STUDIOS.map((s) => {
            const st = state.studios[s.key];
            return (
              <li key={s.key} className="border-b border-scree/40 last:border-0">
                <Link href={s.href} className="group flex items-center gap-4 py-4">
                  <span className="w-24 shrink-0 text-micro uppercase text-sage">{s.name}</span>
                  <span className="min-w-0 flex-1 truncate text-body text-sage">
                    {st?.value ? (
                      <>
                        <span className="tnum text-snow">{st.value}</span> {st.caption}
                      </>
                    ) : (
                      (st?.caption ?? s.question)
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

        {state.wardrobeStats.bestValue && (
          <p className="pt-4 text-meta text-sage/70">
            Best value in your wardrobe: {state.wardrobeStats.bestValue.name} at R
            {num(state.wardrobeStats.bestValue.cpw)} per wear.
          </p>
        )}
      </section>

      <p className="mt-chapter text-meta text-sage/70">
        Everything in Elevate is private to you. No gallery, no comparison, no rating — of anyone,
        ever.
      </p>
    </AppShell>
  );
}
