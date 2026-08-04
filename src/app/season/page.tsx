import { createClient } from "@/lib/supabase/server";
import { SeasonView } from "@/components/season-view";
import { loadLifeOs } from "@/lib/lifeOs";
import { logReport } from "@/lib/timing";

export const dynamic = "force-dynamic";

export default async function SeasonPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const os = await loadLifeOs(supabase, user!.id);
  logReport("season");

  return <SeasonView os={os} />;
}
