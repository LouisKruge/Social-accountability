import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadExchange } from "@/lib/exchange";
import { loadElevate } from "@/lib/elevate";
import { report, serverTimingHeader, record } from "@/lib/timing";

export const dynamic = "force-dynamic";

/**
 * WHERE THE TIME ACTUALLY GOES.
 *
 * Hit this in production, signed in, and it runs the real loaders against the
 * real database from the real region, then reports what each query cost. That
 * closes the gap the last two performance commits left open: both were reasoned
 * about statically because this sandbox cannot reach Supabase, and "seventeen
 * round trips became twelve" is not the same claim as "it got faster".
 *
 *   GET /api/debug/timing            → the Commit exchange
 *   GET /api/debug/timing?load=elevate
 *
 * ── WHY THIS IS SAFE TO SHIP ─────────────────────────────────────────────────
 * It is authenticated, and the Supabase client it uses is the ordinary
 * RLS-bound one — so it can only ever exercise the caller's own data, exactly
 * as the page would. And it returns NO data: only span names, durations and row
 * counts. There is no amount, no photograph, no name and no id in the response.
 * Row counts are included because "slow" and "slow because it returned four
 * thousand rows" are different bugs.
 */
export async function GET(request: Request) {
  const started = performance.now();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to profile your own requests." }, { status: 401 });
  }
  record("auth.getUser", performance.now() - started);

  const which = new URL(request.url).searchParams.get("load") ?? "exchange";

  const t0 = performance.now();
  let shape: Record<string, number> = {};
  try {
    if (which === "elevate") {
      const state = await loadElevate(supabase, user.id);
      shape = {
        wardrobe_items: state.wardrobe.length,
        open_actions: state.actions.length,
        timeline_entries: state.timeline.length,
      };
    } else {
      const state = await loadExchange(supabase, user.id);
      shape = {
        active_positions: state.dashboard.active.length,
        open_challenges: state.dashboard.open.length,
        ledger_lines: state.wallet.ledger.length,
        payouts: state.wallet.payouts.length,
      };
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Loader threw", message: err instanceof Error ? err.message : String(err), timing: report() },
      { status: 500 },
    );
  }
  const wallMs = Math.round((performance.now() - t0) * 10) / 10;

  const r = report();
  return NextResponse.json(
    {
      load: which,
      // Wall time is what the user waits. The db total is the sum of every
      // span, and it EXCEEDS wall time whenever queries ran in parallel —
      // the ratio between them is how much parallelism is actually happening.
      wall_ms: wallMs,
      db_total_ms: r.totalMs,
      parallelism: r.totalMs > 0 ? Math.round((r.totalMs / Math.max(wallMs, 0.1)) * 100) / 100 : 0,
      round_trips: r.spanCount,
      slowest: r.slowest,
      by_name: r.byName,
      spans: r.spans,
      // Not data — the SIZE of the data, so a slow query can be told apart
      // from a query returning too much.
      result_shape: shape,
    },
    {
      status: 200,
      headers: {
        // Browsers render this in the Network panel's Timing tab, so the same
        // report is readable on a phone with no tooling at all.
        "Server-Timing": serverTimingHeader(),
        "Cache-Control": "no-store, private",
      },
    },
  );
}
