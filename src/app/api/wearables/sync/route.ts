import { NextResponse, type NextRequest } from "next/server";
import { syncAll } from "@/lib/wearableSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Provider round trips add up across every connection in one run.
export const maxDuration = 300;

/**
 * Pull every active connection. Schedule it daily.
 *
 *   POST /api/wearables/sync
 *   Authorization: Bearer <WEARABLE_JOB_SECRET>
 *
 * Its own secret, not the ranking or treasury one. A credential that can read
 * every user's OAuth tokens should be rotatable without touching anything else.
 *
 * Always 200 with per-connection outcomes rather than failing the whole run on
 * one bad connection: a single revoked Fitbit must not stop everybody else's
 * steps syncing, and the cron scheduler retrying the entire batch because of
 * one 500 makes that worse rather than better.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.WEARABLE_JOB_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "WEARABLE_JOB_SECRET is not configured on the server." },
      { status: 500 },
    );
  }

  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAll();
  return NextResponse.json({
    ok: true,
    connections: results.length,
    succeeded: results.filter((r) => r.ok).length,
    daysWritten: results.reduce((t, r) => t + r.written, 0),
    // Messages only — never a token, never a provider id.
    results: results.map((r) => ({ provider: r.provider, ok: r.ok, message: r.message })),
  });
}
