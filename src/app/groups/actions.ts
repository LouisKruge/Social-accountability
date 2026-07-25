"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canCreateGroup } from "@/lib/entitlements";

export type ActionState = { error?: string };

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give your group a name." };

  const { supabase, user } = await requireUser();

  const gate = await canCreateGroup(supabase, user.id);
  if (!gate.allowed) return { error: gate.reason };

  const { data, error } = await supabase
    .from("groups")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}

export async function joinGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("invite_code") ?? "").trim().toLowerCase();
  if (!code) return { error: "Enter an invite code." };

  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("join_group_by_code", { _code: code });

  if (error) {
    if (error.message.includes("invalid_invite_code")) {
      return { error: "That invite code doesn’t match any group. Double-check it." };
    }
    return { error: error.message };
  }

  revalidatePath("/groups");
  redirect(`/groups/${data}`);
}

export async function leaveGroup(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  // Owner-leave is blocked by a DB trigger; surface nothing fancy here.
  if (!error) revalidatePath("/groups");
  redirect("/groups");
}
