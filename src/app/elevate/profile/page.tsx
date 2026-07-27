import { createClient } from "@/lib/supabase/server";
import { AppShell, Header } from "@/components/ui";
import { loadElevate } from "@/lib/elevate";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function StyleProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const state = await loadElevate(supabase, user!.id);

  return (
    <AppShell>
      <Header
        title="Your direction"
        back="/elevate"
        subtitle="Five questions. Everything Elevate suggests is tuned to these answers, and you can change them any time."
      />
      <ProfileForm existing={state.profile} />
    </AppShell>
  );
}
