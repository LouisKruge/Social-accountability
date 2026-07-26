import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Brand } from "@/components/ui";
import { signOut } from "@/app/auth/actions";
import { currentPeriod } from "@/lib/period";

export const dynamic = "force-dynamic";

/**
 * THE HUB — Ascend is three apps under one roof, and this is where you choose
 * which one you are entering. Each card shows that track's own live state so
 * the choice is informed rather than blind.
 */
export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  const period = currentPeriod();

  // Each section's own summary. RLS scopes every one of these to this user.
  const [{ count: groupCount }, { data: myRanking }, { data: myStakes }, { data: openCohorts }, { data: reports }] =
    await Promise.all([
      supabase.from("group_members").select("id", { count: "exact", head: true }),
      supabase
        .from("leaderboard_rankings")
        .select("rank, pct_change")
        .eq("user_id", user!.id)
        .eq("period_start", period.start)
        .order("rank", { ascending: true })
        .limit(1),
      supabase.from("stakes").select("id, cohort_id").limit(5),
      supabase.from("stake_cohorts").select("id").eq("status", "open").limit(5),
      supabase
        .from("glowup_reports")
        .select("id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  const best = myRanking?.[0];
  const latestReport = reports?.[0];

  const cards = [
    {
      href: "/groups",
      eyebrow: "Self improvement",
      title: "Climb",
      body: "Private groups ranked on how fast you improve — savings, debt, steps, habits.",
      status:
        (groupCount ?? 0) === 0
          ? "No groups yet"
          : best
            ? `#${best.rank} this week · ${Number(best.pct_change) >= 0 ? "+" : ""}${best.pct_change}%`
            : `${groupCount} ${groupCount === 1 ? "group" : "groups"} · nothing logged yet`,
      accent: "text-ice",
      ring: "ring-ice/25",
      glow: "rgba(127,220,192,0.13)",
    },
    {
      href: "/challenges",
      eyebrow: "Bet on yourself",
      title: "Stakes",
      body: "Put money on a 30-day target. Hit it and you share the pool with the others who did.",
      status:
        (myStakes?.length ?? 0) > 0
          ? `${myStakes!.length} active ${myStakes!.length === 1 ? "challenge" : "challenges"}`
          : `${openCohorts?.length ?? 0} open to join`,
      accent: "text-summit",
      ring: "ring-summit/25",
      glow: "rgba(232,184,75,0.14)",
    },
    {
      href: "/glow-up",
      eyebrow: "Coaching",
      title: "Glow Up",
      body: "A private styling, grooming and photo review of your own photos, for a goal you set.",
      status: latestReport
        ? latestReport.status === "ready"
          ? "Your report is ready"
          : "Report in progress"
        : "No report yet",
      accent: "text-snow",
      ring: "ring-scree",
      glow: "rgba(243,241,234,0.08)",
    },
  ];

  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-4">
          <Link href="/profile" className="text-sm text-sage transition hover:text-ice">
            Profile
          </Link>
          <form action={signOut}>
            <button className="text-sm text-sage transition hover:text-ice">Sign out</button>
          </form>
        </div>
      </div>

      <header className="mb-7">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tightest text-snow">
          {profile?.display_name ? `Hi ${profile.display_name.split(" ")[0]}.` : "Hi."}
        </h1>
        <p className="mt-2 text-sm text-sage">Where are you climbing today?</p>
      </header>

      <div className="space-y-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="block">
            <article
              className={`relative overflow-hidden rounded-card bg-slope p-5 ring-1 transition hover:bg-ridge ${c.ring}`}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-20 h-32"
                style={{ background: `radial-gradient(ellipse at top, ${c.glow}, transparent 70%)` }}
              />
              <div className="relative">
                <p className="text-[0.7rem] uppercase tracking-[0.16em] text-sage">{c.eyebrow}</p>
                <h2
                  className={`mt-1.5 font-display text-2xl font-semibold tracking-tightest ${c.accent}`}
                >
                  {c.title}
                </h2>
                <p className="mt-2 max-w-[24rem] text-sm leading-relaxed text-sage">{c.body}</p>
                <p className="mt-4 flex items-center gap-2 text-sm text-snow/90">
                  <span>{c.status}</span>
                  <span aria-hidden className="text-sage">
                    →
                  </span>
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
