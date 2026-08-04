import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, EmptyState, Header, LinkButton } from "@/components/ui";
import { DashSection } from "@/components/dash";
import { DisputeCard, longDate } from "@/components/treasury-ui";
import { loadTreasury } from "@/lib/treasuryAccount";
import { DISPUTE_WINDOW_DAYS } from "@/lib/treasury";

export const dynamic = "force-dynamic";

/**
 * DISPUTES.
 *
 * Sixty days, because a bank statement is monthly and somebody may not notice
 * until the one after. This screen lists what is still challengeable rather
 * than waiting to be asked — a right nobody can find is a right on paper.
 */
export default async function DisputesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treasury = await loadTreasury(supabase, user!.id);
  const open = treasury.disputes.filter(
    (d) => d.state === "open" || d.state === "evidence" || d.state === "review",
  );
  const closed = treasury.disputes.filter((d) => !open.includes(d));

  return (
    <AppShell>
      <Header
        title="Disputes"
        back="/commit/wallet"
        subtitle={`You have ${DISPUTE_WINDOW_DAYS} days after a settlement to say it was wrong.`}
      />

      {treasury.disputes.length === 0 && (
        <div className="mb-chapter">
          <EmptyState
            title="Nothing disputed"
            body="If a day was not counted, a payout never arrived, or a challenge settled in a way you can't reconcile, open a dispute. A person reads every one."
          />
        </div>
      )}

      {open.length > 0 && (
        <DashSection title="Open">
          <ul>
            {open.map((d) => (
              <DisputeCard key={d.id} d={d} />
            ))}
          </ul>
        </DashSection>
      )}

      {closed.length > 0 && (
        <DashSection title="Closed">
          <ul>
            {closed.map((d) => (
              <DisputeCard key={d.id} d={d} />
            ))}
          </ul>
        </DashSection>
      )}

      {treasury.disputable.length > 0 && (
        <DashSection title="Still inside the window">
          <ul className="border-t border-scree/60">
            {treasury.disputable.map((s) => (
              <li
                key={`${s.cohortId}-${s.settledOn}`}
                className="flex items-baseline justify-between gap-3 border-b border-scree/40 py-3 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-body text-snow">{s.name}</span>
                <span className="shrink-0 text-caption text-sage">{longDate(s.settledOn)}</span>
              </li>
            ))}
          </ul>
        </DashSection>
      )}

      <div className="mb-6">
        <LinkButton href="/commit/wallet/disputes/new" variant="secondary">
          Open a dispute
        </LinkButton>
      </div>

      <p className="text-meta text-sage/80">
        Opening a dispute costs nothing and does not affect your Discipline Score, your standing, or
        how any future challenge treats you.{" "}
        <Link href="/commit/trust" className="text-sage underline decoration-scree underline-offset-4">
          The trust centre
        </Link>{" "}
        shows the evidence behind every decision, which is usually the fastest way to see what
        happened.
      </p>
    </AppShell>
  );
}
