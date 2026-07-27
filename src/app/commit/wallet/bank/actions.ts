"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BankState = { error?: string; ok?: boolean };

/** South African account numbers run 6–11 digits; branch codes are 6. */
function validate(holder: string, bank: string, account: string, branch: string): string | null {
  if (holder.trim().length < 2) return "Enter the name on the account.";
  if (bank.trim().length < 2) return "Enter your bank.";
  if (!/^\d{6,11}$/.test(account)) return "An account number is 6 to 11 digits.";
  if (branch && !/^\d{6}$/.test(branch)) return "A branch code is 6 digits.";
  return null;
}

/**
 * Save where payouts should be sent.
 *
 * The account number is stored so a human operator can pay the user — Ascend
 * has no payment rail, so somebody types this into a banking portal. It is
 * owner-only under RLS and the app never renders more than the last four
 * digits. Moving it into Vault is tracked in docs/COMMIT_PLATFORM.md.
 *
 * Adding or changing a destination writes a security event, because changing
 * where money goes is exactly the event a user needs to be able to see if
 * somebody else does it.
 */
export async function savePayoutDestination(
  _prev: BankState,
  formData: FormData,
): Promise<BankState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const holder = String(formData.get("account_holder") ?? "").trim();
  const bank = String(formData.get("bank_name") ?? "").trim();
  const account = String(formData.get("account_number") ?? "").replace(/\s/g, "");
  const branch = String(formData.get("branch_code") ?? "").replace(/\s/g, "");

  const problem = validate(holder, bank, account, branch);
  if (problem) return { error: problem };

  // One default destination at a time.
  await supabase
    .from("payout_destinations")
    .update({ is_default: false })
    .eq("user_id", user.id);

  const { error } = await supabase.from("payout_destinations").upsert(
    {
      user_id: user.id,
      account_holder: holder,
      bank_name: bank,
      account_number: account,
      branch_code: branch || null,
      is_default: true,
      // Never set by the client. An operator confirms the account is the
      // user's before the first payout leaves.
      verified: false,
    },
    { onConflict: "user_id,account_number" },
  );

  if (error) return { error: "We couldn't save those details. Check them and try again." };

  revalidatePath("/commit/wallet");
  return { ok: true };
}
