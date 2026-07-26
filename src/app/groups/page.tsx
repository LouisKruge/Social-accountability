import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Brand, Card, Badge, EmptyState } from "@/components/ui";
import { MiniAscent, Horizon } from "@/components/ascent";
import { CreateOrJoin } from "./group-forms";
import { signOut } from "@/app/auth/actions";
import { currentPeriod } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, group:groups(id, name, invite_code), group_id")
    .order("joined_at", { ascending: true });

  const groups = (memberships ?? [])
    .map((m) => ({ ...m, group: Array.isArray(m.group) ? m.group[0] : m.group }))
    .filter((m) => m.group);

  // Who's leading each group this week — the glanceable bit on each card.
  const period = currentPeriod();
  const { data: leaders } = await supabase
    .from("leaderboard_rankings")
    .select("group_id, pct_change, rank, profile:profiles(display_name)")
    .eq("period_start", period.start)
    .eq("rank", 1);

  const leaderByGroup = new Map(
    (leaders ?? []).map((l) => {
      const p = Array.isArray(l.profile) ? l.profile[0] : l.profile;
      return [l.group_id, { name: p?.display_name ?? "Someone", pct: Number(l.pct_change) }];
    }),
  );

  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between">
        <Link href="/home" aria-label="All sections">
          <Brand />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/profile" className="text-sm text-sage transition hover:text-ice">
            Profile
          </Link>
          <form action={signOut}>
            <button className="text-sm text-sage transition hover:text-ice">Sign out</button>
          </form>
        </div>
      </div>

      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-sage">Self improvement</p>
      <h1 className="mb-5 mt-1.5 font-display text-[1.75rem] font-semibold leading-none tracking-tightest text-snow">
        Your groups
      </h1>

      <div className="mb-7 space-y-2.5">
        {groups.length === 0 ? (
          <EmptyState
            title="Nothing to climb yet"
            body="Create a group or join a friend's with their invite code, then log your first number this week."
          />
        ) : (
          groups.map((m) => {
            const leader = leaderByGroup.get(m.group_id);
            return (
              <Link key={m.group_id} href={`/groups/${m.group!.id}`} className="block">
                <Card className="transition hover:bg-ridge">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-medium tracking-tight text-snow">
                        {m.group!.name}
                      </p>
                      {leader ? (
                        <p className="mt-1 truncate text-sm text-sage">
                          <span className="text-snow/90">{leader.name}</span> leads ·{" "}
                          <span className="tnum text-summit">
                            {leader.pct > 0 ? "+" : ""}
                            {leader.pct}%
                          </span>
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-sage">No one has moved this week.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {m.role === "owner" && <Badge tone="muted">Owner</Badge>}
                      {leader ? (
                        <MiniAscent values={[leader.pct]} climbing={leader.pct >= 0} />
                      ) : (
                        <div className="w-[60px] opacity-60">
                          <Horizon />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>

      <CreateOrJoin />

      <p className="mt-5 text-center text-xs text-sage/80">
        Free plan: one group you own.{" "}
        <Link href="/billing" className="text-ice transition hover:text-ice-soft">
          See Premium
        </Link>
      </p>
    </AppShell>
  );
}
