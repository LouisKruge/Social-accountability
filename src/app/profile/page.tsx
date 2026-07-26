import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header, Card, Badge, ErrorNote } from "@/components/ui";
import { signOut } from "@/app/auth/actions";
import { ProfileForm } from "./profile-form";
import { DeleteAccount } from "./delete-account";
import { DeleteGlowupData } from "./delete-glowup";

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

      <Link href="/billing" className="mb-5 block">
        <Card className="flex items-center justify-between transition hover:bg-ridge">
          <div>
            <p className="text-sm font-semibold text-snow">Plan &amp; billing</p>
            <p className="text-xs text-sage">Manage your subscription</p>
          </div>
          <Badge tone={subscription?.tier === "premium" ? "summit" : "muted"}>
            {subscription?.tier === "premium" ? "Premium" : "Free"}
          </Badge>
        </Card>
      </Link>

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
        <button className="w-full rounded-field bg-ridge px-4 py-3.5 text-sm text-snow ring-1 ring-scree transition hover:bg-scree">
          Sign out
        </button>
      </form>

      <div className="mb-5">
        <DeleteGlowupData />
      </div>

      <DeleteAccount />
    </AppShell>
  );
}
