"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canCreateCategory } from "@/lib/entitlements";
import { currentPeriod } from "@/lib/period";
import { runRankingJob } from "@/lib/rankingJob";

export type ActionState = { error?: string; success?: string };

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const METRIC_TYPES = ["percentage_change", "streak"] as const;
const DIRECTIONS = ["increase", "decrease"] as const;

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const metricType = String(formData.get("metric_type") ?? "percentage_change");
  const direction = String(formData.get("direction") ?? "increase");
  const unit = String(formData.get("unit") ?? "").trim() || null;

  if (!name) return { error: "Give the category a name (e.g. Steps, Savings)." };
  if (!METRIC_TYPES.includes(metricType as (typeof METRIC_TYPES)[number]))
    return { error: "Invalid metric type." };
  if (!DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number]))
    return { error: "Invalid direction." };

  const { supabase, user } = await requireUser();

  const gate = await canCreateCategory(supabase, user.id);
  if (!gate.allowed) return { error: gate.reason };

  const { error } = await supabase.from("categories").insert({
    group_id: groupId,
    name,
    metric_type: metricType as (typeof METRIC_TYPES)[number],
    direction: direction as (typeof DIRECTIONS)[number],
    unit,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/groups/${groupId}`);
  return { success: `Added “${name}”.` };
}

/**
 * Log this period's value. The FIRST value a user logs for a category also sets
 * their baseline — they climb from there. Re-logging the same period updates it.
 */
export async function logEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const rawValueRaw = String(formData.get("raw_value") ?? "").trim();
  const shareRawValue = formData.get("share_raw_value") === "on";

  const rawValue = Number(rawValueRaw);
  if (rawValueRaw === "" || Number.isNaN(rawValue)) {
    return { error: "Enter a number for this period’s value." };
  }
  if (rawValue < 0) return { error: "Value can’t be negative." };

  const { supabase, user } = await requireUser();
  const period = currentPeriod();

  // Set baseline on first entry (idempotent — ignore if one already exists).
  const { data: baseline } = await supabase
    .from("category_baselines")
    .select("id")
    .eq("user_id", user.id)
    .eq("category_id", categoryId)
    .maybeSingle();

  if (!baseline) {
    const { error: bErr } = await supabase.from("category_baselines").insert({
      user_id: user.id,
      category_id: categoryId,
      baseline_value: rawValue,
      baseline_date: period.start,
    });
    if (bErr) return { error: `Couldn’t set your baseline: ${bErr.message}` };
  }

  // Upsert this period's entry (unique on user+category+period_start).
  const { error: eErr } = await supabase.from("entries").upsert(
    {
      user_id: user.id,
      category_id: categoryId,
      period_start: period.start,
      period_end: period.end,
      raw_value: rawValue,
      share_raw_value: shareRawValue,
    },
    { onConflict: "user_id,category_id,period_start" },
  );
  if (eErr) return { error: `Couldn’t save your entry: ${eErr.message}` };

  revalidatePath(`/groups/${groupId}/categories/${categoryId}/leaderboard`);
  redirect(`/groups/${groupId}/categories/${categoryId}/leaderboard?logged=1`);
}

/**
 * Owner-triggered recompute of the CURRENT period's leaderboard. Handy for
 * dev/demo before the weekly cron is live. Authorization is checked with the
 * RLS client before invoking the service-role job.
 */
export async function recomputeCategory(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const { supabase, user } = await requireUser();

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.owner_id !== user.id) {
    redirect(`/groups/${groupId}/categories/${categoryId}/leaderboard?error=not_owner`);
  }

  await runRankingJob({ groupId, categoryId }, currentPeriod());
  revalidatePath(`/groups/${groupId}/categories/${categoryId}/leaderboard`);
  redirect(`/groups/${groupId}/categories/${categoryId}/leaderboard?recomputed=1`);
}
