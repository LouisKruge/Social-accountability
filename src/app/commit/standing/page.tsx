import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/module-shell";
import { Achievements } from "@/components/commit-cards";
import { DashSection, StatTile } from "@/components/dash";
import { loadExchange } from "@/lib/exchange";
import { num, zar } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * STANDING — what you have actually earned.
 *
 * Every milestone here is computed from something the user did: days logged,
 * targets hit, challenges finished, payouts received. There is no XP curve, no
 * season pass and no daily missions, because those would be invented currency
 * on a product where the currency is real.
 */
export default async function StandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadExchange(supabase, user!.id);
  const { hero, achievements } = state.dashboard;

  return (
    <ModulePage state={state} moduleKey="standing">
      <div className="mb-6 grid grid-cols-2 gap-2">
        <StatTile label="Steps logged" hint="Verified, all time">
          {num(hero.totalLogged)}
        </StatTile>
        <StatTile label="Best streak" tone="good" hint="Days at target, back to back">
          {hero.streak}d
        </StatTile>
        <StatTile label="Targets hit">{hero.targetsHit}</StatTile>
        <StatTile label="Paid to you" tone="money" hint="Money that landed">
          {zar(state.wallet.positions.paidOut)}
        </StatTile>
      </div>

      <DashSection
        title="Milestones"
        action={
          <span className="tnum text-caption text-sage">
            {achievements.filter((a) => a.unlocked).length}/{achievements.length}
          </span>
        }
      >
        <Achievements items={achievements} />
      </DashSection>

      <div className="rounded-card bg-slope/50 p-4 ring-1 ring-scree/50">
        <p className="text-meta text-sage">
          Every milestone here is something you did — days walked, targets reached, challenges seen
          through. There are no points, levels or seasons to grind. On a product where the currency
          is real money, an invented one would only get in the way.
        </p>
      </div>
    </ModulePage>
  );
}
