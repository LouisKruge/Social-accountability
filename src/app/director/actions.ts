"use server";

import { createClient } from "@/lib/supabase/server";
import { loadExchange } from "@/lib/exchange";
import { loadClimb } from "@/lib/climb";
import { direct, type DirectorPlan } from "@/lib/director";
import { todayIso } from "@/lib/events";

export interface DirectorFormState {
  plan?: DirectorPlan;
  problem?: string;
}

/**
 * Read one sentence and produce a cross-mode plan.
 *
 * The context comes from the real loaders, because the Commit proposal has to
 * know whether a position actually overlaps the date — proposing a target
 * change for a challenge that ends before the wedding is noise, and noise is
 * what makes people stop reading an assistant.
 */
export async function ask(
  _prev: DirectorFormState,
  formData: FormData,
): Promise<DirectorFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { problem: "You need to be signed in." };

  const text = String(formData.get("text") ?? "");

  const [commit, climb] = await Promise.all([
    loadExchange(supabase, user.id),
    loadClimb(supabase, user.id),
  ]);

  const plan = direct(
    { text, today: todayIso() },
    {
      positions: commit.positions.map((p) => ({
        cohortId: p.cohortId,
        name: p.name,
        exposure: p.exposure,
        daysRemaining: p.daysRemaining,
      })),
      hasRoutes: climb.routes.length > 0,
    },
  );

  return { plan, problem: plan.problem ?? undefined };
}
