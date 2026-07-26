"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runGlowupReport } from "@/lib/glowupRunner";

/**
 * Kicks off generation for a report the caller owns. Ownership is checked with
 * the RLS-bound client BEFORE the service-role runner touches anything.
 */
export async function generateReport(formData: FormData) {
  const reportId = String(formData.get("report_id") ?? "");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: owned } = await supabase
    .from("glowup_reports")
    .select("id")
    .eq("id", reportId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owned) redirect("/glow-up");

  const result = await runGlowupReport(reportId);

  revalidatePath(`/glow-up/${reportId}`);
  revalidatePath("/glow-up");

  if (!result.ok) {
    const code = result.error.includes("isn't configured") ? "not_configured" : "failed";
    redirect(`/glow-up/${reportId}/upload?error=${code}`);
  }

  redirect(`/glow-up/${reportId}`);
}
