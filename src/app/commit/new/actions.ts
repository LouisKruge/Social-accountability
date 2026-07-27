"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toCohortDraft, validateCohort, type CohortErrors } from "@/lib/cohort";

export type CreateCohortState = { errors?: CohortErrors; formError?: string };

/**
 * Create a challenge.
 *
 * Creating one commits no money: it publishes terms other people can choose to
 * stake against. The creator joins the same way everybody else does, through
 * joinCohort, and gets no advantage for having made it.
 *
 * `created_by` is set from the session, never from the form — the
 * cohorts_insert_own policy would reject anything else, but sending it at all
 * would be inviting a forgery attempt.
 */
export async function createCohort(
  _prev: CreateCohortState,
  formData: FormData,
): Promise<CreateCohortState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const input = {
    name: String(formData.get("name") ?? ""),
    targetValue: Number(formData.get("target_value")),
    days: Number(formData.get("days")),
    stakeAmount: Number(formData.get("stake_amount")),
    startDate: String(formData.get("start_date") ?? ""),
  };

  const today = new Date().toISOString().slice(0, 10);
  const errors = validateCohort(input, today);
  if (Object.keys(errors).length > 0) return { errors };

  const { data, error } = await supabase
    .from("stake_cohorts")
    .insert({ ...toCohortDraft(input), created_by: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { formError: "We couldn't create that challenge. Check the details and try again." };
  }

  revalidatePath("/commit");
  redirect(`/commit/${data.id}`);
}
