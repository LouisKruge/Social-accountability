import { weightedScore } from "@/lib/intelligence";

// ─────────────────────────────────────────────────────────────────────────────
// THE TRANSFORMATION SCORE — Elevate's own number.
//
// The brief is emphatic and it is right: **not attractiveness. Transformation.**
// That distinction is the entire design constraint, and it is enforceable
// rather than aspirational, because of what the inputs are.
//
// Every signal below is a count of something the person DID:
//
//   catalogued a wardrobe item · actually wore it · saved a look ·
//   completed a coaching action · finished a photo review ·
//   recorded a timeline entry · prepared for a real event
//
// None of them is an opinion about how somebody looks. There is no model in
// this path at all. A score built on a model's assessment of a face would be
// an attractiveness score wearing a different label, and it would move when the
// model changed rather than when the person did.
//
// "The score changes ONLY when real improvement happens" — that is exactly what
// counting actions gets you, and it is not achievable any other way.
//
// ── COVERAGE, SAME AS EVERYWHERE ─────────────────────────────────────────────
// Grooming and communication carry weight and are permanently null: there is no
// grooming log and the Communication Lab is not built. Reported as missing with
// their weight, excluded from the arithmetic. See docs/LIFE_OS.md §3.
// ─────────────────────────────────────────────────────────────────────────────

export type TransformationSignalKey =
  | "wardrobe"
  | "wardrobe_use"
  | "styling"
  | "coaching"
  | "reviews"
  | "record"
  | "events"
  | "grooming"
  | "communication";

export const TRANSFORMATION_SIGNALS: {
  key: TransformationSignalKey;
  label: string;
  weight: number;
}[] = [
  { key: "coaching", label: "Coaching actions completed", weight: 24 },
  { key: "wardrobe_use", label: "Wardrobe actually worn", weight: 16 },
  { key: "events", label: "Events prepared for", weight: 14 },
  { key: "wardrobe", label: "Wardrobe catalogued", weight: 12 },
  { key: "record", label: "Progress recorded", weight: 12 },
  { key: "styling", label: "Looks built", weight: 10 },
  { key: "reviews", label: "Reviews completed", weight: 4 },
  { key: "grooming", label: "Grooming routine", weight: 5 },
  { key: "communication", label: "Communication practice", weight: 3 },
];

export function transformationBand(score: number): string {
  if (score >= 900) return "Transformed";
  if (score >= 800) return "Compounding";
  if (score >= 700) return "In motion";
  if (score >= 600) return "Building";
  if (score >= 450) return "Getting started";
  return "Just arrived";
}

export interface TransformationInputs {
  wardrobeItems: number;
  wardrobeWorn: number;
  looks: number;
  actionsTotal: number;
  actionsDone: number;
  reports: number;
  timelineEntries: number;
  /** Weeks between the first and most recent timeline entry. */
  recordSpanWeeks: number;
  eventsPrepared: number;
  eventsTotal: number;
}

/**
 * Targets at which a signal counts as fully satisfied.
 *
 * Deliberately modest. A person with 25 catalogued items has a wardrobe Ascend
 * can genuinely reason about; asking for 200 would make the score a measure of
 * data-entry stamina rather than of transformation.
 */
const FULL = {
  wardrobe: 25,
  looks: 8,
  reports: 3,
  record: 12,
  recordSpanWeeks: 12,
} as const;

export function transformationScore(i: TransformationInputs) {
  return weightedScore(
    TRANSFORMATION_SIGNALS,
    {
      // A completion RATE, not a count: someone with three actions who did all
      // three is not behind someone with thirty who did four.
      coaching: i.actionsTotal > 0 ? i.actionsDone / i.actionsTotal : null,
      wardrobe_use: i.wardrobeItems > 0 ? i.wardrobeWorn / i.wardrobeItems : null,
      events: i.eventsTotal > 0 ? i.eventsPrepared / i.eventsTotal : null,
      wardrobe: i.wardrobeItems > 0 ? Math.min(1, i.wardrobeItems / FULL.wardrobe) : null,
      // Both how much is recorded and over how long. A person who logged twelve
      // entries in one afternoon has not transformed over twelve weeks, and
      // multiplying the two is what stops a burst from reading as a journey.
      record:
        i.timelineEntries > 0
          ? Math.min(1, i.timelineEntries / FULL.record) *
            Math.min(1, Math.max(1, i.recordSpanWeeks) / FULL.recordSpanWeeks)
          : null,
      styling: i.looks > 0 ? Math.min(1, i.looks / FULL.looks) : null,
      reviews: i.reports > 0 ? Math.min(1, i.reports / FULL.reports) : null,
      grooming: null,
      communication: null,
    },
    transformationBand,
  );
}

/** Signals with no data source yet, and what would light them up. */
export const TRANSFORMATION_UNAVAILABLE: Partial<Record<TransformationSignalKey, string>> = {
  grooming: "Needs a grooming routine to track",
  communication: "Needs the Communication Lab",
};
