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
  formatChange,
  rankMedal,
} from "@/components/ui";
import { currentPeriod, formatPeriod } from "@/lib/period";
import { recomputeCategory } from "@/app/groups/[id]/actions";
import { createShareCard } from "@/app/share/actions";

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
    .select("owner_id")
    .eq("id", params.id)
    .maybeSingle();
  const isOwner = group?.owner_id === user?.id;

  const period = currentPeriod();

  // Computed rankings for the current period (derived, safe view).
  const { data: rankings } = await supabase
    .from("leaderboard_rankings")
    .select("user_id, pct_change, is_absolute, rank, profile:profiles(display_name)")
    .eq("category_id", category.id)
    .eq("period_start", period.start)
    .order("rank", { ascending: true });

  // Shared raw values (only those members opted to reveal) for this period.
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
  const viewerRanking = (rankings ?? []).find((r) => r.user_id === user?.id);

  return (
    <AppShell>
      <Header
        title={category.name}
        back={`/groups/${params.id}`}
        subtitle={`Leaderboard · ${formatPeriod(period)}`}
      />

      {searchParams.logged && (
        <div className="mb-4">
          <SuccessNote>Entry saved. Your rank updates when the week&apos;s ranking runs.</SuccessNote>
        </div>
      )}
      {searchParams.recomputed && (
        <div className="mb-4">
          <SuccessNote>Leaderboard recomputed.</SuccessNote>
        </div>
      )}
      {searchParams.error && (
        <div className="mb-4">
          <ErrorNote>
            {searchParams.error === "not_owner"
              ? "Only the group owner can recompute the leaderboard."
              : searchParams.error === "no_ranking"
                ? "You don’t have a ranking yet — log this week and recompute first."
                : "Something went wrong creating your rank card. Try again."}
          </ErrorNote>
        </div>
      )}

      {!viewerLoggedThisWeek && (
        <div className="mb-4">
          <Card className="flex items-center justify-between bg-amber-50">
            <span className="text-sm text-amber-800">You haven&apos;t logged this week yet.</span>
            <Link
              href={`/groups/${params.id}/categories/${category.id}/log-entry`}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Log now
            </Link>
          </Card>
        </div>
      )}

      <div className="space-y-2">
        {(rankings ?? []).length === 0 ? (
          <EmptyState
            title="No ranking yet"
            body="Once members log this week and the ranking runs, the leaderboard shows up here — ranked by rate of improvement from each person's baseline."
          />
        ) : (
          rankings!.map((r) => {
            const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
            const isViewer = r.user_id === user?.id;
            const shared = sharedValueByUser.get(r.user_id);
            return (
              <Card
                key={r.user_id}
                className={`flex items-center justify-between ${isViewer ? "border-brand-300 ring-1 ring-brand-200" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center text-lg font-bold">{rankMedal(r.rank)}</span>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {profile?.display_name ?? "Member"}
                      {isViewer && <span className="text-slate-400"> (you)</span>}
                    </p>
                    {shared !== undefined && (
                      <p className="text-xs text-slate-400">
                        {shared.toLocaleString("en-ZA")} {category.unit}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.is_absolute && <Badge tone="amber">abs</Badge>}
                  <span
                    className={`font-bold ${Number(r.pct_change) >= 0 ? "text-accent-600" : "text-red-500"}`}
                  >
                    {formatChange(Number(r.pct_change), r.is_absolute, category.unit)}
                  </span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {viewerRanking && (
        <form action={createShareCard} className="mt-5">
          <input type="hidden" name="group_id" value={params.id} />
          <input type="hidden" name="category_id" value={category.id} />
          <button className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
            📸 Create my rank card
          </button>
        </form>
      )}

      {isOwner && (
        <form action={recomputeCategory} className="mt-3">
          <input type="hidden" name="group_id" value={params.id} />
          <input type="hidden" name="category_id" value={category.id} />
          <button className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200">
            Recompute now (owner)
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-slate-400">
        The <span className="font-semibold">abs</span> tag means we&apos;re showing absolute change
        (their baseline was 0, so a % isn&apos;t defined).
      </p>
    </AppShell>
  );
}
