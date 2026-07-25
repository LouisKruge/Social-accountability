import { NextResponse, type NextRequest } from "next/server";
import { runRankingJob, notifyN8n } from "@/lib/rankingJob";
import { currentPeriod, previousPeriod } from "@/lib/period";

// Node runtime: needs the service-role key (server-only) and full fetch.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trusted ranking-compute endpoint. Schedule it weekly (pg_cron / Supabase Edge
 * cron / Vercel Cron) or call it manually during development. Guarded by a
 * shared secret so untrusted callers can't trigger a recompute.
 *
 *   POST /api/rankings/compute
 *   Authorization: Bearer <RANKING_JOB_SECRET>
 *   { "period": "previous" | "current", "groupId"?, "categoryId"?, "notify"?: bool }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RANKING_JOB_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "RANKING_JOB_SECRET is not configured on the server." },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    period?: "previous" | "current";
    groupId?: string;
    categoryId?: string;
    notify?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — use defaults
  }

  const period = body.period === "current" ? currentPeriod() : previousPeriod();

  try {
    const result = await runRankingJob(
      { groupId: body.groupId, categoryId: body.categoryId },
      period,
    );

    const fanout = body.notify === false ? { delivered: false } : await notifyN8n(result);

    return NextResponse.json({
      ok: true,
      period: result.period,
      categoriesProcessed: result.categoriesProcessed,
      rowsWritten: result.rowsWritten,
      notified: fanout.delivered,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
