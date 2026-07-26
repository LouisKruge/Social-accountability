import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header } from "@/components/ui";
import { NewReportForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewReportPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("glowup_age_confirmed_at")
    .eq("id", user!.id)
    .maybeSingle();

  // 18+ gate is enforced in front of the whole feature.
  if (!profile?.glowup_age_confirmed_at) redirect("/glow-up");

  return (
    <AppShell>
      <Header
        title="Start a report"
        back="/glow-up"
        subtitle="Three questions, then a couple of photos of yourself."
      />
      <NewReportForm />
    </AppShell>
  );
}
