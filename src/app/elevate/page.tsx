import { createClient } from "@/lib/supabase/server";
import { ElevateCommand } from "@/components/elevate-command";
import { loadElevateOs } from "@/lib/elevateOs";
import { AgeGate } from "./age-gate";
import { AppShell } from "@/components/ui";
import { SectionHeader } from "@/components/section-header";
import { logReport } from "@/lib/timing";

export const dynamic = "force-dynamic";

export default async function ElevatePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const os = await loadElevateOs(supabase, user!.id);
  logReport("elevate.command");

  // The dating-profile use case makes this 18+. The gate sits in front of the
  // whole section rather than being a checkbox further in — including in front
  // of the command centre, which would otherwise be the way around it.
  if (!os.state.ageConfirmed) {
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

  return <ElevateCommand os={os} />;
}
