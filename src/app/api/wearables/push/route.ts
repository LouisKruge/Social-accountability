import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingest } from "@/lib/wearableSync";
import { normaliseAppleHealth } from "@/lib/wearables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Apple Health push.
 *
 * HealthKit has no server API, so this is the only possible shape of an Apple
 * integration: the user's own iPhone posts their step totals. See the header of
 * src/lib/wearables.ts.
 *
 * ── AUTHENTICATION ───────────────────────────────────────────────────────────
 * The caller's own SESSION, exactly like every other write in the app. It is
 * deliberately NOT a shared push secret: a shared secret in a shipped binary is
 * a secret every user has, and it would let anybody post steps as anybody. The
 * session means a push can only ever write to the account that made it.
 *
 * ── THE PAYLOAD IS UNTRUSTED ─────────────────────────────────────────────────
 * "We wrote the client" is an assumption about a binary on somebody else's
 * phone, not an integrity guarantee. The payload goes through the identical
 * sanitise → merge → write path as a pulled sync, so the 120k ceiling, the
 * future-date rejection and the never-overwrite-manual rule all apply. A push
 * endpoint with its own shortcut write is how one source ends up exempt.
 */
const MAX_SAMPLES = 120; // ~4 months; more than that is not a sync, it is a dump

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const samples = (payload as { samples?: unknown })?.samples;
  if (!Array.isArray(samples)) {
    return NextResponse.json({ error: "Expected { samples: [...] }." }, { status: 400 });
  }
  if (samples.length > MAX_SAMPLES) {
    return NextResponse.json(
      { error: `Send at most ${MAX_SAMPLES} days per request.` },
      { status: 413 },
    );
  }

  const days = normaliseAppleHealth(payload);

  // The connection row exists so a pushed day can be attributed and shown in
  // the same list as a pulled one. It carries no credentials, because there are
  // none: nothing was authorized, the device simply sent data.
  const db = createAdminClient();
  const { data: conn } = await db
    .from("wearable_connections")
    .upsert(
      { user_id: user.id, provider: "apple_health", status: "active", last_error: null },
      { onConflict: "user_id,provider" },
    )
    .select("id")
    .single();

  const result = await ingest(user.id, conn?.id ?? null, days);

  if (conn) {
    const today = new Date().toISOString().slice(0, 10);
    await db
      .from("wearable_connections")
      .update({ last_synced_on: today, last_synced_at: new Date().toISOString() })
      .eq("id", conn.id);
    await db.from("wearable_sync_runs").insert({
      connection_id: conn.id,
      user_id: user.id,
      provider: "apple_health",
      finished_at: new Date().toISOString(),
      ok: true,
      days_fetched: days.length,
      days_written: result.written,
      days_skipped: result.skipped,
      days_rejected: result.rejected,
      message: `${result.written} of ${days.length} days written.`,
    });
  }

  return NextResponse.json({ ok: true, received: days.length, ...result });
}
