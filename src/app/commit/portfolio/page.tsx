import { createClient } from "@/lib/supabase/server";
import { PortfolioView } from "@/components/portfolio-view";
import { loadExchange } from "@/lib/exchange";
import { buildStrategies, compareStrategies, type StrategyResult } from "@/lib/position";

export const dynamic = "force-dynamic";

/**
 * PERFORMANCE PORTFOLIO.
 *
 * The strategy comparison is computed here rather than in the loader because it
 * is only ever read on this screen — putting it in `loadExchange` would make
 * every Commit page pay for arithmetic none of them render.
 */
export default async function PortfolioPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadExchange(supabase, user!.id);

  const series: Record<string, number[]> = {};
  for (const l of state.dashboard.rawLogs) {
    (series[l.cohort_id] ??= []).push(Number(l.verified_value ?? 0));
  }

  // Day-of-week of tomorrow, so a weekday/weekend split lines up with the
  // actual remaining days rather than with an arbitrary Monday.
  const startDow = (new Date().getUTCDay() + 1) % 7;

  const strategies: Record<string, StrategyResult[]> = {};
  for (const p of state.positions) {
    strategies[p.cohortId] = compareStrategies(
      series[p.cohortId] ?? [],
      p.remaining,
      buildStrategies(p.remaining, p.daysRemaining, startDow),
    );
  }

  return <PortfolioView state={state} strategies={strategies} series={series} />;
}
