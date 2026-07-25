import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header, Card, Badge, LinkButton, EmptyState } from "@/components/ui";
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

  const isOwner = group.owner_id === user?.id;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <AppShell>
      <Header title={group.name} back="/groups" subtitle={`${members?.length ?? 0} member${(members?.length ?? 0) === 1 ? "" : "s"}`} />

      <div className="mb-5">
        <InviteShare groupName={group.name} inviteCode={group.invite_code} siteUrl={siteUrl} />
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Categories</h2>
        <div className="space-y-3">
          {(categories ?? []).length === 0 ? (
            <EmptyState
              title="No categories yet"
              body="Add the first thing your group will compete on — steps, savings, debt paydown or a daily habit."
            />
          ) : (
            categories!.map((c) => (
              <Card key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    <Badge tone="slate">{METRIC_LABEL[c.metric_type]}</Badge>
                    {c.unit && <span>{c.unit}</span>}
                    {c.metric_type === "percentage_change" && (
                      <span>{c.direction === "decrease" ? "lower is better" : "higher is better"}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Link
                    href={`/groups/${group.id}/categories/${c.id}/log-entry`}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-center text-xs font-semibold text-white"
                  >
                    Log
                  </Link>
                  <Link
                    href={`/groups/${group.id}/categories/${c.id}/leaderboard`}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-center text-xs font-semibold text-slate-700"
                  >
                    Ranks
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="mb-6">
        <CategoryForm groupId={group.id} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Members</h2>
        <Card>
          <ul className="divide-y divide-slate-100">
            {(members ?? []).map((m) => {
              const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
              return (
                <li key={m.user_id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <span className="text-sm text-slate-800">
                    {profile?.display_name ?? "Member"}
                    {m.user_id === user?.id && <span className="text-slate-400"> (you)</span>}
                  </span>
                  {m.role === "owner" && <Badge tone="brand">Owner</Badge>}
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      {!isOwner && (
        <div className="mt-6">
          <LinkButton href="/groups" variant="ghost">
            Back to your groups
          </LinkButton>
        </div>
      )}
    </AppShell>
  );
}
