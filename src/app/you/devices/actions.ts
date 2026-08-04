"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Disconnect a device.
 *
 * Deliberately a plain RLS-bound DELETE rather than an admin call. The delete
 * policy on `wearable_connections` is `user_id = auth.uid()`, so an id from a
 * form cannot reach another account's row — and the tokens go with it by
 * cascade, which is asserted in the SQL suite rather than assumed.
 *
 * The verified days stay. Deleting them would rewrite challenges that have
 * already settled, which is a worse outcome than a settled record mentioning a
 * device the person no longer uses.
 */
export async function disconnectDevice(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("wearable_connections").delete().eq("id", id);
  revalidatePath("/you/devices");
}
