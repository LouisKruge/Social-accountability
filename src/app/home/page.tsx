import { createClient } from "@/lib/supabase/server";
import { BriefingHome } from "@/components/briefing-home";
import { loadBriefing } from "@/lib/briefing";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <BriefingHome briefing={await loadBriefing(supabase, user!.id, profile?.display_name)} />
  );
}
