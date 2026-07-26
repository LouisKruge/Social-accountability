import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Card, Badge, EmptyState } from "@/components/ui";
import { SectionHeader } from "@/components/section-header";

export const dynamic = "force-dynamic";

function fmtZar(n: number) {
  return `R${n.toLocaleString("en-ZA")}`;
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

/**
 * STAKES — section landing.
 *
 * Shows the challenges you're in (with your own progress) and the ones open to
 * join. Your stake amount is yours alone: it is fetched from `stakes`, which is
 * owner-only under RLS, and never rendered for anybody else.
 */
export default async function ChallengesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myStakes } = await supabase
    .from("stakes")
    .select("id, amount, payment_confirmed, cohort_id")
    .eq("user_id", user!.id);

  const myCohortIds = (myStakes ?? []).map((s) => s.cohort_id);

  const { data: cohorts } = await supabase
    .from("stake_cohorts")
    .select("id, name, target_value, start_date, end_date, stake_amount, fee_rate, status")
    .in("status", ["open", "active"])
    .order("start_date", { ascending: true });

  const mine = (cohorts ?? []).filter((c) => myCohortIds.includes(c.id));
  const open = (cohorts ?? []).filter((c) => !myCohortIds.includes(c.id) && c.status === "open");

  // Progress for the cohorts I'm in, via the safe derived view.
  const progressByCohort = new Map<string, { progress: number; target: number; rank: number }>();
  for (const c of mine) {
    const { data } = await supabase.rpc("cohort_progress", { _cohort_id: c.id });
    const row = (data ?? []).find((r: { user_id: string }) => r.user_id === user!.id);
    if (row) {
      progressByCohort.set(c.id, {
        progress: Number(row.current_progress),
        target: Number(row.target_value),
        rank: Number(row.rank),
      });
    }
  }

  return (
    <AppShell>
      <SectionHeader
        eyebrow="Bet on yourself"
        title="Stakes"
        blurb="Put money on a target. Hit it and you share the pool with everyone else who did."
        accent="summit"
      />

      <section className="mb-8">
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Your challenges</h2>
        {mine.length === 0 ? (
          <EmptyState
            title="You haven't staked yet"
            body="Pick a challenge below, put an amount on it, and your money rides on your own step count."
          />
        ) : (
          <div className="space-y-2.5">
            {mine.map((c) => {
              const p = progressByCohort.get(c.id);
              const pct = p ? Math.min(100, (p.progress / p.target) * 100) : 0;
              const stake = myStakes?.find((s) => s.cohort_id === c.id);
              return (
                <Link key={c.id} href={`/challenges/${c.id}`} className="block">
                  <Card className="transition hover:bg-ridge">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-base font-medium text-snow">{c.name}</p>
                        <p className="mt-1 text-xs text-sage">
                          Ends {new Date(c.end_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                          {p ? ` · #${p.rank} in cohort` : ""}
                        </p>
                      </div>
                      {stake && (
                        <Badge tone={stake.payment_confirmed ? "summit" : "muted"}>
                          {stake.payment_confirmed ? fmtZar(Number(stake.amount)) : "Unconfirmed"}
                        </Badge>
                      )}
                    </div>

                    {/* progress toward the target */}
                    <div className="mt-4">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-valley">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-ice-deep via-ice to-summit"
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                      <p className="mt-2 flex justify-between text-xs">
                        <span className="tnum text-snow/90">
                          {p ? p.progress.toLocaleString("en-ZA") : 0}
                        </span>
                        <span className="tnum text-sage">
                          {Number(c.target_value).toLocaleString("en-ZA")} target
                        </span>
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Open to join</h2>
        {open.length === 0 ? (
          <EmptyState
            title="Nothing open right now"
            body="New challenges open regularly. Check back, or start one from a group you own."
          />
        ) : (
          <div className="space-y-2.5">
            {open.map((c) => (
              <Link key={c.id} href={`/challenges/${c.id}`} className="block">
                <Card className="transition hover:bg-ridge">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-medium text-snow">{c.name}</p>
                      <p className="mt-1 text-xs text-sage">
                        {Number(c.target_value).toLocaleString("en-ZA")} steps ·{" "}
                        {daysBetween(c.start_date, c.end_date)} days
                      </p>
                    </div>
                    <Badge tone="summit">{fmtZar(Number(c.stake_amount))}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-xs leading-relaxed text-sage/80">
        Winners are decided by your own verified steps — never by chance. Stakes are collected and
        paid out by manual EFT while this is in beta.
      </p>
    </AppShell>
  );
}
