import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  needsRefresh,
  canRefresh,
  normalise,
  planMerge,
  sanitise,
  syncWindow,
  type Connection,
  type DailySteps,
  type ExistingLog,
  type Provider,
} from "@/lib/wearables";

/**
 * THE SYNC ENGINE.
 *
 * All of the decisions live in `src/lib/wearables.ts` and are tested without a
 * network. This file is the part that cannot be: HTTP to the providers, the
 * token refresh, and the writes.
 *
 * ── WHAT HAPPENS WITHOUT CREDENTIALS ─────────────────────────────────────────
 * Ascend does not have Fitbit or Google client credentials. Rather than
 * pretending otherwise, every path here fails with a message that NAMES the
 * missing environment variable — the same pattern as `createAdminClient()`.
 * A connect button for a provider that cannot work is never rendered (see
 * `availableProviders()`), and if one is somehow reached the error says which
 * key to set rather than "something went wrong".
 *
 * ── WHY IT WRITES THROUGH THE SERVICE ROLE ───────────────────────────────────
 * It must read `wearable_credentials`, which is deny-all to every client
 * including the owner. That is the whole point of the table. This module is
 * `server-only` and is reachable exclusively from a bearer-gated route.
 */

export interface SyncOutcome {
  provider: Provider;
  ok: boolean;
  fetched: number;
  written: number;
  skipped: number;
  rejected: number;
  message: string;
}

const TOKEN_URL: Record<Exclude<Provider, "apple_health">, string> = {
  fitbit: "https://api.fitbit.com/oauth2/token",
  google_fit: "https://oauth2.googleapis.com/token",
};

function credentials(provider: Provider): { id: string; secret: string } {
  const map = {
    fitbit: ["FITBIT_CLIENT_ID", "FITBIT_CLIENT_SECRET"],
    google_fit: ["GOOGLE_FIT_CLIENT_ID", "GOOGLE_FIT_CLIENT_SECRET"],
    apple_health: ["WEARABLE_PUSH_SECRET", "WEARABLE_PUSH_SECRET"],
  }[provider];

  const id = process.env[map[0]!];
  const secret = process.env[map[1]!];
  if (!id || !secret) {
    throw new Error(
      `${map[0]} / ${map[1]} are not set — refusing to talk to ${provider}. ` +
        `This is a credentials gap, not a code gap: see docs/WEARABLES.md.`,
    );
  }
  return { id, secret };
}

/** Exchange a refresh token for a new access token. */
async function refresh(provider: Provider, conn: Connection): Promise<Connection> {
  if (provider === "apple_health") return conn; // no tokens exist to refresh
  const { id, secret } = credentials(provider);

  const res = await fetch(TOKEN_URL[provider], {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken ?? "",
      client_id: id,
    }),
  });

  if (!res.ok) {
    throw new Error(
      res.status === 400 || res.status === 401
        ? "The connection was revoked at the provider. Reconnect to keep syncing."
        : `The provider returned ${res.status} refreshing the token.`,
    );
  }

  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) throw new Error("The provider returned no access token.");

  return {
    ...conn,
    accessToken: body.access_token,
    // Providers rotate refresh tokens. Keeping the old one after a rotation
    // means the NEXT refresh fails with a revoked-connection error that is
    // entirely self-inflicted.
    refreshToken: body.refresh_token ?? conn.refreshToken,
    expiresAt: body.expires_in
      ? new Date(Date.now() + body.expires_in * 1000).toISOString()
      : null,
  };
}

/** Fetch daily steps for a window. Provider-specific URL, shared handling. */
async function fetchSteps(
  provider: Provider,
  conn: Connection,
  from: string,
  to: string,
): Promise<DailySteps[]> {
  if (provider === "apple_health") return []; // push-only; nothing to pull

  const res =
    provider === "fitbit"
      ? await fetch(
          `https://api.fitbit.com/1/user/-/activities/steps/date/${from}/${to}.json`,
          { headers: { Authorization: `Bearer ${conn.accessToken}` } },
        )
      : await fetch(
          "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${conn.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              aggregateBy: [
                { dataTypeName: "com.google.step_count.delta" },
              ],
              bucketByTime: { durationMillis: 86_400_000 },
              startTimeMillis: Date.parse(`${from}T00:00:00Z`),
              endTimeMillis: Date.parse(`${to}T23:59:59Z`),
            }),
          },
        );

  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? "The connection was revoked at the provider. Reconnect to keep syncing."
        : res.status === 429
          ? "The provider is rate-limiting us. The next run will pick this up."
          : `The provider returned ${res.status}.`,
    );
  }

  return normalise(provider, await res.json());
}

/**
 * Write a batch of days for one user.
 *
 * Shared by the pull sync and the Apple Health push, so both go through the
 * identical sanitise → merge → write path. A push endpoint with its own
 * shortcut write is how one source ends up exempt from the ceiling.
 */
