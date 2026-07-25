import { createClient } from "@/lib/supabase/server";
import { AppShell, Header, Card, Badge, ErrorNote } from "@/components/ui";
import { signOut } from "@/app/auth/actions";
import { ProfileForm } from "./profile-form";
import { DeleteAccount } from "./delete-account";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { delete_error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone_number, notify_whatsapp")
    .eq("id", user!.id)
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <AppShell>
      <Header title="Profile" back="/groups" subtitle={user?.email ?? undefined} />

      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm text-slate-500">Plan</span>
        <Badge tone={subscription?.tier === "premium" ? "brand" : "slate"}>
          {subscription?.tier === "premium" ? "Premium" : "Free"}
        </Badge>
      </div>

      {searchParams.delete_error && (
        <div className="mb-4">
          <ErrorNote>We couldn&apos;t delete your account. Please try again.</ErrorNote>
        </div>
      )}

      <Card className="mb-5">
        <ProfileForm
          displayName={profile?.display_name ?? ""}
          phoneNumber={profile?.phone_number ?? null}
          notifyWhatsapp={profile?.notify_whatsapp ?? true}
        />
      </Card>

      <form action={signOut} className="mb-8">
        <button className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">
          Sign out
        </button>
      </form>

      <DeleteAccount />
    </AppShell>
  );
}
