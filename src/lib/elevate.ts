import type { ServerClient } from "@/lib/supabase/server";
import { costPerWear, neverWorn, type Occasion, type WardrobeItem } from "@/lib/wardrobe";

/**
 * ELEVATE — five studios under one roof.
 *
 * The old Elevate was one route that did one thing: upload photos, wait, read a
 * report. That is a product you use once. A studio you can walk into with a
 * specific question — "what do I wear on Thursday", "how do I take this photo",
 * "what have I actually changed since March" — is one you come back to.
 *
 * ── WHAT IS ABSENT HERE, ON PURPOSE ──────────────────────────────────────────
 * There is no cross-user anything. No gallery, no comparison, no "people with
 * your style", no ranking, no score. Commit has cohort_progress() and
 * cohort_market(); Elevate has no equivalent and must never acquire one. Every
 * query below is `.eq("user_id", userId)` against an owner-only table.
 */

export type StudioKey = "style" | "look" | "photo" | "confidence" | "timeline";

export interface StudioDef {
  key: StudioKey;
  href: string;
  name: string;
  /** The question someone walks in with. */
  question: string;
}

export const STUDIOS: StudioDef[] = [
  {
    key: "style",
    href: "/elevate/style",
    name: "Style Studio",
    question: "What do I wear?",
  },
  {
    key: "look",
    href: "/elevate/look",
    name: "Look Lab",
    question: "What do I ask the barber for?",
  },
  {
    key: "photo",
    href: "/elevate/photo",
    name: "Photo Coach",
    question: "How do I take this shot?",
  },
  {
    key: "confidence",
    href: "/elevate/confidence",
    name: "Confidence Coach",
    question: "What do I practise today?",
  },
  {
    key: "timeline",
    href: "/elevate/timeline",
    name: "Timeline",
    question: "What have I actually changed?",
  },
];

export const GOAL_LABEL: Record<string, string> = {
  interview: "Interview",
  professional: "Professional brand",
  dating_profile: "Dating profile",
  wedding: "Wedding",
  vacation: "Vacation",
  general_confidence: "General confidence",
  content_creator: "Content creator",
  university: "University",
  networking: "Networking",
};

export const DIRECTION_LABEL: Record<string, string> = {
  minimal: "Minimal",
  classic: "Classic",
  streetwear: "Streetwear",
  business: "Business",
  athleisure: "Athleisure",
  smart_casual: "Smart casual",
  creative: "Creative",
  outdoor: "Outdoor",
  formal: "Formal",
};

export interface StudioStatus {
  key: StudioKey;
  value: string | null;
  caption: string;
  alert: boolean;
}

export interface CoachAction {
  id: string;
  studio: StudioKey;
  title: string;
  detail: string;
  impact: number;
  effort: number;
  costZar: number | null;
  status: "open" | "doing" | "done" | "dismissed";
}

export interface TimelineEntry {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  occurredAt: string;
}

export interface StyleProfile {
  direction: string;
  goalMode: string;
  budgetTier: "low" | "mid" | "high";
  notes: string | null;
  avoid: string[];
}

export interface ElevateState {
  ageConfirmed: boolean;
  profile: StyleProfile | null;
  wardrobe: WardrobeItem[];
  actions: CoachAction[];
  timeline: TimelineEntry[];
  reportCount: number;
  looksCount: number;
  studios: Record<StudioKey, StudioStatus>;
  /** The single most useful next step, or null when there isn't one. */
  nextStep: { text: string; href: string } | null;
  wardrobeStats: {
    total: number;
    neverWornCount: number;
    /** Best cost-per-wear in the wardrobe, or null with no priced+worn items. */
    bestValue: { name: string; cpw: number } | null;
  };
}

