import type { ServerClient } from "@/lib/supabase/server";

export const FREE_LIMITS = {
  ownedGroups: 1,
  ownedCategories: 1,
} as const;

export type Tier = "free" | "premium";

export async function getTier(
  supabase: ServerClient,
  userId: string,
): Promise<Tier> {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.tier === "premium" && data.status === "active" ? "premium" : "free";
}

/**
 * Can this user create another group? Free users may OWN one group; joining a
 * friend's group via invite is always allowed (keeps the app viral).
 */
export async function canCreateGroup(
  supabase: ServerClient,
  userId: string,
): Promise<{ allowed: boolean; tier: Tier; reason?: string }> {
  const tier = await getTier(supabase, userId);
  if (tier === "premium") return { allowed: true, tier };

  const { count } = await supabase
    .from("groups")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if ((count ?? 0) >= FREE_LIMITS.ownedGroups) {
    return {
      allowed: false,
      tier,
      reason: `The free plan includes ${FREE_LIMITS.ownedGroups} group you own. Upgrade to Premium for unlimited groups.`,
    };
  }
  return { allowed: true, tier };
}

/**
 * Can this user create another category? Free users may create one category
 * (across the groups they own).
 */
export async function canCreateCategory(
  supabase: ServerClient,
  userId: string,
): Promise<{ allowed: boolean; tier: Tier; reason?: string }> {
  const tier = await getTier(supabase, userId);
  if (tier === "premium") return { allowed: true, tier };

  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId);

  if ((count ?? 0) >= FREE_LIMITS.ownedCategories) {
    return {
      allowed: false,
      tier,
      reason: `The free plan includes ${FREE_LIMITS.ownedCategories} category. Upgrade to Premium for unlimited categories and trend charts.`,
    };
  }
  return { allowed: true, tier };
}
