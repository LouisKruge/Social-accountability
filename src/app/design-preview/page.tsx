import { notFound } from "next/navigation";
import { AppShell, Header, Card, Badge, EmptyState } from "@/components/ui";
import { AscentLine } from "@/components/ascent";
import { LeaderboardRow, type ClimbRow } from "@/components/leaderboard-row";

/**
 * DESIGN HARNESS — renders the real leaderboard components with fixed data so
 * the design can be reviewed and screenshotted without a database.
 *
 * Gated behind ALLOW_DESIGN_PREVIEW=1, which is only ever set locally, so this
 * route does not exist on the deployed site.
 */
export const dynamic = "force-dynamic";

const ROWS: ClimbRow[] = [
  { userId: "1", displayName: "Thandiwe", rank: 1, pctChange: 41.2, isAbsolute: false, series: [8, 19, 27, 41.2] },
  { userId: "2", displayName: "Sipho", rank: 2, pctChange: 28.6, isAbsolute: false, series: [12, 15, 22, 28.6], sharedValue: 12400 },
  { userId: "3", displayName: "Kabelo", rank: 3, pctChange: 23.4, isAbsolute: false, series: [4, 9, 8, 15, 23.4] },
  { userId: "4", displayName: "Nomvula", rank: 4, pctChange: 9.8, isAbsolute: false, series: [3, 6, 7, 9.8] },
  { userId: "5", displayName: "Johan", rank: 5, pctChange: 500, isAbsolute: true, series: [120, 300, 500] },
  { userId: "6", displayName: "Lerato", rank: 6, pctChange: -6.3, isAbsolute: false, series: [5, 2, -1, -6.3] },
];

export default function DesignPreview() {
  if (process.env.ALLOW_DESIGN_PREVIEW !== "1") notFound();

  const viewer = ROWS[2];

  return (
    <AppShell>
      <Header title="Savings" back="/groups" subtitle="Payday Warriors · 20 – 26 Jul" />

      <section className="relative mb-8 overflow-hidden rounded-card bg-slope px-5 pb-2 pt-6 ring-1 ring-scree/70">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(ellipse_at_top,rgba(232,184,75,0.16),transparent_70%)]"
        />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-sage">Your position</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-6xl font-semibold leading-none tracking-tightest text-snow">
                3
              </span>
              <span className="text-sm text-sage">of {ROWS.length}</span>
            </p>
          </div>
          <p className="tnum text-2xl font-medium text-summit">+23.4%</p>
        </div>
        <div className="relative mt-2">
          <AscentLine values={viewer.series} height={150} />
        </div>
        <p className="relative pb-3 text-center text-sm text-sage">
          <span className="tnum text-ice">5.2%</span> to catch Sipho
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">The climb</h2>
        <ol className="space-y-1.5">
          {ROWS.map((r) => (
            <LeaderboardRow
              key={r.userId}
              row={r}
              isViewer={r.displayName === "Kabelo"}
              metricType="percentage_change"
              unit="ZAR"
            />
          ))}
        </ol>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.16em] text-sage">Your trend</h2>
          <Badge tone="summit">Premium</Badge>
        </div>
        <Card>
          <div className="text-center">
            <p className="text-sm text-sage">See how your rate of climb moves week over week.</p>
            <span className="mt-4 inline-flex items-center justify-center rounded-field bg-ridge px-4 py-2.5 text-sm font-medium text-snow ring-1 ring-scree">
              Unlock trends
            </span>
          </div>
        </Card>
      </section>

      <div className="mt-7 space-y-2.5">
        <button className="inline-flex w-full items-center justify-center rounded-field bg-summit px-4 py-3.5 text-sm font-semibold text-valley">
          Make a rank card
        </button>
        <button className="w-full rounded-field bg-ridge px-4 py-3.5 text-sm text-sage ring-1 ring-scree">
          Run the ranking
        </button>
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed text-sage/80">
        Some climbers started from zero, so their move shows as an absolute change rather than a
        percentage.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Empty state</h2>
        <EmptyState
          title="No one's logged this week yet"
          body="Be the first to move. Log your number and the climb starts."
        />
      </section>
    </AppShell>
  );
}
