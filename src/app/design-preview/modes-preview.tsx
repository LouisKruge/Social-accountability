import { AppShell, Card, Badge } from "@/components/ui";
import { SectionHeader } from "@/components/section-header";
import { Pool, PoolSummary } from "@/components/pool";
import { PayoutReceipt } from "@/components/payout-receipt";

/** Commit, at rest — precise, receipt-like, gold withheld. */
export function CommitPreview() {
  return (
    <AppShell>
      <SectionHeader
        eyebrow="Bet on yourself"
        title="Commit"
        blurb="Put money on a target. Hit it and you share the pool with everyone else who did."
        accent="ice"
      />
      <section className="mb-8">
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Open to join</h2>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-medium text-snow">30-day steps</p>
              <p className="mt-1 text-xs text-sage">300 000 steps · 30 days</p>
            </div>
            <Badge tone="muted">R100 stake</Badge>
          </div>
          <div className="mt-4">
            <PoolSummary filled={1100} capacity={2000} participants={11} stakeAmount={100} />
          </div>
        </Card>
      </section>
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Last round</h2>
        <PayoutReceipt
          totalPool={2000} feeRate={0.1} platformFee={200} distributablePool={1800}
          winnerCount={12} participantCount={20} yourAmount={150} outcome="mixed" status="paid"
        />
      </section>
    </AppShell>
  );
}

/** Elevate, at rest — quiet, lighter surfaces, no competitive numbers. */
export function ElevatePreview() {
  return (
    <AppShell>
      <SectionHeader
        eyebrow="Coaching"
        title="Elevate"
        blurb="A private review of your own photos — lighting, grooming, styling and how you're framing yourself."
        accent="snow"
      />
      <p className="mb-7 text-sm leading-relaxed text-sage">
        Prepared for you, one part at a time. Take it in whatever order suits you.
      </p>
      <section className="mb-6">
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Your photos</h2>
        <Card className="!bg-ridge">
          <ol className="space-y-4">
            {[
              "Shoot facing a window at mid-morning — the current shot is lit from above, which casts shadows under the eyes.",
              "Step about a metre off the wall so the background falls out of focus.",
            ].map((t) => (
              <li key={t} className="flex gap-3.5">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ice/70" />
                <span className="text-sm leading-relaxed text-snow/90">{t}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>
      <div className="mt-7 space-y-2.5">
        <span className="block w-full rounded-field bg-ridge px-4 py-3.5 text-center text-sm font-medium text-snow ring-1 ring-scree">
          Next: Grooming
        </span>
        <span className="block w-full px-4 py-2 text-center text-xs text-sage">Show everything</span>
        <p className="pt-1 text-center text-xs text-sage/70">1 of 5</p>
      </div>
    </AppShell>
  );
}
