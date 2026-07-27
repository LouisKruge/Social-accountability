import { createClient } from "@/lib/supabase/server";
import { CommitDashboardView } from "@/components/commit-dashboard";
import { loadCommitDashboard } from "@/lib/commitDashboard";

export const dynamic = "force-dynamic";

export default async function CommitPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <CommitDashboardView data={await loadCommitDashboard(supabase, user!.id)} />;
}
