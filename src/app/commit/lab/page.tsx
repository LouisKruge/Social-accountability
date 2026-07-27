import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/module-shell";
import { DashSection, PaceChart, StatTile } from "@/components/dash";
import { EmptyState } from "@/components/ui";
import { loadExchange } from "@/lib/exchange";
import { num } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * THE LAB.
 *
 * Analytics on real logged effort, and nothing else. There is no sleep impact,
 * weather correlation, age-group percentile or city comparison here — Ascend
 * collects none of that data, so any such chart would be an illustration rather
 * than a measurement. When a data source exists, the chart can.
 *
 * "Completion confidence" is arithmetic, stated as arithmetic: your rate so far,
 * run to the last day, against the target. It is not a probability and is never
 * shown as one.
 */
export default async function LabPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadExchange(supabase, user!.id);
  const a = state.dashboard.analytics;

  return (
    <ModulePage state={state} moduleKey="lab">
      {!a ? (
        <EmptyState
          title="Nothing to analyse yet"
          body="Log a few days against a live challenge and your pace, consistency and projection appear here."
        />
      ) : (
        <>
          <DashSection title={`Pace · ${a.cohortName}`}>
            <div className="rounded-card bg-slope p-5 ring-1 ring-scree/70">
              <PaceChart actual={a.actual} required={a.required} height={150} />
              <p className="mt-3 flex items-center justify-center gap-4 text-caption text-sage">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-0.5 w-4 rounded-full bg-ice" /> you
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-0 w-4 border-t border-dashed border-scree" /> needed
                  to finish
                </span>
              </p>
            </div>
          </DashSection>

          <DashSection title="The numbers">
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Consistency"
                tone={a.consistency !== null && a.consistency >= 0.7 ? "good" : "default"}
                hint={`${a.loggedDays} of ${a.elapsedDays} days at target`}
              >
                {a.consistency === null ? "—" : `${Math.round(a.consistency * 100)}%`}
              </StatTile>
              <StatTile label="Daily average" hint="Across the window so far">
                {num(a.avgDay)}
              </StatTile>
              <StatTile label="Best day">{num(a.bestDay)}</StatTile>
              <StatTile
                label="On this pace"
                tone={a.projectedTotal !== null && a.projectedTotal >= a.target ? "good" : "bad"}
                hint="Your rate so far, run to the last day"
              >
                {a.projectedTotal === null ? "—" : num(a.projectedTotal)}
              </StatTile>
            </div>
          </DashSection>

          <div className="rounded-card bg-slope/50 p-4 ring-1 ring-scree/50">
            <p className="text-meta text-sage">
              <span className="text-snow/90">On this pace</span> is arithmetic, not a prediction:
              your average day so far, multiplied by the length of the window. It moves the moment
              you log. It is not a probability of winning, and Commit deliberately doesn&apos;t show
              one — an outcome that depends entirely on what you do next can&apos;t honestly be given
              odds.
            </p>
          </div>
        </>
      )}
    </ModulePage>
  );
}