export async function loadElevate(
  supabase: ServerClient,
  userId: string,
): Promise<ElevateState> {
  const [
    { data: profileRow },
    { data: styleRow },
    { data: itemRows },
    { data: actionRows },
    { data: timelineRows },
    { count: reportCount },
    { count: looksCount },
  ] = await Promise.all([
    supabase.from("profiles").select("glowup_age_confirmed_at").eq("id", userId).maybeSingle(),
    supabase
      .from("style_profiles")
      .select("direction, goal_mode, budget_tier, notes, avoid")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("wardrobe_items")
      .select("id, name, category, colour, seasons, occasions, price_zar, wear_count")
      .eq("user_id", userId)
      .eq("archived", false),
    supabase
      .from("coach_actions")
      .select("id, studio, title, detail, impact, effort, cost_zar, status")
      .eq("user_id", userId)
      .in("status", ["open", "doing"])
      .order("impact", { ascending: false })
      .limit(20),
    supabase
      .from("timeline_entries")
      .select("id, kind, title, detail, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(20),
    supabase
      .from("glowup_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase.from("looks").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const wardrobe: WardrobeItem[] = (itemRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    colour: r.colour,
    seasons: (r.seasons ?? []) as WardrobeItem["seasons"],
    occasions: (r.occasions ?? []) as Occasion[],
    priceZar: r.price_zar === null ? null : Number(r.price_zar),
    wearCount: r.wear_count,
  }));

  const actions: CoachAction[] = (actionRows ?? []).map((r) => ({
    id: r.id,
    studio: r.studio as StudioKey,
    title: r.title,
    detail: r.detail,
    impact: r.impact,
    effort: r.effort,
    costZar: r.cost_zar === null ? null : Number(r.cost_zar),
    status: r.status as CoachAction["status"],
  }));

  const priced = wardrobe
    .map((i) => ({ name: i.name, cpw: costPerWear(i.priceZar, i.wearCount) }))
    .filter((x): x is { name: string; cpw: number } => x.cpw !== null)
    .sort((a, b) => a.cpw - b.cpw);

  const profile: StyleProfile | null = styleRow
    ? {
        direction: styleRow.direction,
        goalMode: styleRow.goal_mode,
        budgetTier: styleRow.budget_tier as StyleProfile["budgetTier"],
        notes: styleRow.notes,
        avoid: styleRow.avoid ?? [],
      }
    : null;

  const studios: Record<StudioKey, StudioStatus> = {
    style: {
      key: "style",
      value: wardrobe.length ? String(wardrobe.length) : null,
      caption: wardrobe.length ? "items catalogued" : "Nothing catalogued yet",
      alert: false,
    },
    look: {
      key: "look",
      value: null,
      caption: "Hair, beard and grooming plans",
      alert: false,
    },
    photo: {
      key: "photo",
      value: null,
      caption: "Build a shot list before you shoot",
      alert: false,
    },
    confidence: {
      key: "confidence",
      value: actions.length ? String(actions.length) : null,
      caption: actions.length ? "things to work on" : "Nothing open",
      alert: false,
    },
    timeline: {
      key: "timeline",
      value: (timelineRows ?? []).length ? String((timelineRows ?? []).length) : null,
      caption: (timelineRows ?? []).length ? "moments recorded" : "Nothing recorded yet",
      alert: false,
    },
  };

  return {
    ageConfirmed: Boolean(profileRow?.glowup_age_confirmed_at),
    profile,
    wardrobe,
    actions,
    timeline: (timelineRows ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      detail: r.detail,
      occurredAt: r.occurred_at,
    })),
    reportCount: reportCount ?? 0,
    looksCount: looksCount ?? 0,
    studios,
    nextStep: buildNextStep(profile, wardrobe.length, actions.length),
    wardrobeStats: {
      total: wardrobe.length,
      neverWornCount: neverWorn(wardrobe).length,
      bestValue: priced[0] ?? null,
    },
  };
}

/**
 * The most useful thing to do next.
 *
 * Ordered by what unlocks the most: without a direction nothing can be tailored,
 * without a wardrobe nothing can be planned. Returns null rather than inventing
 * a task when there is genuinely nothing outstanding.
 */
function buildNextStep(
  profile: StyleProfile | null,
  itemCount: number,
  actionCount: number,
): ElevateState["nextStep"] {
  if (!profile) {
    return {
      text: "Set your direction and what you're getting ready for — everything else follows from it",
      href: "/elevate/profile",
    };
  }
  if (itemCount === 0) {
    return {
      text: "Add a few clothes you already own so outfits can be planned from them",
      href: "/elevate/style",
    };
  }
  if (itemCount < 6) {
    return {
      text: `${itemCount} items catalogued — a few more and the outfit planner has something to work with`,
      href: "/elevate/style",
    };
  }
  if (actionCount > 0) return null;
  return null;
}
