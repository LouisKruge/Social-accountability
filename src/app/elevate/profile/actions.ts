"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { error?: string; ok?: boolean };

const DIRECTIONS = [
  "minimal", "classic", "streetwear", "business", "athleisure",
  "smart_casual", "creative", "outdoor", "formal",
];
const GOALS = [
  "interview", "professional", "dating_profile", "wedding", "vacation",
  "general_confidence", "content_creator", "university", "networking",
];

/**
 * Save the style profile.
 *
 * The direction is chosen BY the user, never inferred from a photo. Telling
 * somebody what their style "is" from a picture of them is a judgement dressed
 * as a feature, and it is the wrong footing for a coaching product.
 */
export async function saveStyleProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const direction = String(formData.get("direction") ?? "");
  const goal_mode = String(formData.get("goal_mode") ?? "");
  const budget_tier = String(formData.get("budget_tier") ?? "mid");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  const avoidRaw = String(formData.get("avoid") ?? "").trim();

  if (!DIRECTIONS.includes(direction)) return { error: "Pick a direction." };
  if (!GOALS.includes(goal_mode)) return { error: "Pick what you're getting ready for." };
  if (!["low", "mid", "high"].includes(budget_tier)) return { error: "Pick a budget." };

  const avoid = avoidRaw
    ? avoidRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20)
    : [];

  const { error } = await supabase.from("style_profiles").upsert(
    {
      user_id: user.id,
      direction,
      goal_mode,
      budget_tier: budget_tier as "low" | "mid" | "high",
      notes: notes || null,
      avoid,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "We couldn't save that. Try again." };

  await supabase.from("timeline_entries").insert({
    user_id: user.id,
    kind: "goal_changed",
    title: `Getting ready for: ${goal_mode.replace(/_/g, " ")}`,
    detail: `Direction set to ${direction.replace(/_/g, " ")}.`,
  });

  revalidatePath("/elevate");
  redirect("/elevate");
}
