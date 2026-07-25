import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Brand, LinkButton, Card } from "@/components/ui";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/groups");

  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-center gap-8 py-10">
        <Brand />
        <div>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900">
            Start low.
            <br />
            <span className="text-brand-600">Climb fast.</span>
          </h1>
          <p className="mt-4 text-base text-slate-600">
            Ascend ranks your private group on <strong>rate of improvement</strong>, not
            absolute numbers. Whether it&apos;s savings in ZAR, debt paydown, steps or a
            daily habit — everyone competes on equal footing, because you race your own
            baseline.
          </p>
        </div>

        <Card className="bg-brand-50/60">
          <ul className="space-y-2 text-sm text-slate-700">
            <li>📈 Weekly leaderboard by % change from your baseline</li>
            <li>🔒 Your raw numbers stay private unless you choose to share</li>
            <li>💬 WhatsApp results &amp; reminders keep the group honest</li>
          </ul>
        </Card>

        <div className="space-y-3">
          <LinkButton href="/signup">Create your account</LinkButton>
          <LinkButton href="/login" variant="secondary">
            I already have an account
          </LinkButton>
        </div>
      </div>
    </AppShell>
  );
}
