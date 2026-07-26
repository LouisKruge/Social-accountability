"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type NewReportState = { error?: string };

const GOALS = ["dating_profile", "job_interview", "general_confidence"] as const;
const TIERS = ["low", "mid", "high"] as const;

/**
 * Creates the report shell. Photos are uploaded straight from the browser to a
 * PRIVATE bucket under `<uid>/<reportId>/…`, so the file bytes never pass
 * through this server and storage policies pin them to the owner.
 *
 * Consent is required here and recorded on the profile: the photos must be of
 * the account holder. There is deliberately no path in this flow that accepts
 * anybody else's photo — no "upload a friend", no second subject, no matching.
 */
export async function createReport(
  _prev: NewReportState,
  formData: FormData,
): Promise<NewReportState> {
  const goal = String(formData.get("goal") ?? "");
  const budget = String(formData.get("budget_tier") ?? "");
  const style = String(formData.get("style_preference") ?? "").trim() || null;
  const consent = formData.get("consent") === "on";

  if (!GOALS.includes(goal as (typeof GOALS)[number])) return { error: "Pick what this is for." };
  if (!TIERS.includes(budget as (typeof TIERS)[number])) return { error: "Pick a budget range." };
  if (!consent) {
    return { error: "You need to confirm the photos are of you before we can continue." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The 18+ gate lives in front of this section; re-check server-side so the
  // flow cannot be entered by posting straight to this action.
  const { data: profile } = await supabase
    .from("profiles")
    .select("glowup_age_confirmed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.glowup_age_confirmed_at) {
    return { error: "Confirm you're 18 or older first." };
  }

  await supabase
    .from("profiles")
    .update({ glowup_consent_at: new Date().toISOString() })
    .eq("id", user.id);

  const { data: report, error } = await supabase
    .from("glowup_reports")
    .insert({
      user_id: user.id,
      goal: goal as (typeof GOALS)[number],
      budget_tier: budget as (typeof TIERS)[number],
      style_preference: style,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !report) return { error: "We couldn't start that report. Try again." };

  revalidatePath("/elevate");
  redirect(`/elevate/${report.id}/upload`);
}

/** Records an uploaded photo against the report, after the browser has stored it. */
export async function registerPhoto(formData: FormData) {
  const reportId = String(formData.get("report_id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");
  const photoType = String(formData.get("photo_type") ?? "face");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The path must sit inside this user's own folder — belt and braces on top of
  // the storage policy.
  if (!storagePath.startsWith(`${user.id}/`)) return;

  await supabase.from("glowup_photos").insert({
    user_id: user.id,
    report_id: reportId,
    storage_path: storagePath,
    photo_type: photoType === "outfit" ? "outfit" : "face",
  });

  revalidatePath(`/elevate/${reportId}/upload`);
}
