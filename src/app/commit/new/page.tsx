import { AppShell, Header } from "@/components/ui";
import { CreateCohortForm } from "./create-form";

export const dynamic = "force-dynamic";

export default function NewCohortPage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <Header
        title="Start a challenge"
        back="/commit"
        subtitle="Set the target and the stake. Anyone you share it with can put money on themselves."
      />
      <CreateCohortForm today={today} />
    </AppShell>
  );
}