export async function ingest(
  userId: string,
  connectionId: string | null,
  days: DailySteps[],
  today = new Date().toISOString().slice(0, 10),
): Promise<{ written: number; skipped: number; rejected: number }> {
  const db = createAdminClient();
  const { accepted, rejected } = sanitise(days, today);
  if (accepted.length === 0) return { written: 0, skipped: 0, rejected: rejected.length };

  // Only the caller's own stakes. A sync must never be able to write a log
  // against somebody else's stake, whatever the payload says.
  const { data: stakes } = await db
    .from("stakes")
    .select("id, cohort_id")
    .eq("user_id", userId);

  if (!stakes || stakes.length === 0) {
    return { written: 0, skipped: accepted.length, rejected: rejected.length };
  }

  let written = 0;
  let skipped = 0;

  for (const stake of stakes) {
    const { data: existingRows } = await db
      .from("daily_verification_logs")
      .select("id, log_date, verified_value, source")
      .eq("stake_id", stake.id)
      .in("log_date", accepted.map((d) => d.date));

    const existing: ExistingLog[] = (existingRows ?? []).map((r) => ({
      date: String(r.log_date).slice(0, 10),
      steps: Number(r.verified_value ?? 0),
      source: r.source as ExistingLog["source"],
    }));
    const idByDate = new Map(
      (existingRows ?? []).map((r) => [String(r.log_date).slice(0, 10), r.id]),
    );

    for (const { day, decision } of planMerge(accepted, existing)) {
      if (decision === "skip") {
        skipped += 1;
        continue;
      }
      if (decision === "insert") {
        const { error } = await db.from("daily_verification_logs").insert({
          stake_id: stake.id,
          log_date: day.date,
          verified_value: day.steps,
          source: day.source,
          connection_id: connectionId,
        });
        if (!error) written += 1;
        continue;
      }
      const { error } = await db
        .from("daily_verification_logs")
        .update({ verified_value: day.steps, source: day.source, connection_id: connectionId })
        .eq("id", idByDate.get(day.date)!);
      if (!error) written += 1;
    }
  }

  return { written, skipped, rejected: rejected.length };
}

/** Sync one connection end to end, recording what happened either way. */
export async function syncConnection(
  connectionId: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<SyncOutcome> {
  const db = createAdminClient();

  const { data: conn } = await db
    .from("wearable_connections")
    .select("id, user_id, provider, last_synced_on, status")
    .eq("id", connectionId)
    .single();

  if (!conn) throw new Error("No such connection.");
  const provider = conn.provider as Provider;

  const run = await db
    .from("wearable_sync_runs")
    .insert({ connection_id: conn.id, user_id: conn.user_id, provider })
    .select("id")
    .single();

  const finish = async (o: Omit<SyncOutcome, "provider">) => {
    if (run.data) {
      await db
        .from("wearable_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          ok: o.ok,
          days_fetched: o.fetched,
          days_written: o.written,
          days_skipped: o.skipped,
          days_rejected: o.rejected,
          message: o.message,
        })
        .eq("id", run.data.id);
    }
    await db
      .from("wearable_connections")
      .update(
        o.ok
          ? {
              last_synced_on: today,
              last_synced_at: new Date().toISOString(),
              last_error: null,
              status: "active",
            }
          : {
              last_error: o.message,
              status: o.message.includes("revoked") ? "needs_reauth" : "error",
            },
      )
      .eq("id", conn.id);
    return { provider, ...o };
  };

  try {
    const { data: cred } = await db
      .from("wearable_credentials")
      .select("access_token, refresh_token, expires_at")
      .eq("connection_id", conn.id)
      .maybeSingle();

    if (!cred) {
      return await finish({
        ok: false,
        fetched: 0,
        written: 0,
        skipped: 0,
        rejected: 0,
        message: "This connection has no stored credentials. Reconnect it.",
      });
    }

    let connection: Connection = {
      provider,
      accessToken: cred.access_token,
      refreshToken: cred.refresh_token,
      expiresAt: cred.expires_at,
      scope: null,
    };

    if (needsRefresh(connection)) {
      if (!canRefresh(connection)) {
        return await finish({
          ok: false,
          fetched: 0,
          written: 0,
          skipped: 0,
          rejected: 0,
          message: "The connection expired and cannot be renewed. Reconnect to keep syncing.",
        });
      }
      connection = await refresh(provider, connection);
      await db
        .from("wearable_credentials")
        .update({
          access_token: connection.accessToken,
          refresh_token: connection.refreshToken,
          expires_at: connection.expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("connection_id", conn.id);
    }

    const { from, to } = syncWindow(
      conn.last_synced_on ? String(conn.last_synced_on).slice(0, 10) : null,
      today,
    );
    const days = await fetchSteps(provider, connection, from, to);
    const result = await ingest(conn.user_id, conn.id, days, today);

    return await finish({
      ok: true,
      fetched: days.length,
      ...result,
      message: `${result.written} of ${days.length} days written.`,
    });
  } catch (err) {
    return await finish({
      ok: false,
      fetched: 0,
      written: 0,
      skipped: 0,
      rejected: 0,
      message: err instanceof Error ? err.message : "Unknown error.",
    });
  }
}

/** Sync every active pull-based connection. Called by the daily job. */
export async function syncAll(
  today = new Date().toISOString().slice(0, 10),
): Promise<SyncOutcome[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("wearable_connections")
    .select("id")
    .eq("status", "active")
    .in("provider", ["fitbit", "google_fit"]);

  const out: SyncOutcome[] = [];
  for (const c of data ?? []) {
    try {
      out.push(await syncConnection(c.id, today));
    } catch (err) {
      // One broken connection must not stop the run for everybody else.
      out.push({
        provider: "fitbit",
        ok: false,
        fetched: 0,
        written: 0,
        skipped: 0,
        rejected: 0,
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }
  return out;
}
