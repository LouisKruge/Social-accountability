import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ShareCardData {
  cardId: string;
  rankingId: string;
  displayName: string;
  rank: number;
  pctChange: number;
  isAbsolute: boolean;
  categoryName: string;
  metricType: "percentage_change" | "streak";
  unit: string | null;
  groupName: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Assemble the display data for a share card from its RANKING. Uses the service
 * role because the public /share page and OG image are unauthenticated — but
 * only renders a ranking that a user has explicitly turned into a PUBLIC share
 * card (respecting the is_public opt-in). Only the safe derived fields
 * (name, rank, %) are exposed — never raw values or baselines.
 */
export async function loadShareByRanking(rankingId: string): Promise<ShareCardData | null> {
  const admin = createAdminClient();

  const { data: card } = await admin
    .from("share_cards")
    .select("id, ranking_id, is_public")
    .eq("ranking_id", rankingId)
    .eq("is_public", true)
    .maybeSingle();
  if (!card || !card.ranking_id) return null;

  return assemble(card.id, card.ranking_id);
}

/** Same, but keyed by the share card id (for the public /share/[cardId] page). */
export async function loadShareByCard(cardId: string): Promise<ShareCardData | null> {
  const admin = createAdminClient();

  const { data: card } = await admin
    .from("share_cards")
    .select("id, ranking_id, is_public")
    .eq("id", cardId)
    .maybeSingle();
  if (!card || !card.is_public || !card.ranking_id) return null;

  return assemble(card.id, card.ranking_id);
}

async function assemble(cardId: string, rankingId: string): Promise<ShareCardData | null> {
  const admin = createAdminClient();

  const { data: ranking } = await admin
    .from("leaderboard_rankings")
    .select("id, user_id, group_id, category_id, pct_change, is_absolute, rank, period_start, period_end")
    .eq("id", rankingId)
    .maybeSingle();
  if (!ranking) return null;

  const [{ data: profile }, { data: category }, { data: group }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", ranking.user_id).maybeSingle(),
    admin
      .from("categories")
      .select("name, unit, metric_type")
      .eq("id", ranking.category_id)
      .maybeSingle(),
    admin.from("groups").select("name").eq("id", ranking.group_id).maybeSingle(),
  ]);

  return {
    cardId,
    rankingId,
    displayName: profile?.display_name ?? "Someone",
    rank: ranking.rank,
    pctChange: Number(ranking.pct_change),
    isAbsolute: ranking.is_absolute,
    categoryName: category?.name ?? "Category",
    metricType: (category?.metric_type as "percentage_change" | "streak") ?? "percentage_change",
    unit: category?.unit ?? null,
    groupName: group?.name ?? "their group",
    periodStart: ranking.period_start,
    periodEnd: ranking.period_end,
  };
}
