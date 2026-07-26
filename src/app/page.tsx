import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Brand, LinkButton } from "@/components/ui";
import { AscentLine } from "@/components/ascent";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/groups");

  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-center gap-9 py-8">
        <Brand size="lg" />

        <div>
          <h1 className="font-display text-[2.75rem] font-semibold leading-[0.98] tracking-tightest text-snow">
            Start low.
            <br />
            <span className="text-summit">Climb fast.</span>
          </h1>
          <p className="mt-5 max-w-[26rem] text-[0.95rem] leading-relaxed text-sage">
            Ascend ranks your group on how fast you improve — not who started ahead. You race your
            own baseline, so the person saving their first R200 can out-climb someone with R20 000.
          </p>
        </div>

        {/* the signature, doing the explaining */}
        <div className="relative overflow-hidden rounded-card bg-slope px-5 py-6 ring-1 ring-scree/70">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-20 h-36 bg-[radial-gradient(ellipse_at_top,rgba(232,184,75,0.14),transparent_70%)]"
          />
          <AscentLine values={[4, 9, 8, 15, 23]} height={120} label="An example climb" />
          <div className="relative mt-3 flex items-center justify-between text-xs">
            <span className="text-ice">Your baseline</span>
            <span className="tnum text-summit">+23% this week</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <LinkButton href="/signup">Create your account</LinkButton>
          <LinkButton href="/login" variant="secondary">
            I already have an account
          </LinkButton>
        </div>
      </div>
    </AppShell>
  );
}
