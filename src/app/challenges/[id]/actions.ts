"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StakeState = { error?: string };

/**
 * Build the reference the participant must use on their EFT, so the operator can
 * match the deposit against a bank statement by hand. Money movement is manual
 * by design while the escrow/custody question is under compliance review — the
 * app never initiates a collection or a payout.
 */
function paymentReference(cohortId: string, userId: string) {
  return `ASC-${cohortId.slice(0, 4)}-${userId.slice(0, 6)}`.toUpperCase();
}

/** Join a cohort by committing the stake it defines. */
export async function joinCohort(_prev: StakeState, formData: FormData): Promise<StakeState> {
  const cohortId = String(formData.get("cohort_id") ?? "");
  const agreed = formData.get("agree") === "on";
  if (!agreed) return { error: "Tick the box to confirm you understand the stake before joining." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cohort } = await supabase
    .from("stake_cohorts")
    .select("id, stake_amount, status")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort) return { error: "That challenge no longer exists." };
  if (cohort.status !== "open") return { error: "This challenge has already started." };

  const { error } = await supabase.from("stakes").insert({
    cohort_id: cohortId,
    user_id: user.id,
    amount: Number(cohort.stake_amount),
    payment_reference: paymentReference(cohortId, user.id),
    // Never set by the client — an operator confirms it once the EFT lands.
    payment_confirmed: false,
  });

  if (error) {
    if (error.code === "23505") return { error: "You're already in this challenge." };
    return { error: "We couldn't add you to this challenge. Try again." };
  }

  revalidatePath(`/challenges/${cohortId}`);
  revalidatePath("/challenges");
  return {};
}

/** Log today's step count against your own stake. */
export async function logSteps(_prev: StakeState, formData: FormData): Promise<StakeState> {
  const cohortId = String(formData.get("cohort_id") ?? "");
  const stakeId = String(formData.get("stake_id") ?? "");
  const raw = String(formData.get("steps") ?? "").trim();
  const dateRaw = String(formData.get("log_date") ?? "");

  const steps = Number(raw);
  if (raw === "" || Number.isNaN(steps)) return { error: "Enter your step count for the day." };
  if (steps < 0) return { error: "Steps can't be negative." };
  if (steps > 200_000) return { error: "That looks off — check the number and try again." };

  const logDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? dateRaw
    : new Date().toISOString().slice(0, 10);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS restricts this to a stake the caller owns, but check explicitly so a
  // wrong id gives a clear message instead of a silent no-op.
  const { data: stake } = await supabase
    .from("stakes")
    .select("id")
    .eq("id", stakeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!stake) return { error: "That's not your stake." };

  const { error } = await supabase
    .from("daily_verification_logs")
    .upsert(
      { stake_id: stakeId, log_date: logDate, verified_value: steps, source: "manual" },
      { onConflict: "stake_id,log_date" },
    );

  if (error) return { error: "We couldn't save that. Try again." };

  revalidatePath(`/challenges/${cohortId}`);
  return {};
}
