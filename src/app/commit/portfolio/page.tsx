import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/module-shell";
import { ActiveBet, HistoryRow } from "@/components/commit-cards";
import { DashSection, StatTile } from "@/components/dash";
import { EmptyState } from "@/components/ui";
import { loadExchange } from "@/lib/exchange";
import { zar } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * PORTFOLIO — every open position, and the record behind them.
 *
 * A position here is a commitment, not an asset: what it costs you is fixed,
 * what it returns depends on how many people finish. The tiles say exposure and
 * record; the cards say how each one is actually going.
 */
export default async function PortfolioPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadExchange(supabase, user!.id);
  const { dashboard, wallet } = state;

  const bestPossible = dashboard.active.reduce(
    (t, a) => t + (a.projectedPayout ?? 0),
    0,
  );

  return (
    <ModulePage state={state} moduleKey="portfolio">
      <div className="mb-3 grid grid-cols-3 gap-2">
        <StatTile label="Exposure" hint="At risk right now">
          {zar(wallet.positions.locked)}
        </StatTile>
        <StatTile label="Positions">{dashboard.active.length}</StatTile>
        <StatTile
          label="Hit rate"
          tone={dashboard.hero.winRate !== null && dashboard.hero.winRate >= 0.5 ? "good" : "default"}
          hint={`${dashboard.hero.cohortsCompleted} finished`}
        >
          {dashboard.hero.winRate === null
            ? "—"
            : `${Math.round(dashboard.hero.winRate * 100)}%`}
        </StatTile>
      </div>

      {bestPossible > 0 && (
        <div className="mb-6 rounded-card bg-slope/60 p-4 ring-1 ring-scree/50">
          <p className="text-meta text-sage">
            If you finish everything you&apos;re holding and the current pools stand, these positions
            return <span className="tnum text-snow/90">{zar(bestPossible)}</span>. That figure moves
            with every person who joins or drops out — it is an estimate, not an offer.
          </p>
        </div>
      )}

      {dashboard.active.length === 0 ? (
        <div className="mb-7">
          <EmptyState
            title="No open positions"
            body="Nothing is riding on you right now. The market lists what's open to take on."
            cta={
              <Link
                href="/commit/market"
                className="inline-flex w-full items-center justify-center rounded-field bg-ice px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-ice-soft"
              >
                Open the market
              </Link>
            }
          />
        </div>
      ) : (
        <DashSection title="Open positions">
          <div className="space-y-3">
            {dashboard.active.map((b) => (
              <ActiveBet key={b.cohortId} b={b} />
            ))}
          </div>
        </DashSection>
      )}

      {dashboard.history.length > 0 && (
        <DashSection title="Closed">
          <ul className="space-y-1.5">
            {dashboard.history.map((h) => (
              <HistoryRow key={h.id} h={h} />
            ))}
          </ul>
        </DashSection>
      )}
    </ModulePage>
  );
}
