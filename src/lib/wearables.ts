// ─────────────────────────────────────────────────────────────────────────────
// WEARABLES — provider adapters and the normalisation layer.
//
// ── THE THING MOST INTEGRATIONS GET WRONG ────────────────────────────────────
// The three providers are not the same shape of problem, and pretending they
// are produces a design that cannot work for one of them:
//
//   Fitbit       OAuth 2 + a server-to-server REST API. Ascend can PULL on a
//                schedule. This is the only true background sync.
//
//   Google Fit   OAuth 2 + the REST aggregate API. Ascend can PULL. Note that
//                Google has deprecated Fit in favour of Health Connect on
//                Android; the adapter is written so the transport can be
//                swapped without touching the normalisation.
//
//   Apple Health HAS NO SERVER API. None. HealthKit data never leaves the
//                device except through an app the user installs. There is
//                nothing to OAuth against and nothing to poll. The only honest
//                integration is a PUSH from a client, which is why the ingest
//                path below accepts a signed device payload and why
//                `apple_health` is marked pull: false.
//
// Building "connect Apple Health" as an OAuth button would be a button that
// cannot work. It is modelled as what it is instead.
//
// ── WHAT IS IN THIS FILE ─────────────────────────────────────────────────────
// Only pure functions: provider metadata, payload normalisation, merge rules
// and token expiry. Everything that needs a network or a database lives in
// `wearableSync.ts`, so all of the logic below is testable without credentials
// — which matters, because the credentials are the part Ascend does not have.
// ─────────────────────────────────────────────────────────────────────────────

import type { LogSource } from "@/lib/integrity";

export type Provider = "google_fit" | "apple_health" | "fitbit";

export interface ProviderDef {
  key: Provider;
  name: string;
  /** Can Ascend fetch on a schedule, or must the device push? */
  pull: boolean;
  /** Env vars that must exist before this provider can be connected. */
  requires: string[];
  /** What the user is actually agreeing to share. */
  scopeBlurb: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    key: "fitbit",
    name: "Fitbit",
    pull: true,
    requires: ["FITBIT_CLIENT_ID", "FITBIT_CLIENT_SECRET"],
    scopeBlurb: "Daily step totals only. Not sleep, heart rate, weight or location.",
  },
  {
    key: "google_fit",
    name: "Google Fit",
    pull: true,
    requires: ["GOOGLE_FIT_CLIENT_ID", "GOOGLE_FIT_CLIENT_SECRET"],
    scopeBlurb: "Daily step totals only. Not location history or any other Google data.",
  },
  {
    key: "apple_health",
    name: "Apple Health",
    pull: false,
    requires: ["WEARABLE_PUSH_SECRET"],
    scopeBlurb:
      "Sent from your iPhone, because Apple Health has no server. Daily step totals only.",
  },
];

export function providerDef(p: Provider): ProviderDef {
  return PROVIDERS.find((d) => d.key === p)!;
}

/** Which providers are actually usable right now, given the environment. */
export function availableProviders(env: Record<string, string | undefined>): Provider[] {
  return PROVIDERS.filter((p) => p.requires.every((k) => Boolean(env[k]))).map((p) => p.key);
}

// ── Normalisation ────────────────────────────────────────────────────────────

export interface DailySteps {
  /** YYYY-MM-DD, in the user's own day boundary as the provider reported it. */
  date: string;
  steps: number;
  source: LogSource;
}

/**
 * Fitbit: `activities/steps` time series.
 *
 *   { "activities-steps": [ { "dateTime": "2026-08-01", "value": "8423" } ] }
 *
 * `value` is a STRING. Reading it as a number without the cast silently
 * produces string concatenation the first time it is summed.
 */
export function normaliseFitbit(payload: unknown): DailySteps[] {
  const rows = (payload as { "activities-steps"?: unknown })?.["activities-steps"];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r): DailySteps | null => {
      const row = r as { dateTime?: unknown; value?: unknown };
      const date = typeof row.dateTime === "string" ? row.dateTime.slice(0, 10) : null;
      const steps = Number(row.value);
      return date && Number.isFinite(steps) ? { date, steps, source: "fitbit" } : null;
    })
    .filter((d): d is DailySteps => d !== null && isIsoDate(d.date));
}

/**
 * Google Fit: aggregate buckets, timestamped in MILLISECONDS as strings.
 *
 *   { bucket: [ { startTimeMillis: "1754006400000",
 *                 dataset: [ { point: [ { value: [ { intVal: 8423 } ] } ] } ] } ] }
 *
 * A bucket with no points is a day with no data, which is NOT the same as a
 * day with zero steps — it is dropped rather than recorded as a zero, because
 * a false zero would read as a missed day and cost somebody their streak.
 */
export function normaliseGoogleFit(payload: unknown): DailySteps[] {
  const buckets = (payload as { bucket?: unknown })?.bucket;
  if (!Array.isArray(buckets)) return [];

  const out: DailySteps[] = [];
  for (const b of buckets) {
    const bucket = b as { startTimeMillis?: unknown; dataset?: unknown };
    const ms = Number(bucket.startTimeMillis);
    if (!Number.isFinite(ms)) continue;

    const datasets = Array.isArray(bucket.dataset) ? bucket.dataset : [];
    let steps = 0;
    let sawPoint = false;
    for (const d of datasets) {
      const points = (d as { point?: unknown }).point;
      if (!Array.isArray(points)) continue;
      for (const p of points) {
        const values = (p as { value?: unknown }).value;
        if (!Array.isArray(values)) continue;
        for (const v of values) {
          const n = Number((v as { intVal?: unknown }).intVal);
          if (Number.isFinite(n)) {
            steps += n;
            sawPoint = true;
          }
        }
      }
    }
    if (!sawPoint) continue; // no data ≠ zero steps
    out.push({ date: new Date(ms).toISOString().slice(0, 10), steps, source: "google_fit" });
  }
  return out;
}

