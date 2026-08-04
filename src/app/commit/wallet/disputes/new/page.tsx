import { createClient } from "@/lib/supabase/server";
import { AppShell, EmptyState, Header } from "@/components/ui";
import { longDate } from "@/components/treasury-ui";
import { loadTreasury } from "@/lib/treasuryAccount";
import { DISPUTE_WINDOW_DAYS } from "@/lib/treasury";
import { zar } from "@/lib/format";
import { DisputeForm, type Subject } from "./dispute-form";

export const dynamic = "force-dynamic";

export default async function NewDisputePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treasury = await loadTreasury(supabase, user!.id);

  // Only things that exist on this account, and only settlements still inside
  // the window. Offering a subject that can no longer be disputed sets somebody
  // up to write a paragraph and then be told they were too late.
  const subjects: Subject[] = [
    ...treasury.disputable.map((s) => ({
      kind: "cohort" as const,
      id: s.cohortId,
      label: s.name,
      detail: `Settled ${longDate(s.settledOn)}`,
    })),
    ...treasury.deposits.map((d) => ({
      kind: "deposit" as const,
      id: d.id,
      label: `Payment in — ${zar(d.amount)}`,
      detail: `${d.label} · ${d.reference}`,
    })),
    ...treasury.withdrawals.map((w) => ({
      kind: "withdrawal" as const,
      id: w.id,
      label: `Payment out — ${zar(w.amount)}`,
      detail: `${w.label} · ${longDate(w.requestedAt)}`,
    })),
  ];

  return (
    <AppShell>
      <Header
        title="Open a dispute"
        back="/commit/wallet/disputes"
        subtitle={`Anything settled in the last ${DISPUTE_WINDOW_DAYS} days can be challenged.`}
      />

      {subjects.length === 0 ? (
        <EmptyState
          title="Nothing to dispute yet"
          body="There are no settlements, payments in or payments out on this account. Once there are, each one can be challenged for sixty days."
        />
      ) : (
        <DisputeForm subjects={subjects} />
      )}

      <p className="mt-block text-meta text-sage/80">
        A person reads every dispute. If it is upheld, the adjustment appears on your ledger with
        the reason attached; if it is declined, you get the reasoning rather than a verdict.
      </p>
    </AppShell>
  );
}
