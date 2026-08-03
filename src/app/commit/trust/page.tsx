import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/module-shell";
import { TrustPanel } from "@/components/wallet-ui";
import { DashSection } from "@/components/dash";
import { loadExchange } from "@/lib/exchange";
import { zar } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * TRUST — can any of this be verified?
 *
 * States plainly what is checked, what is not, and what a flag means for the
 * user's money. A trust centre that only shows green ticks isn't one.
 */
export default async function TrustPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadExchange(supabase, user!.id);

  return (
    <ModulePage
      state={state}
      moduleKey="trust"
      action={
        <Link
          href="/commit/wallet/bank"
          className="shrink-0 text-xs text-ice transition hover:text-snow"
        >
          Bank details
        </Link>
      }
    >
      <TrustPanel trust={state.wallet.trust} integrityScore={state.integrity?.score ?? null} />

      {/* ── The integrity record ─────────────────────────────────────────────
          Ascend asks people to send money to a company they have never met, on
          the promise that a verified result decides who gets it back. The only
          thing that makes that reasonable is a record they can read afterwards.
          Held days appear here in the same list and the same voice as payouts —
          a trust ledger that only shows good news is marketing. */}
      {state.timeline.length > 0 && (
        <section className="mt-chapter border-t border-snow/25">
          <div className="flex items-baseline justify-between gap-4 py-block">
            <h2 className="font-display text-title font-semibold text-snow">The record</h2>
            <span className="shrink-0 text-caption text-sage">
              {state.integritySummary.daysVerified} verified
              {state.integritySummary.daysHeld > 0 && `, ${state.integritySummary.daysHeld} held`}
            </span>
          </div>
          <ul className="border-t border-scree/60">
            {state.timeline.slice(0, 40).map((e) => (
              <li key={e.id} className="border-b border-scree/40 py-4 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`min-w-0 flex-1 text-body ${e.adverse ? "text-sage" : "text-snow"}`}>
                    {e.title}
                  </span>
                  {e.amount !== null && (
                    <span
                      className={`tnum shrink-0 text-body ${
                        e.amount > 0 ? "text-summit" : "text-snow/75"
                      }`}
                    >
                      {e.amount > 0 ? "+" : "\u2212"}
                      {zar(Math.abs(e.amount))}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-caption text-sage">{e.detail}</p>
                <p className="mt-1 text-micro uppercase text-sage/70">
                  {new Date(e.at).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </p>
              </li>
            ))}
          </ul>
          {state.integritySummary.holdRate !== null && (
            <p className="pt-4 text-meta text-sage/70">
              {Math.round(state.integritySummary.holdRate * 100)}% of your judged days were held for
              review. A held day is never deleted — it waits for a person.
            </p>
          )}
        </section>
      )}

      <div className="mt-6">
        <DashSection title="What we check">
          <ul className="space-y-2.5 rounded-card bg-slope/60 p-4 ring-1 ring-scree/50">
            {[
              ["Impossible days", "More steps than a person can walk in a day."],
              ["Repeated figures", "The same number on several days — typed, not walked."],
              ["Late entries", "Days filled in long after they ended can't be corroborated."],
              ["Source changes", "A window logged by a tracker that suddenly goes manual."],
              ["Your own range", "Days far outside how you normally walk, judged against you and nobody else."],
              ["Clock drift", "A device whose clock disagrees with ours."],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-3">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ice/70" />
                <span className="text-meta text-sage">
                  <span className="text-snow/90">{k}.</span> {v}
                </span>
              </li>
            ))}
          </ul>
        </DashSection>

        <div className="rounded-card bg-slope/50 p-4 ring-1 ring-scree/50">
          <p className="text-meta text-sage">
            <span className="text-snow/90">A flagged day is never deleted.</span> It is held, and a
            person looks at it. If you genuinely walked 40 000 steps on a hiking day, we want to
            count it — we just want to check first, because everyone else&apos;s money is in the
            same pool.
          </p>
          <p className="mt-3 text-meta text-sage">
            <span className="text-snow/90">What we can&apos;t check yet.</span> GPS, motion sensors
            and device tampering need a phone app; a website can&apos;t see any of them. We&apos;d
            rather say so than show you a tick that means nothing.
          </p>
        </div>
      </div>
    </ModulePage>
  );
}
