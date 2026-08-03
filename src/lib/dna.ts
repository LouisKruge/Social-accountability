import { volatility } from "@/lib/position";

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE DNA
//
// An archetype derived from how somebody actually behaves: when they log, how
// evenly, whether they come back after a bad run. Peak performer, consistent
// grinder, weekend warrior, early bird, night owl, comeback specialist.
//
// ── WHY THIS IS YOURS AND NOT THE GROUP'S ────────────────────────────────────
// Every signal here comes from the raw daily logs, and a group can NOT see a
// member's raw logs — they see rate of change and nothing else. That is the
// privacy guarantee Climb is built on, and computing a shareable label out of
// data the group cannot see would launder private information into a public
// one. "Sipho is a night owl" is a fact about when he is awake.
//
// So DNA is computed from the viewer's own logs and shown on the viewer's own
// profile. If it is ever put on a roster it will be behind an explicit per-user
// opt-in, and the label will still be derived only from that person's data.
//
// ── WHY IT IS NEVER A JUDGEMENT ──────────────────────────────────────────────
// There is no "inconsistent" or "quitter" archetype. Every trait here is
// phrased as a working style, because the label sits next to a person's name
// and the product's job is to keep them, not to grade them. `erratic` exists as
// a volatility label on a position — a fact about a series — but a person is
// not their worst fortnight.
// ─────────────────────────────────────────────────────────────────────────────

export type TraitKey =
  | "grinder"
  | "peak"
  | "weekend"
  | "weekday"
  | "early_bird"
  | "night_owl"
  | "comeback"
  | "sprinter"
  | "finisher";

export interface Trait {
  key: TraitKey;
  name: string;
  blurb: string;
  /** 0–1. How strongly the data supports this trait. */
  strength: number;
  /** The figure the trait was read from, stated so it can be checked. */
  evidence: string;
}

export interface DnaDay {
  /** YYYY-MM-DD */
  date: string;
  value: number;
  /** ISO timestamp of when it was recorded. */
  recordedAt: string;
}

/** Below this there is not enough behaviour to describe. */
export const MIN_DAYS_FOR_DNA = 10;

export interface Dna {
  traits: Trait[];
  /** The strongest trait, or null when there is not enough data. */
  primary: Trait | null;
  daysAnalysed: number;
}

/**
 * Read a person's working style from their own logs.
 *
 * Returns at most three traits, strongest first. Fewer than ten logged days
 * returns nothing at all — an archetype assigned from four days is a horoscope,
 * and it would be the first thing a new user saw about themselves.
 */
