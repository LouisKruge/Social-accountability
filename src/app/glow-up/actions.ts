"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GateState = { error?: string };

/** Records the 18+ confirmation against the account. */
export async function confirmAge(_prev: GateState, _formData: FormData): Promise<GateState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ glowup_age_confirmed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: "We couldn't save that. Try again." };

  revalidatePath("/glow-up");
  return {};
}

/**
 * POPIA erase for this feature: removes the report/photo rows and the storage
 * objects behind them. The RPC returns the paths so the objects themselves are
 * deleted too, not just the rows pointing at them.
 */
export async function deleteGlowupData() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: paths, error } = await supabase.rpc("delete_my_glowup_data");
  if (error) redirect("/profile?glowup_delete=failed");

  const toRemove = (paths ?? [])
    .map((p: { deleted_path: string } | string) =>
      typeof p === "string" ? p : p.deleted_path,
    )
    .filter(Boolean);

  if (toRemove.length > 0) {
    // Storage objects are owner-scoped by policy, so the user's own session is
    // sufficient — no service role needed to erase their own photos.
    await supabase.storage.from("glowup").remove(toRemove);
  }

  revalidatePath("/glow-up");
  revalidatePath("/profile");
  redirect("/profile?glowup_delete=ok");
}
