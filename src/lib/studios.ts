/**
 * Elevate's studio definitions and labels.
 *
 * Client-safe by design — see the note in src/lib/modules.ts. The profile form
 * is a client component and needs these labels; the loader beside them is not
 * something a browser should ever be handed.
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
  { key: "style", href: "/elevate/style", name: "Style Studio", question: "What do I wear?" },
  { key: "look", href: "/elevate/look", name: "Look Lab", question: "What do I ask the barber for?" },
  { key: "photo", href: "/elevate/photo", name: "Photo Coach", question: "How do I take this shot?" },
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

/** A style profile, as the forms and the loader both see it. */
export interface StyleProfile {
  direction: string;
  goalMode: string;
  budgetTier: "low" | "mid" | "high";
  notes: string | null;
  avoid: string[];
}
