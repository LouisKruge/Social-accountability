import { NextResponse, type NextRequest } from "next/server";
import { runTreasuryJob } from "@/lib/treasuryJob";

// Node runtime: needs the service-role key (server-only) and full fetch.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trusted treasury reconciliation. Schedule it daily.
 *
 *   POST /api/treasury/reconcile
 *   Authorization: Bearer <TREASURY_JOB_SECRET>
 *
 * Guarded by its OWN secret rather than reusing RANKING_JOB_SECRET. One secret
 * across two jobs means the credential that recomputes a leaderboard is also
 * the credential that touches escrow, and those deserve to be rotatable
 * independently.
 *
 * This endpoint cannot move money — see the header of src/lib/treasuryJob.ts.
 * It advances bookkeeping state that reflects facts a human already
 * established.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TREASURY_JOB_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "TREASURY_JOB_SECRET is not configured on the server." },
      { status: 500 },
    );
  }

  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTreasuryJob();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
