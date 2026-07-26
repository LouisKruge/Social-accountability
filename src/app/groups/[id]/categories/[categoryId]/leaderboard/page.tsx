import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AppShell,
  Header,
  Card,
  Badge,
  EmptyState,
  SuccessNote,
  ErrorNote,
  formatMetric,
} from "@/components/ui";
import { AscentLine, Horizon } from "@/components/ascent";
import { LeaderboardRow } from "@/components/leaderboard-row";
import { currentPeriod, formatPeriod } from "@/lib/period";
import { recomputeCategory } from "@/app/groups/[id]/actions";
import { createShareCard } from "@/app/share/actions";
import { getTier } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: { id: string; categoryId: string };
  searchParams: { logged?: string; recomputed?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, unit, metric_type, group_id")
    .eq("id", params.categoryId)
    .maybeSingle();
  if (!category) notFound();

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, name")
    .eq("id", params.id)
    .maybeSingle();
  const isOwner = group?.owner_id === user?.id;

  const period = currentPeriod();

  const { data: rankings } = await supabase
    .from("leaderboard_rankings")
    .select("user_id, pct_change, is_absolute, rank, profile:profiles(display_name)")
    .eq("category_id", category.id)
    .eq("period_start", period.start)
    .order("rank", { ascending: true });

  const { data: sharedEntries } = await supabase
    .from("entries")
    .select("user_id, raw_value, share_raw_value")
    .eq("category_id", category.id)
    .eq("period_start", period.start);
  const sharedValueByUser = new Map(
    (sharedEntries ?? [])
      .filter((e) => e.share_raw_value)
      .map((e) => [e.user_id, Number(e.raw_value)]),
  );

  const viewerLoggedThisWeek = (sharedEntries ?? []).some((e) => e.user_id === user?.id);
  const rows = rankings ?? [];
  const viewerRanking = rows.find((r) => r.user_id === user?.id);

  // Everyone's trajectory across recent periods — used for the row sparklines.
  const { data: history } = await supabase
    .from("leaderboard_rankings")
    .select("user_id, period_start, pct_change")
    .eq("category_id", category.id)
    .order("period_start", { ascending: true })
    .limit(200);

  const seriesByUser = new Map<string, number[]>();
  for (const h of history ?? []) {
    const arr = seriesByUser.get(h.user_id) ?? [];
    arr.push(Number(h.pct_change));
    seriesByUser.set(h.user_id, arr);
  }

  const tier = await getTier(supabase, user!.id);
  const viewerSeries = seriesByUser.get(user!.id) ?? [];
  const isStreak = category.metric_type === "streak";

  // The person directly above you — "how far to the next rung".
  const above = viewerRanking ? rows.find((r) => r.rank === viewerRanking.rank - 1) : undefined;
  const gap =
    viewerRanking && above
      ? Math.round((Number(above.pct_change) - Number(viewerRanking.pct_change)) * 100) / 100
      : null;

  return (
    <AppShell>
      <Header
        title={category.name}
        back={`/groups/${params.id}`}
        subtitle={`${group?.name ?? "Group"} · ${formatPeriod(period)}`}
      />

      {searchParams.logged && (
        <div className="mb-5">
          <SuccessNote>Entry logged. Your line moves when the week&apos;s ranking runs.</SuccessNote>
        </div>
      )}
      {searchParams.recomputed && (
        <div className="mb-5">
          <SuccessNote>Ranking updated.</SuccessNote>
        </div>
      )}
      {searchParams.error && (
        <div className="mb-5">
          <ErrorNote>
            {searchParams.error === "not_owner"
              ? "Only the group owner can run the ranking."
              : searchParams.error === "no_ranking"
                ? "You don't have a position yet. Log this week, then run the ranking."
                : "That didn't work. Try again."}
          </ErrorNote>
        </div>
      )}

      {/* ── HERO: your trajectory. The rank sits ON the line, not in a stat box ── */}
      <section className="relative mb-8 overflow-hidden rounded-card bg-slope px-5 pb-2 pt-6 ring-1 ring-scree/70">
        {/* summit light pooling at the top */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(ellipse_at_top,rgba(232,184,75,0.16),transparent_70%)]"
        />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-sage">Your position</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-6xl font-semibold leading-none tracking-tightest text-snow">
                {viewerRanking ? viewerRanking.rank : "—"}
              </span>
              {viewerRanking && (
                <span className="text-sm text-sage">of {rows.length}</span>
              )}
            </p>
          </div>
          {viewerRanking && (
            <p
              className={`tnum text-2xl font-medium ${
                isStreak
                  ? "text-snow"
                  : Number(viewerRanking.pct_change) >= 0
                    ? "text-summit"
                    : "text-fall"
              }`}
            >
              {formatMetric(
                category.metric_type,
                Number(viewerRanking.pct_change),
                viewerRanking.is_absolute,
                category.unit,
              )}
            </p>
          )}
        </div>

        <div className="relative mt-2">
          {viewerSeries.length > 0 ? (
            <AscentLine values={viewerSeries} height={150} />
          ) : (
            <div className="py-6">
              <Horizon />
              <p className="mt-2 text-center text-xs text-sage">
                Your line starts the week you log.
              </p>
            </div>
          )}
        </div>

        {gap !== null && gap > 0 && (
          <p className="relative pb-3 text-center text-sm text-sage">
            <span className="tnum text-ice">{gap}%</span> to catch{" "}
            {(() => {
              const p = Array.isArray(above!.profile) ? above!.profile[0] : above!.profile;
              return p?.display_name ?? "the next climber";
            })()}
          </p>
        )}
      </section>

      {!viewerLoggedThisWeek && (
        <div className="mb-6">
          <Card className="flex items-center justify-between gap-4 !bg-ridge">
            <span className="text-sm text-snow">You haven&apos;t logged this week.</span>
            <Link
              href={`/groups/${params.id}/categories/${category.id}/log-entry`}
              className="shrink-0 rounded-field bg-summit px-4 py-2 text-xs font-semibold text-valley transition hover:bg-summit-soft"
            >
              Log now
            </Link>
          </Card>
        </div>
      )}

      {/* ── THE CLIMB: rows share one origin rule, warm at the summit ────────── */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">The climb</h2>

        {rows.length === 0 ? (
          <EmptyState
            title="No one's logged this week yet"
            body="Be the first to move. Log your number and the climb starts."
          />
        ) : (
          <ol className="space-y-1.5">
            {rows.map((r) => {
              const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
              return (
                <LeaderboardRow
                  key={r.user_id}
                  isViewer={r.user_id === user?.id}
                  metricType={category.metric_type}
                  unit={category.unit}
                  row={{
                    userId: r.user_id,
                    displayName: profile?.display_name ?? "Member",
                    rank: r.rank,
                    pctChange: Number(r.pct_change),
                    isAbsolute: r.is_absolute,
                    series: seriesByUser.get(r.user_id) ?? [Number(r.pct_change)],
                    sharedValue: sharedValueByUser.get(r.user_id),
                  }}
                />
              );
            })}
          </ol>
        )}
      </section>

      {/* ── Trend (premium) ──────────────────────────────────────────────────── */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.16em] text-sage">Your trend</h2>
          {tier !== "premium" && <Badge tone="summit">Premium</Badge>}
        </div>
        <Card>
          {tier === "premium" ? (
            viewerSeries.length > 1 ? (
              <AscentLine values={viewerSeries} height={110} label="Your trend over recent weeks" />
            ) : (
              <p className="text-sm text-sage">
                One week in. Your trend fills out as you keep logging.
              </p>
            )
          ) : (
            <div className="text-center">
              <p className="text-sm text-sage">
                See how your rate of climb moves week over week.
              </p>
              <Link
                href="/billing"
                className="mt-4 inline-flex items-center justify-center rounded-field bg-ridge px-4 py-2.5 text-sm font-medium text-snow ring-1 ring-scree transition hover:bg-scree"
              >
                Unlock trends
              </Link>
            </div>
          )}
        </Card>
      </section>

      <div className="mt-7 space-y-2.5">
        {viewerRanking && (
          <form action={createShareCard}>
            <input type="hidden" name="group_id" value={params.id} />
            <input type="hidden" name="category_id" value={category.id} />
            <button className="inline-flex w-full items-center justify-center rounded-field bg-summit px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-summit-soft">
              Make a rank card
            </button>
          </form>
        )}

        {isOwner && (
          <form action={recomputeCategory}>
            <input type="hidden" name="group_id" value={params.id} />
            <input type="hidden" name="category_id" value={category.id} />
            <button className="w-full rounded-field bg-ridge px-4 py-3.5 text-sm text-sage ring-1 ring-scree transition hover:bg-scree hover:text-snow">
              Run the ranking
            </button>
          </form>
        )}
      </div>

      {rows.some((r) => r.is_absolute) && !isStreak && (
        <p className="mt-5 text-center text-xs leading-relaxed text-sage/80">
          Some climbers started from zero, so their move shows as an absolute change rather than a
          percentage.
        </p>
      )}
    </AppShell>
  );
}