/**
 * Apple Health, pushed from the user's own device.
 *
 *   { samples: [ { date: "2026-08-01", steps: 8423 } ] }
 *
 * Shaped by Ascend rather than by Apple, because the payload is produced by a
 * client Ascend writes. It is still validated exactly as strictly as the two
 * third-party shapes: "we wrote the client" is not an integrity guarantee, it
 * is an assumption about a binary running on somebody else's phone.
 */
export function normaliseAppleHealth(payload: unknown): DailySteps[] {
  const rows = (payload as { samples?: unknown })?.samples;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r): DailySteps | null => {
      const row = r as { date?: unknown; steps?: unknown };
      const date = typeof row.date === "string" ? row.date.slice(0, 10) : null;
      const steps = Number(row.steps);
      return date && Number.isFinite(steps) ? { date, steps, source: "apple_health" } : null;
    })
    .filter((d): d is DailySteps => d !== null && isIsoDate(d.date));
}

export function normalise(provider: Provider, payload: unknown): DailySteps[] {
  if (provider === "fitbit") return normaliseFitbit(payload);
  if (provider === "google_fit") return normaliseGoogleFit(payload);
  return normaliseAppleHealth(payload);
}

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

// ── Sanity bounds ────────────────────────────────────────────────────────────

/**
 * The ceiling the integrity engine already uses. Applied HERE too, at the
 * boundary, so an absurd figure never reaches the database at all — a value
 * that only gets flagged downstream has still been written, and a written
 * number is one somebody has to explain later.
 */
export const MAX_DAILY_STEPS = 120_000;

export interface SanitisedBatch {
  accepted: DailySteps[];
  rejected: { date: string; steps: number; why: string }[];
}

export function sanitise(days: DailySteps[], today: string): SanitisedBatch {
  const accepted: DailySteps[] = [];
  const rejected: SanitisedBatch["rejected"] = [];

  for (const d of days) {
    if (d.steps < 0) {
      rejected.push({ ...d, why: "Negative step count." });
    } else if (d.steps > MAX_DAILY_STEPS) {
      rejected.push({ ...d, why: `Above the ${MAX_DAILY_STEPS.toLocaleString("en")} ceiling.` });
    } else if (d.date > today) {
      // A future-dated day means the device clock is wrong or the payload was
      // hand-made. Either way it cannot be evidence of effort already made.
      rejected.push({ ...d, why: "Dated in the future." });
    } else {
      accepted.push({ ...d, steps: Math.round(d.steps) });
    }
  }
  return { accepted, rejected };
}

// ── Merge ────────────────────────────────────────────────────────────────────

export type MergeDecision = "insert" | "update" | "skip";

export interface ExistingLog {
  date: string;
  steps: number;
  source: LogSource;
}

/**
 * What to do when a synced day already has a log.
 *
 * ── THE RULE, AND WHY ────────────────────────────────────────────────────────
 * A device reading never silently overwrites a HIGHER existing figure, and a
 * device reading never overwrites a MANUAL entry at all.
 *
 * Both directions of the naive rule are wrong. "Device always wins" lets a
 * phone left on a desk overwrite a watch's real count with a lower one, which
 * takes away effort the person actually made. "Never overwrite" means the first
 * partial sync of a day freezes it at whatever the count was at 9am.
 *
 * So: same source, take the larger. Different source, keep what is there and
 * let the integrity engine's `device_switch` signal see both.
 */
export function mergeDecision(incoming: DailySteps, existing: ExistingLog | null): MergeDecision {
  if (!existing) return "insert";
  if (existing.source === "manual") return "skip";
  if (existing.source !== incoming.source) return "skip";
  return incoming.steps > existing.steps ? "update" : "skip";
}

export function planMerge(
  incoming: DailySteps[],
  existing: ExistingLog[],
): { day: DailySteps; decision: MergeDecision }[] {
  const byDate = new Map(existing.map((e) => [e.date, e]));
  return incoming.map((day) => ({ day, decision: mergeDecision(day, byDate.get(day.date) ?? null) }));
}

// ── Tokens ───────────────────────────────────────────────────────────────────

export interface Connection {
  provider: Provider;
  accessToken: string;
  refreshToken: string | null;
  /** ISO instant. */
  expiresAt: string | null;
  scope: string | null;
}

/**
 * Refresh a minute early.
 *
 * A token that expires during the request that used it produces a 401 the sync
 * reports as a failure, and the next run does the same thing at the same point.
 * The skew makes that class of failure impossible rather than rare.
 */
export const TOKEN_SKEW_MS = 60_000;

export function needsRefresh(c: Connection, now = new Date()): boolean {
  if (!c.expiresAt) return false;
  return Date.parse(c.expiresAt) - TOKEN_SKEW_MS <= now.getTime();
}

export function canRefresh(c: Connection): boolean {
  return Boolean(c.refreshToken);
}

/**
 * How far back to sync.
 *
 * Thirty days on a first connection so an existing challenge is not empty, and
 * seven days afterwards because providers backfill late — a watch synced on
 * Monday can change Saturday's total.
 */
export function syncWindow(lastSyncedOn: string | null, today: string): { from: string; to: string } {
  const days = lastSyncedOn ? 7 : 30;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return { from: d.toISOString().slice(0, 10), to: today };
}
