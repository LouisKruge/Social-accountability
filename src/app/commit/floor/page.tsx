import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/module-shell";
import { Standings } from "@/components/commit-cards";
import { ActivityFeed, DashSection } from "@/components/dash";
import { EmptyState } from "@/components/ui";
import { loadExchange } from "@/lib/exchange";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * THE FLOOR — who you are up against.
 *
 * Ranked on verified effort and percentage of each person's own target. There
 * is no earnings board here and there will not be one without explicit opt-in:
 * what somebody staked, and what they took home, is theirs. Everyone on this
 * board can already see everyone's steps, so steps are what compete.
 */
export default async function FloorPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadExchange(supabase, user!.id);
  const { standings, climbers, activity, cohortsJoined } = state.dashboard;

  return (
    <ModulePage state={state} moduleKey="floor">
      {!standings ? (
        <EmptyState
          title="You're not in a cohort yet"
          body="Join a challenge and you'll see everyone in it here — how far they've walked, and how close they are to their own target."
          cta={
            <Link
              href="/commit/market"
              className="inline-flex w-full items-center justify-center rounded-field bg-ice px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-ice-soft"
            >
              Open the market
            </Link>
          }
        />
      ) : (
        <>
          <DashSection
            title="Current cohort"
            action={<span className="truncate text-[0.68rem] text-sage">{standings.cohortName}</span>}
          >
            <Standings rows={standings.rows} limit={8} />
          </DashSection>

          {cohortsJoined > 1 && climbers.length > 1 && (
            <DashSection
              title="Best runs, all challenges"
              action={<span className="text-[0.68rem] text-sage">% of own target</span>}
            >
              <Standings rows={climbers} limit={5} />
            </DashSection>
          )}
        </>
      )}

      {activity.length > 0 && (
        <DashSection title="Recent activity">
          <div className="rounded-card bg-slope/60 px-4 py-1 ring-1 ring-scree/50">
            <ActivityFeed items={activity} />
          </div>
        </DashSection>
      )}
    </ModulePage>
  );
}
