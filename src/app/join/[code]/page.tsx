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
            <Link href="/groups" className="font-semibold text-ice">
              Go to your groups
            </Link>
          }
        />
      ) : (
        <Card className="text-center">
          <p className="text-sm text-sage">You’ve been invited to join</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-snow">{group.name}</p>
          <p className="mt-1 text-sm text-sage">
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
                  className="inline-flex w-full items-center justify-center rounded-field bg-summit px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-summit-soft"
                >
                  Sign up &amp; join
                </Link>
                <Link
                  href={`/login?redirectTo=${encodeURIComponent(`/join/${code}`)}`}
                  className="inline-flex w-full items-center justify-center rounded-field bg-ridge px-4 py-3.5 text-sm text-snow ring-1 ring-scree transition hover:bg-scree"
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
