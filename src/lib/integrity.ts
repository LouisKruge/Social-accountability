// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION INTEGRITY ENGINE
//
// Decides how much to trust a logged day. Money changes hands on the strength
// of these numbers, so a day that cannot be trusted must not silently count —
// and, just as importantly, a day that is merely unusual must not be silently
// thrown away.
//
// THREE RULES THIS MODULE IS BUILT AROUND
//
//   1. IT NEVER DELETES EFFORT. The worst outcome here is `accepted: false`,
//      which routes a day to human review. Someone who genuinely walked 40 000
//      steps on the day they hiked a mountain gets looked at, not erased.
//
//   2. EVERY REJECTION IS EXPLAINABLE. Each flag carries a plain-language
//      `detail` written to be shown to the person it is about. "Your Tuesday is
//      being checked because it was filled in nine days late" is a review
//      process; a silent zero is a black box, and a black box on someone's
//      money is how you lose them.
//
//   3. IT IS PURE. No clock, no database, no network — every input is passed
//      in. That is what makes it exhaustively testable, and an anti-cheat
//      system you cannot test is decoration.
//
// WHAT THIS CANNOT DO, AND WHY
// GPS validation, motion/accelerometer analysis, jailbreak and VPN detection
// are native-app capabilities. Ascend is a web app; a browser cannot see any of
// them. They are specified in docs/COMMIT_PLATFORM.md against a future native
// client rather than stubbed here, because a fake `jailbroken: false` that
// always returns false is worse than no check at all — it reads as protection
// while providing none.
// ─────────────────────────────────────────────────────────────────────────────

export type LogSource = "manual" | "google_fit" | "apple_health" | "fitbit";

export interface DayLog {
  /** The date the activity is claimed for. */
  date: string;
  value: number;
  source: LogSource;
  /** When the figure reached our server. Ours, not the client's. */
  recordedAt: string;
  deviceId?: string | null;
  /** What the client believed the time was, if it told us. */
  clientClock?: string | null;
}

export type FlagCode =
  | "impossible_pace"
  | "duplicate_value"
  | "late_backfill"
  | "device_switch"
  | "source_downgrade"
  | "outlier_spike"
  | "clock_skew";

export interface Flag {
  code: FlagCode;
  /** 1 = note it, 2 = it materially lowers trust, 3 = this cannot stand. */
  severity: 1 | 2 | 3;
  /** Written to be read by the person it concerns. */
  detail: string;
}

export interface Verdict {
  date: string;
  /** 0–100. */
  confidence: number;
  flags: Flag[];
  /** False means "held for review", never "discarded". */
  accepted: boolean;
}

// ── Thresholds. Every one of these is a product decision, so each is argued. ──

/** The men's 24-hour racewalking record is ~95 km. 120 000 steps is beyond any
 *  human day; past this we are not looking at a walk. */
export const IMPOSSIBLE_STEPS = 120_000;

/** Reachable by a very long hiking day, so it is a flag, not a rejection. */
export const IMPLAUSIBLE_STEPS = 60_000;

/** Self-reported figures start lower than device-reported ones. This is not an
 *  accusation — it is that nothing corroborates them. */
export const SOURCE_BASE: Record<LogSource, number> = {
  apple_health: 100,
  google_fit: 100,
  fitbit: 100,
  manual: 85,
};

/** Below this a day is held for review rather than counted. */
export const ACCEPT_THRESHOLD = 50;

const PENALTY: Record<1 | 2 | 3, number> = { 1: 8, 2: 25, 3: 60 };

const DEVICE_SOURCES: LogSource[] = ["apple_health", "google_fit", "fitbit"];

const DAY_MS = 86_400_000;

function hoursBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 3_600_000;
}

