import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Brand, Card, Button, EmptyState, ErrorNote } from "@/components/ui";
import { joinByCode } from "@/app/groups/actions";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { error?: string };
}) {
  const code = params.code.toLowerCase();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: preview } = await supabase.rpc("preview_group_by_code", { _code: code });
  const group = Array.isArray(preview) ? preview[0] : null;

  return (
    <AppShell>
      <div className="mb-8 mt-4">
        <Brand />
      </div>

      {searchParams.error && (
        <div className="mb-4">
          <ErrorNote>We couldn&apos;t add you to that group. Please try the link again.</ErrorNote>
        </div>
      )}

      {!group ? (
        <EmptyState
          title="Invite not found"
          body="This invite link doesn’t match any group. Ask your friend to resend it."
          cta={
            <Link href="/groups" className="font-semibold text-brand-600">
              Go to your groups
            </Link>
          }
        />
      ) : (
        <Card className="text-center">
          <p className="text-sm text-slate-500">You’ve been invited to join</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">{group.name}</p>
          <p className="mt-1 text-sm text-slate-400">
            {group.member_count} member{Number(group.member_count) === 1 ? "" : "s"}
          </p>

          <div className="mt-6">
            {user ? (
              <form action={joinByCode}>
                <input type="hidden" name="invite_code" value={code} />
                <Button type="submit">Join {group.name}</Button>
              </form>
            ) : (
              <div className="space-y-3">
                <Link
                  href={`/signup?redirectTo=${encodeURIComponent(`/join/${code}`)}`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  Sign up &amp; join
                </Link>
                <Link
                  href={`/login?redirectTo=${encodeURIComponent(`/join/${code}`)}`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800"
                >
                  I already have an account
                </Link>
              </div>
            )}
          </div>
        </Card>
      )}
    </AppShell>
  );
}
