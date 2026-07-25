import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Brand, Card, Badge, EmptyState } from "@/components/ui";
import { CreateOrJoin } from "./group-forms";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Groups the user belongs to (RLS scopes this to their memberships).
  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, group:groups(id, name, invite_code), group_id")
    .order("joined_at", { ascending: true });

  const groups = (memberships ?? [])
    .map((m) => ({ ...m, group: Array.isArray(m.group) ? m.group[0] : m.group }))
    .filter((m) => m.group);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-3">
          <Link href="/profile" className="text-sm font-medium text-brand-600">
            Profile
          </Link>
          <form action={signOut}>
            <button className="text-sm font-medium text-slate-400">Sign out</button>
          </form>
        </div>
      </div>

      <h1 className="mb-4 text-2xl font-bold tracking-tight">Your groups</h1>

      <div className="mb-6 space-y-3">
        {groups.length === 0 ? (
          <EmptyState
            title="No groups yet"
            body="Create your own crew or join a friend’s with their invite code — then start logging this week."
          />
        ) : (
          groups.map((m) => (
            <Link key={m.group_id} href={`/groups/${m.group!.id}`} className="block">
              <Card className="flex items-center justify-between hover:border-brand-300">
                <div>
                  <p className="font-semibold text-slate-900">{m.group!.name}</p>
                  <p className="text-xs text-slate-400">
                    Invite code:{" "}
                    <span className="font-mono">{m.group!.invite_code}</span>
                  </p>
                </div>
                {m.role === "owner" && <Badge tone="brand">Owner</Badge>}
              </Card>
            </Link>
          ))
        )}
      </div>

      <CreateOrJoin />
    </AppShell>
  );
}