/** Days between the end of `date` and the moment it was recorded. */
function backfillDays(date: string, recordedAt: string): number {
  const endOfDay = Date.parse(`${date}T23:59:59Z`);
  return (Date.parse(recordedAt) - endOfDay) / DAY_MS;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Assess one day against the rest of its window.
 *
 * `history` is every OTHER day in the same challenge window — the user's own
 * distribution. Judging someone against their own history rather than a global
 * average is the only fair way to do this: 14 000 steps is unremarkable for one
 * person and a red flag for another.
 */
export function assessDay(day: DayLog, history: DayLog[]): Verdict {
  const flags: Flag[] = [];

  // ── Physically impossible ─────────────────────────────────────────────────
  if (day.value > IMPOSSIBLE_STEPS) {
    flags.push({
      code: "impossible_pace",
      severity: 3,
      detail: `${Math.round(day.value).toLocaleString("en")} steps in one day is beyond what a person can walk. This day can't be counted as it stands.`,
    });
  } else if (day.value > IMPLAUSIBLE_STEPS) {
    flags.push({
      code: "outlier_spike",
      severity: 2,
      detail: `${Math.round(day.value).toLocaleString("en")} steps is an exceptional day. We check these before they count toward money.`,
    });
  }

  // ── The same figure, repeatedly ───────────────────────────────────────────
  // Real step counts do not repeat exactly. Three identical non-trivial days is
  // a typed number, not a walked one.
  if (day.value > 0) {
    const identical = history.filter((h) => h.value === day.value).length;
    if (identical >= 2) {
      flags.push({
        code: "duplicate_value",
        severity: 2,
        detail: `The exact figure ${Math.round(day.value).toLocaleString("en")} appears on ${identical + 1} days. Step counts don't normally land on the same number twice.`,
      });
    }
  }

  // ── Filled in long after the fact ─────────────────────────────────────────
  const late = backfillDays(day.date, day.recordedAt);
  if (late > 7) {
    flags.push({
      code: "late_backfill",
      severity: 3,
      detail: `This day was entered ${Math.floor(late)} days after it ended, which is too late to verify.`,
    });
  } else if (late > 2) {
    flags.push({
      code: "late_backfill",
      severity: 2,
      detail: `This day was entered ${Math.floor(late)} days late.`,
    });
  } else if (late > 1) {
    flags.push({
      code: "late_backfill",
      severity: 1,
      detail: "This day was entered a day late.",
    });
  }

  // ── The device changed mid-window ─────────────────────────────────────────
  if (day.deviceId) {
    const others = history.map((h) => h.deviceId).filter(Boolean) as string[];
    if (others.length >= 3 && !others.includes(day.deviceId)) {
      flags.push({
        code: "device_switch",
        severity: 1,
        detail: "This came from a device we haven't seen on this challenge before.",
      });
    }
  }

  // ── A wearable window that suddenly goes manual ───────────────────────────
  // The commonest way to fake a challenge: connect a tracker, then hand-type
  // the days you did not walk.
  if (day.source === "manual") {
    const deviceDays = history.filter((h) => DEVICE_SOURCES.includes(h.source)).length;
    if (deviceDays >= 3) {
      flags.push({
        code: "source_downgrade",
        severity: 2,
        detail: "Earlier days on this challenge came from your tracker; this one was typed in by hand.",
      });
    }
  }

  // ── Far outside this person's own distribution ────────────────────────────
  const priors = history.map((h) => h.value).filter((v) => v > 0);
  if (priors.length >= 5 && day.value > 0) {
    const med = median(priors);
    if (med > 0 && day.value > med * 3 && day.value - med > 15_000) {
      flags.push({
        code: "outlier_spike",
        severity: 2,
        detail: `This is more than three times your usual day on this challenge (about ${Math.round(med).toLocaleString("en")}).`,
      });
    }
  }

  // ── The client's clock disagreed with ours ────────────────────────────────
  if (day.clientClock && hoursBetween(day.clientClock, day.recordedAt) > 6) {
    flags.push({
      code: "clock_skew",
      severity: 2,
      detail: "Your device's clock was well out of step with ours when this was sent.",
    });
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  // Deduplicated by code: two outlier reasons are one reason to distrust the
  // day, and stacking them would punish a single anomaly twice.
  const worstByCode = new Map<FlagCode, Flag>();
  for (const f of flags) {
    const prev = worstByCode.get(f.code);
    if (!prev || f.severity > prev.severity) worstByCode.set(f.code, f);
  }
  const scored = Array.from(worstByCode.values());

  const base = SOURCE_BASE[day.source];
  const penalty = scored.reduce((t, f) => t + PENALTY[f.severity], 0);
  const confidence = Math.max(0, Math.min(100, base - penalty));

  return {
    date: day.date,
    confidence,
    flags: scored.sort((a, b) => b.severity - a.severity),
    accepted: confidence >= ACCEPT_THRESHOLD,
  };
}

export interface WindowAssessment {
  perDay: Verdict[];
  /** 0–100: how much the whole window can be trusted. */
  integrityScore: number;
  /** Steps from accepted days only — the figure that counts toward a target. */
  acceptedTotal: number;
  /** Steps from days held for review. Not lost, not yet counted. */
  heldTotal: number;
  heldDays: number;
  /** True when a human needs to look before this cohort settles. */
  needsReview: boolean;
}

/**
 * Assess a whole challenge window.
 *
 * The integrity score is the confidence-weighted mean rather than the raw mean:
 * one bad day in thirty should dent a score, not destroy it, but ten bad days
 * out of thirty should be disqualifying.
 */
export function assessWindow(days: DayLog[]): WindowAssessment {
  const perDay = days.map((d) =>
    assessDay(
      d,
      days.filter((o) => o.date !== d.date),
    ),
  );

  const accepted = perDay.filter((v) => v.accepted);
  const held = perDay.filter((v) => !v.accepted);
  const byDate = new Map(days.map((d) => [d.date, d.value]));

  const acceptedTotal = accepted.reduce((t, v) => t + (byDate.get(v.date) ?? 0), 0);
  const heldTotal = held.reduce((t, v) => t + (byDate.get(v.date) ?? 0), 0);

  const integrityScore = perDay.length
    ? Math.round(perDay.reduce((t, v) => t + v.confidence, 0) / perDay.length)
    : 100;

  return {
    perDay,
    integrityScore,
    acceptedTotal,
    heldTotal,
    heldDays: held.length,
    needsReview: held.length > 0,
  };
}

/** The one-line summary the Trust panel shows. Never accusatory. */
export function integrityLabel(score: number): { label: string; tone: "good" | "watch" | "bad" } {
  if (score >= 90) return { label: "Verified", tone: "good" };
  if (score >= 70) return { label: "Mostly verified", tone: "good" };
  if (score >= ACCEPT_THRESHOLD) return { label: "Some days under review", tone: "watch" };
  return { label: "Needs review before payout", tone: "bad" };
}
