// Server only. A client component importing a value from this file would drag
// the database client and node: built-ins into the browser bundle — which is
// exactly what happened before src/lib/modules.ts and src/lib/studios.ts
// existed, and it only surfaced as a build error once a node: import appeared.
// This import turns that mistake into a build failure naming the culprit.
import "server-only";
import * as React from "react";
import type { ServerClient } from "@/lib/supabase/server";
import { timed } from "@/lib/timing";

/**
 * `cache` ships in the React canary that Next vendors for the App Router, not
 * in stable react 18.3 — so it is present when a page renders and absent under
 * vitest, which resolves the real package. Falling back to identity means the
 * dedupe simply does not happen in a unit test, which is correct: a test never
 * renders a request, and it must not fail on a runtime the app never uses.
 */
const cache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as { cache?: <T extends (...args: never[]) => unknown>(fn: T) => T }).cache ??
  ((fn) => fn);

/**
 * REQUEST-SCOPED QUERY CACHE.
 *
 * The exchange loader, the dashboard loader and the wallet loader each needed
 * the caller's stakes, the cohort list and the payouts — so a single page load
 * was fetching `stakes` three times, `stake_cohorts` twice, `payouts` twice and
 * `daily_verification_logs` twice, and doing part of it in a waterfall.
 * Seventeen round trips to render one screen, on all eight module pages.
 *
 * React's `cache()` dedupes within a single server request: the first caller
 * issues the query, every other caller in the same render gets the same
 * promise. Nothing is cached BETWEEN requests, which matters here — this is
 * money and it must be fresh on every load.
 *
 * The rule for anything added later: if two loaders need the same rows, the
 * query belongs in this file.
 */

export const getMyStakes = cache((supabase: ServerClient, userId: string) =>
  timed("stakes", async () => {
  const { data } = await supabase
    .from("stakes")
    .select("id, cohort_id, amount, payment_confirmed, payment_reference, created_at")
    .eq("user_id", userId);
  return data ?? [];
  }, (r) => r.length),
);

export const getCohorts = cache((supabase: ServerClient) =>
  timed("cohorts", async () => {
  const { data } = await supabase
    .from("stake_cohorts")
    .select("id, name, target_value, start_date, end_date, stake_amount, fee_rate, status")
    .order("start_date", { ascending: true });
  return data ?? [];
  }, (r) => r.length),
);

export const getMyPayouts = cache((supabase: ServerClient, userId: string) =>
  timed("payouts", async () => {
  const { data } = await supabase
    .from("payouts")
    .select("id, cohort_id, amount, kind, status, created_at, paid_at, expected_by")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
  }, (r) => r.length),
);

export const getMarket = cache((supabase: ServerClient) =>
  timed("rpc.cohort_market", async () => {
    const { data } = await supabase.rpc("cohort_market");
    return data ?? [];
  }, (r) => r.length),
);

/**
 * Every verification log the caller owns, with the provenance the integrity
 * engine needs. Fetched once and shared by the dashboard (which needs values
 * per stake) and the integrity assessment (which needs the flat list).
 */
export const getMyLogs = cache(async (supabase: ServerClient, userId: string) => {
  const stakes = await getMyStakes(supabase, userId);
  if (stakes.length === 0) return [];
  return timed("verification_logs", async () => {
  const { data } = await supabase
    .from("daily_verification_logs")
    .select("stake_id, log_date, verified_value, source, recorded_at, device_id, created_at")
    .in(
      "stake_id",
      stakes.map((s) => s.id),
    )
    .order("log_date", { ascending: true });
  return data ?? [];
  }, (r) => r.length);
});

/**
 * The per-cohort boards, fetched in one parallel burst rather than one round
 * trip per stake discovered mid-render.
 */
export const getMyBoards = cache(async (supabase: ServerClient, userId: string) => {
  const stakes = await getMyStakes(supabase, userId);
  const entries = await Promise.all(
    stakes.map((s) =>
      timed(
        "rpc.cohort_progress",
        async () => {
          const { data } = await supabase.rpc("cohort_progress", { _cohort_id: s.cohort_id });
          return [s.cohort_id, data ?? []] as const;
        },
        ([, rows]) => rows.length,
      ),
    ),
  );
  return new Map(entries);
});
