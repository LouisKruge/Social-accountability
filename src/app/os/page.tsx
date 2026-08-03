import { createClient } from "@/lib/supabase/server";
import { LifeOsView } from "@/components/life-os";
import { loadLifeOs } from "@/lib/lifeOs";
import { logReport } from "@/lib/timing";

export const dynamic = "force-dynamic";

export default async function LifeOsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const os = await loadLifeOs(supabase, user!.id);
  logReport("life-os");

  return <LifeOsView os={os} />;
}
