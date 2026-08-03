import { createClient } from "@/lib/supabase/server";
import { ClimbFace } from "@/components/climb-face";
import { loadClimb } from "@/lib/climb";
import { logReport } from "@/lib/timing";

export const dynamic = "force-dynamic";

export default async function ClimbPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const state = await loadClimb(supabase, user!.id);
  logReport("climb.face");

  return <ClimbFace state={state} />;
}
