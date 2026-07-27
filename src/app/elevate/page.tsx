import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ElevateHome } from "@/components/elevate-home";
import { loadElevate } from "@/lib/elevate";
import { AgeGate } from "./age-gate";
import { AppShell } from "@/components/ui";
import { SectionHeader } from "@/components/section-header";

export const dynamic = "force-dynamic";

export default async function ElevatePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const state = await loadElevate(supabase, user!.id);

  // The dating-profile use case makes this 18+. The gate sits in front of the
  // whole section rather than being a checkbox further in.
  if (!state.ageConfirmed) {
    return (
      <AppShell>
        <SectionHeader
          eyebrow="Private coaching"
          title="Elevate"
          blurb="Styling, grooming and photography guidance built around a goal you choose. Yours alone — never shared, never compared."
          accent="snow"
        />
        <AgeGate />
      </AppShell>
    );
  }

  return <ElevateHome state={state} />;
}
