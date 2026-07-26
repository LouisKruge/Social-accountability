import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header, Card, Badge, EmptyState } from "@/components/ui";
import { CategoryForm } from "./category-form";
import { InviteShare } from "./invite-share";

export const dynamic = "force-dynamic";

const METRIC_LABEL: Record<string, string> = {
  percentage_change: "% change",
  streak: "streak",
};

export default async function GroupPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, invite_code, owner_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("role, user_id, profile:profiles(display_name)")
    .eq("group_id", params.id)
    .order("joined_at", { ascending: true });

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, metric_type, direction, unit")
    .eq("group_id", params.id)
    .order("created_at", { ascending: true });

  const memberCount = members?.length ?? 0;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <AppShell>
      <Header
        title={group.name}
        back="/groups"
        subtitle={`${memberCount} ${memberCount === 1 ? "climber" : "climbers"}`}
      />

      <div className="mb-7">
        <InviteShare groupName={group.name} inviteCode={group.invite_code} siteUrl={siteUrl} />
      </div>

      <section className="mb-7">
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">What you&apos;re climbing</h2>
        <div className="space-y-2.5">
          {(categories ?? []).length === 0 ? (
            <EmptyState
              title="Nothing to climb yet"
              body="Add the first thing this group competes on — steps, savings, debt paydown or a daily habit."
            />
          ) : (
            categories!.map((c) => (
              <Card key={c.id} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-medium tracking-tight text-snow">
                    {c.name}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-sage">
                    <Badge tone="muted">{METRIC_LABEL[c.metric_type]}</Badge>
                    {c.unit && <span>{c.unit}</span>}
                    {c.metric_type === "percentage_change" && (
                      <span>{c.direction === "decrease" ? "lower is better" : "higher is better"}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Link
                    href={`/groups/${group.id}/categories/${c.id}/log-entry`}
                    className="rounded-field bg-summit px-3.5 py-2 text-center text-xs font-semibold text-valley transition hover:bg-summit-soft"
                  >
                    Log
                  </Link>
                  <Link
                    href={`/groups/${group.id}/categories/${c.id}/leaderboard`}
                    className="rounded-field bg-ridge px-3.5 py-2 text-center text-xs text-snow ring-1 ring-scree transition hover:bg-scree"
                  >
                    Climb
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="mb-7">
        <CategoryForm groupId={group.id} />
        <p className="mt-3 text-center text-xs text-sage/80">
          Free plan: one category.{" "}
          <Link href="/billing" className="text-ice transition hover:text-ice-soft">
            Go Premium
          </Link>
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Climbers</h2>
        <Card className="!py-2">
          <ul className="divide-y divide-scree/60">
            {(members ?? []).map((m) => {
              const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
              return (
                <li key={m.user_id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-snow/90">
                    {profile?.display_name ?? "Member"}
                    {m.user_id === user?.id && <span className="text-sage"> · you</span>}
                  </span>
                  {m.role === "owner" && <Badge tone="muted">Owner</Badge>}
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
    </AppShell>
  );
}