export function readDna(days: DnaDay[]): Dna {
  if (days.length < MIN_DAYS_FOR_DNA) {
    return { traits: [], primary: null, daysAnalysed: days.length };
  }

  const values = days.map((d) => d.value);
  const active = days.filter((d) => d.value > 0);
  const traits: Trait[] = [];

  // ── Steadiness: grinder vs peak performer ────────────────────────────────
  const v = volatility(values);
  if (v) {
    if (v.cv < 0.25) {
      traits.push({
        key: "grinder",
        name: "Consistent grinder",
        blurb: "You turn up at about the same level every day. Boring on a chart, and the single most reliable way to finish a challenge.",
        strength: clamp01(1 - v.cv / 0.25),
        evidence: `${v.steadiness}/100 steadiness across ${days.length} days`,
      });
    } else if (v.cv > 0.5) {
      traits.push({
        key: "peak",
        name: "Peak performer",
        blurb: "Big days, then quiet ones. It works, and it means one missed peak costs you more than it would somebody flatter.",
        strength: clamp01((v.cv - 0.5) / 0.6),
        evidence: `${v.steadiness}/100 steadiness — your big days are ${Math.round(max(values) / Math.max(1, mean(values)))}× your average`,
      });
    }
  }

  // ── Day of week ──────────────────────────────────────────────────────────
  const weekend = active.filter((d) => isWeekend(d.date));
  const weekday = active.filter((d) => !isWeekend(d.date));
  if (weekend.length >= 3 && weekday.length >= 3) {
    const we = mean(weekend.map((d) => d.value));
    const wd = mean(weekday.map((d) => d.value));
    const ratio = wd > 0 ? we / wd : 1;
    if (ratio >= 1.25) {
      traits.push({
        key: "weekend",
        name: "Weekend warrior",
        blurb: "Saturdays and Sundays carry you. Worth knowing when you pick a challenge window.",
        strength: clamp01((ratio - 1.25) / 0.75),
        evidence: `${Math.round((ratio - 1) * 100)}% more at weekends`,
      });
    } else if (ratio <= 0.75) {
      traits.push({
        key: "weekday",
        name: "Weekday engine",
        blurb: "Your week does the work and the weekend is recovery. A structured routine, not a gap.",
        strength: clamp01((0.75 - ratio) / 0.5),
        evidence: `${Math.round((1 - ratio) * 100)}% less at weekends`,
      });
    }
  }

  // ── Time of day ──────────────────────────────────────────────────────────
  // Read from when the day was RECORDED, which is the only timestamp Ascend
  // has. It is a proxy for when somebody moves, and the copy says "log" rather
  // than claiming to know when they walked.
  const hours = active
    .map((d) => new Date(d.recordedAt).getUTCHours())
    .filter((h) => Number.isFinite(h));
  if (hours.length >= 6) {
    const early = hours.filter((h) => h >= 4 && h < 10).length / hours.length;
    const late = hours.filter((h) => h >= 21 || h < 3).length / hours.length;
    if (early >= 0.5) {
      traits.push({
        key: "early_bird",
        name: "Early bird",
        blurb: "Most of your days are logged before ten. The people who finish challenges usually front-load them.",
        strength: clamp01((early - 0.5) / 0.5),
        evidence: `${Math.round(early * 100)}% of logs before 10am`,
      });
    } else if (late >= 0.4) {
      traits.push({
        key: "night_owl",
        name: "Night owl",
        blurb: "You close the day out late. Worth watching only because a day logged at 23:58 has no room left in it.",
        strength: clamp01((late - 0.4) / 0.6),
        evidence: `${Math.round(late * 100)}% of logs after 9pm`,
      });
    }
  }

  // ── Comeback ─────────────────────────────────────────────────────────────
  const comebacks = countComebacks(days);
  if (comebacks >= 2) {
    traits.push({
      key: "comeback",
      name: "Comeback specialist",
      blurb: "You have gone quiet and come back more than once. That is the rarest habit in this product and the one that actually predicts finishing.",
      strength: clamp01(comebacks / 5),
      evidence: `${comebacks} recoveries after two or more quiet days`,
    });
  }

  // ── Shape of the run ─────────────────────────────────────────────────────
  if (days.length >= 14) {
    const firstHalf = mean(values.slice(0, Math.floor(values.length / 2)));
    const lastHalf = mean(values.slice(Math.floor(values.length / 2)));
    if (lastHalf > firstHalf * 1.2) {
      traits.push({
        key: "finisher",
        name: "Finisher",
        blurb: "You get stronger as a challenge goes on. Most people fade; you do not.",
        strength: clamp01((lastHalf / Math.max(1, firstHalf) - 1.2) / 0.8),
        evidence: `${Math.round((lastHalf / Math.max(1, firstHalf) - 1) * 100)}% stronger in the second half`,
      });
    } else if (firstHalf > lastHalf * 1.2) {
      traits.push({
        key: "sprinter",
        name: "Sprinter",
        blurb: "You start hard. Front-loading is a real strategy — it just needs the finish planned rather than hoped for.",
        strength: clamp01((firstHalf / Math.max(1, lastHalf) - 1.2) / 0.8),
        evidence: `${Math.round((firstHalf / Math.max(1, lastHalf) - 1) * 100)}% stronger in the first half`,
      });
    }
  }

  const sorted = traits.sort((a, b) => b.strength - a.strength).slice(0, 3);
  return { traits: sorted, primary: sorted[0] ?? null, daysAnalysed: days.length };
}

/**
 * A comeback: two or more consecutive quiet days followed by a day back at or
 * above the person's own median.
 */
function countComebacks(days: DnaDay[]): number {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const med = median(ordered.map((d) => d.value).filter((v) => v > 0));
  let quiet = 0;
  let comebacks = 0;
  for (const d of ordered) {
    if (d.value <= med * 0.25) {
      quiet += 1;
    } else {
      if (quiet >= 2 && d.value >= med) comebacks += 1;
      quiet = 0;
    }
  }
  return comebacks;
}

function isWeekend(iso: string): boolean {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0;
}

function max(xs: number[]): number {
  return xs.length ? Math.max(...xs) : 0;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
