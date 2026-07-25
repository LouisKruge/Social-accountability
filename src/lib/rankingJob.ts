import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { computeRankings, type MetricType, type Direction } from "@/lib/ranking";
import { previousPeriod, type Period } from "@/lib/period";

export interface RankingJobFilter {
  groupId?: string;
  categoryId?: string;
}

export interface RankedRowPayload {
  group_id: string;
  category_id: string;
  category_name: string;
  unit: string | null;
  period_start: string;
  period_end: string;
  user_id: string;
  display_name: string;
  phone_number: string | null;
  notify_whatsapp: boolean;
  pct_change: number;
  is_absolute: boolean;
  rank: number;
}

export interface RankingJobResult {
  period: Period;
  categoriesProcessed: number;
  rowsWritten: number;
  rankings: RankedRowPayload[];
}

/**
 * The weekly reset / ranking-compute job. Runs with the SERVICE ROLE (bypasses
 * RLS) because it reads every participant's private entries + baselines to
 * compute the safe, derived leaderboard. Never call this from client code.
 *
 * For each active (group, category) with entries in the target period it:
 *   1. computes pct_change per user (increase/decrease aware, baseline-0 safe),
 *   2. ranks them (ties → earliest submission), and
 *   3. upserts rows into leaderboard_rankings.
 *
 * Returns a payload the caller can hand to the n8n WhatsApp fan-out.
 */
export async function runRankingJob(
  filter: RankingJobFilter = {},
  period: Period = previousPeriod(),
): Promise<RankingJobResult> {
  const admin = createAdminClient();

  // Which categories are we computing? (optionally narrowed to one group/category)
  let catQuery = admin
    .from("categories")
    .select("id, group_id, name, unit, metric_type, direction");
  if (filter.categoryId) catQuery = catQuery.eq("id", filter.categoryId);
  if (filter.groupId) catQuery = catQuery.eq("group_id", filter.groupId);

  const { data: categories, error: catErr } = await catQuery;
  if (catErr) throw new Error(`Failed to load categories: ${catErr.message}`);

  const rankings: RankedRowPayload[] = [];
  const rowsToUpsert: {
    group_id: string;
    category_id: string;
    period_start: string;
    period_end: string;
    user_id: string;
    pct_change: number;
    is_absolute: boolean;
    rank: number;
  }[] = [];

  let categoriesProcessed = 0;

  for (const category of categories ?? []) {
    // Entries for this category in the target period.
    const { data: entries, error: entErr } = await admin
      .from("entries")
      .select("user_id, raw_value, created_at")
      .eq("category_id", category.id)
      .eq("period_start", period.start);
    if (entErr) throw new Error(`Failed to load entries: ${entErr.message}`);
    if (!entries || entries.length === 0) continue;

    const userIds = entries.map((e) => e.user_id);

    // Baselines for those users.
    const { data: baselines } = await admin
      .from("category_baselines")
      .select("user_id, baseline_value")
      .eq("category_id", category.id)
      .in("user_id", userIds);
    const baselineByUser = new Map(baselines?.map((b) => [b.user_id, Number(b.baseline_value)]));

    // Profiles for the payload (WhatsApp fan-out needs name + phone).
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, phone_number, notify_whatsapp")
      .in("id", userIds);
    const profileByUser = new Map(profiles?.map((p) => [p.id, p]));

    const computed = computeRankings(
      {
        metricType: category.metric_type as MetricType,
        direction: category.direction as Direction,
      },
      entries.map((e) => ({
        userId: e.user_id,
        currentValue: Number(e.raw_value),
        baselineValue: baselineByUser.get(e.user_id) ?? null,
        submittedAt: e.created_at,
      })),
    );

    for (const row of computed) {
      const profile = profileByUser.get(row.userId);
      rowsToUpsert.push({
        group_id: category.group_id,
        category_id: category.id,
        period_start: period.start,
        period_end: period.end,
        user_id: row.userId,
        pct_change: row.pctChange,
        is_absolute: row.isAbsolute,
        rank: row.rank,
      });
      rankings.push({
        group_id: category.group_id,
        category_id: category.id,
        category_name: category.name,
        unit: category.unit,
        period_start: period.start,
        period_end: period.end,
        user_id: row.userId,
        display_name: profile?.display_name ?? "Someone",
        phone_number: profile?.phone_number ?? null,
        notify_whatsapp: profile?.notify_whatsapp ?? true,
        pct_change: row.pctChange,
        is_absolute: row.isAbsolute,
        rank: row.rank,
      });
    }
    categoriesProcessed += 1;
  }

  if (rowsToUpsert.length > 0) {
    const { error: upErr } = await admin
      .from("leaderboard_rankings")
      .upsert(rowsToUpsert, { onConflict: "group_id,category_id,period_start,user_id" });
    if (upErr) throw new Error(`Failed to write rankings: ${upErr.message}`);
  }

  return {
    period,
    categoriesProcessed,
    rowsWritten: rowsToUpsert.length,
    rankings,
  };
}

/**
 * Fan the computed rankings out to the n8n webhook, which owns WhatsApp
 * messaging + top-3 share-card generation. No-op (logged) if the webhook URL
 * isn't configured. The service-role key is NEVER sent to n8n — only the safe,
 * derived leaderboard payload.
 */
export async function notifyN8n(result: RankingJobResult): Promise<{ delivered: boolean }> {
  const url = process.env.N8N_RANKINGS_WEBHOOK_URL;
  if (!url) {
    console.warn("[rankingJob] N8N_RANKINGS_WEBHOOK_URL not set — skipping fan-out");
    return { delivered: false };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.N8N_WEBHOOK_SECRET
        ? { "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET }
        : {}),
    },
    body: JSON.stringify({
      event: "rankings.computed",
      period: result.period,
      site_url: process.env.NEXT_PUBLIC_SITE_URL,
      rankings: result.rankings,
    }),
  });
  return { delivered: res.ok };
}
