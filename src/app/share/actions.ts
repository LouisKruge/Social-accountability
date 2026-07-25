"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentPeriod } from "@/lib/period";

/**
 * Turn the viewer's current-period ranking in a category into a public share
 * card, then send them to the public /share/[cardId] page. Reuses an existing
 * card for the same ranking so we don't pile up duplicates.
 */
export async function createShareCard(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const period = currentPeriod();

  const { data: ranking } = await supabase
    .from("leaderboard_rankings")
    .select("id")
    .eq("category_id", categoryId)
    .eq("user_id", user.id)
    .eq("period_start", period.start)
    .maybeSingle();

  if (!ranking) {
    redirect(`/groups/${groupId}/categories/${categoryId}/leaderboard?error=no_ranking`);
  }

  const { data: existing } = await supabase
    .from("share_cards")
    .select("id")
    .eq("user_id", user.id)
    .eq("ranking_id", ranking.id)
    .maybeSingle();

  if (existing) redirect(`/share/${existing.id}`);

  const { data: card, error } = await supabase
    .from("share_cards")
    .insert({ user_id: user.id, ranking_id: ranking.id, is_public: true })
    .select("id")
    .single();

  if (error || !card) {
    redirect(`/groups/${groupId}/categories/${categoryId}/leaderboard?error=share_failed`);
  }

  redirect(`/share/${card.id}`);
}
