"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { error?: string; success?: string };

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone_number") ?? "").trim();
  const notifyWhatsapp = formData.get("notify_whatsapp") === "on";

  if (!displayName) return { error: "Your name can’t be empty." };

  // Light phone validation for SA/international numbers (E.164-ish).
  const phone = phoneRaw.replace(/[\s-]/g, "");
  if (phone && !/^\+?\d{7,15}$/.test(phone)) {
    return { error: "Enter a valid phone number, e.g. +2782 123 4567." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      phone_number: phone || null,
      notify_whatsapp: notifyWhatsapp,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { success: "Profile saved." };
}

/**
 * POPIA-aligned self-service deletion. `delete_my_account()` removes the auth
 * user; every data table cascades from auth.users / profiles.
 */
export async function deleteAccount() {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    // Surface via query param on the profile page.
    redirect("/profile?delete_error=1");
  }
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
