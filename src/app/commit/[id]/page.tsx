import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header, Card, Badge, EmptyState } from "@/components/ui";
import { JoinForm, LogStepsForm } from "./join-form";

export const dynamic = "force-dynamic";

const fmtZar = (n: number) => `R${n.toLocaleString("en-ZA")}`;
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

export default async function CohortPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: cohort } = await supabase
    .from("stake_cohorts")
    .select("id, name, target_value, start_date, end_date, stake_amount, fee_rate, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!cohort) notFound();

  // Owner-only: nobody else can read this row, and we never render it for others.
  const { data: myStake } = await supabase
    .from("stakes")
    .select("id, amount, payment_reference, payment_confirmed")
    .eq("cohort_id", cohort.id)
    .eq("user_id", user!.id)
    .maybeSingle();

  // Safe derived board — progress and rank only, never money.
  const { data: board } = myStake
    ? await supabase.rpc("cohort_progress", { _cohort_id: cohort.id })
    : { data: null };

  const rows = board ?? [];
  const me = rows.find((r) => r.user_id === user!.id);
  const target = Number(cohort.target_value);
  const today = new Date().toISOString().slice(0, 10);

  const { data: todayLog } = myStake
    ? await supabase
        .from("daily_verification_logs")
        .select("verified_value")
        .eq("stake_id", myStake.id)
        .eq("log_date", today)
        .maybeSingle()
    : { data: null };

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(cohort.end_date).getTime() - Date.now()) / 86_400_000),
  );
  const pct = me ? Math.min(100, (Number(me.current_progress) / target) * 100) : 0;

  return (
    <AppShell>
      <Header
        title={cohort.name}
        back="/commit"
        subtitle={`${fmtDate(cohort.start_date)} – ${fmtDate(cohort.end_date)} · ${Number(cohort.target_value).toLocaleString("en-ZA")} steps`}
      />

      {/* ── The terms, stated plainly before anyone commits money ─────────── */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-caption uppercase tracking-[0.16em] text-sage">Stake</p>
            <p className="tnum mt-1 font-display text-xl text-summit">
              {fmtZar(Number(cohort.stake_amount))}
            </p>
          </div>
          <div>
            <p className="text-caption uppercase tracking-[0.16em] text-sage">Target</p>
            <p className="tnum mt-1 font-display text-xl text-snow">
              {Number(cohort.target_value).toLocaleString("en-ZA")}
            </p>
          </div>
        </div>
        <p className="mt-4 text-meta text-sage">
          Hit the target by {fmtDate(cohort.end_date)} and you share the pool with everyone else who
          did, after a {Math.round(Number(cohort.fee_rate) * 100)}% platform fee. Miss it and your
          stake goes to those who made it. If nobody hits it, everyone gets a full refund and no fee
          is charged.
        </p>
      </Card>

      {!myStake ? (
        cohort.status === "open" ? (
          <section className="mb-8">
            <h2 className="mb-3 text-micro uppercase text-sage">Join this one</h2>
            <Card>
              <JoinForm cohortId={cohort.id} stakeAmount={Number(cohort.stake_amount)} />
            </Card>
          </section>
        ) : (
          <EmptyState
            title="This challenge has closed"
            body="It's already under way, so no new stakes can be added. Check the open list for the next one."
          />
        )
      ) : (
        <>
          {/* ── Your progress ────────────────────────────────────────────── */}
          <section className="relative mb-6 overflow-hidden rounded-card bg-slope p-5 ring-1 ring-scree/70">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-20 h-32 bg-[radial-gradient(ellipse_at_top,rgb(var(--glow-summit)/0.14),transparent_70%)]"
            />
            <div className="relative">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-caption uppercase tracking-[0.16em] text-sage">Your total</p>
                  <p className="tnum mt-1 font-display text-4xl font-semibold tracking-tightest text-snow">
                    {me ? Number(me.current_progress).toLocaleString("en-ZA") : "0"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-sage">{daysLeft} days left</p>
                  {me?.hit_target && (
                    <p className="mt-1">
                      <Badge tone="summit">Target hit</Badge>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-valley">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ice-deep via-ice to-summit"
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              <p className="mt-2 flex justify-between text-xs text-sage">
                <span className="tnum">{Math.round(pct)}%</span>
                <span className="tnum">
                  {me && Number(me.current_progress) < target
                    ? `${(target - Number(me.current_progress)).toLocaleString("en-ZA")} to go`
                    : "target reached"}
                </span>
              </p>
            </div>
          </section>

          {/* ── Your stake: private to you ───────────────────────────────── */}
          <Card className="mb-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-snow">Your stake</p>
                <p className="tnum mt-1 text-sm text-summit">{fmtZar(Number(myStake.amount))}</p>
              </div>
              <Badge tone={myStake.payment_confirmed ? "summit" : "muted"}>
                {myStake.payment_confirmed ? "Confirmed" : "Awaiting EFT"}
              </Badge>
            </div>
            {!myStake.payment_confirmed && (
              <div className="mt-4 rounded-field bg-valley p-4 ring-1 ring-scree">
                <p className="text-meta text-sage">
                  EFT {fmtZar(Number(myStake.amount))} using this reference so we can match it to
                  you. We&apos;ll mark it confirmed by hand once it lands.
                </p>
                <p className="tnum mt-2 text-sm text-snow">{myStake.payment_reference}</p>
              </div>
            )}
            <p className="mt-3 text-xs text-sage">
              Only you can see your stake amount and reference.
            </p>
          </Card>

          <div className="mb-6">
            <LogStepsForm
              cohortId={cohort.id}
              stakeId={myStake.id}
              today={today}
              existing={todayLog ? Number(todayLog.verified_value) : null}
            />
          </div>

          {/* ── The cohort board: progress and rank only ─────────────────── */}
          <section>
            <h2 className="mb-3 text-micro uppercase text-sage">The cohort</h2>
            {rows.length === 0 ? (
              <EmptyState title="Nobody's logged yet" body="Be the first to put steps on the board." />
            ) : (
              <ol className="space-y-1.5">
                {rows.map((r) => {
                  const isMe = r.user_id === user!.id;
                  const lead = Number(r.rank) === 1;
                  return (
                    <li
                      key={r.user_id}
                      className={[
                        "relative flex items-center gap-3 overflow-hidden rounded-card px-4 py-3.5",
                        lead ? "bg-slope shadow-crest ring-1 ring-summit/25" : "bg-slope/60",
                      ].join(" ")}
                    >
                      {isMe && (
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-ice"
                        />
                      )}
                      <span
                        className={`tnum w-6 shrink-0 text-center text-sm ${lead ? "text-summit" : "text-sage"}`}
                      >
                        {r.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-snow/90">
                        {r.display_name}
                        {isMe && <span className="text-sage"> · you</span>}
                      </span>
                      {r.hit_target && <Badge tone="summit">Hit</Badge>}
                      <span className="tnum w-20 shrink-0 text-right text-sm text-snow">
                        {Number(r.current_progress).toLocaleString("en-ZA")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-4 text-center text-meta text-sage/80">
              You can see everyone&apos;s progress, never their stake. Nobody can see yours.
            </p>
          </section>
        </>
      )}
    </AppShell>
  );
}
