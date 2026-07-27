import { createClient } from "@/lib/supabase/server";
import { StudioPage } from "@/components/elevate-shell";
import { loadElevate } from "@/lib/elevate";
import { PhotoView } from "./photo-view";
import type { PhotoGoal } from "@/lib/photoCoach";

export const dynamic = "force-dynamic";

/** Map the style profile's goal onto the photo goals it makes sense for. */
const GOAL_MAP: Record<string, PhotoGoal> = {
  interview: "interview",
  professional: "professional",
  networking: "professional",
  dating_profile: "dating_profile",
  content_creator: "content_creator",
};

export default async function PhotoStudioPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadElevate(supabase, user!.id);

  return (
    <StudioPage state={state} studioKey="photo">
      <PhotoView
        defaultGoal={
          (state.profile && GOAL_MAP[state.profile.goalMode]) ?? "general_confidence"
        }
      />
    </StudioPage>
  );
}
