import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Card, Badge, EmptyState } from "@/components/ui";
import { SectionHeader } from "@/components/section-header";
import { AgeGate } from "./age-gate";

export const dynamic = "force-dynamic";

const GOAL_LABEL: Record<string, string> = {
  dating_profile: "Dating profile",
  job_interview: "Job interview",
  general_confidence: "General confidence",
};

/**
 * GLOW UP — section landing.
 *
 * The feature is 18+ (dating-profile use case), so the age gate sits in front of
 * the entry path rather than being a checkbox further in. Everything here is
 * strictly the account holder's own: reports and photos are owner-only under
 * RLS, there is no gallery, no comparison, and no view of anybody else.
 */
export default async function GlowUpPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("glowup_age_confirmed_at")
    .eq("id", user!.id)
    .maybeSingle();

  const { data: reports } = await supabase
    .from("glowup_reports")
    .select("id, goal, budget_tier, status, created_at")
    .order("created_at", { ascending: false });

  const ageConfirmed = Boolean(profile?.glowup_age_confirmed_at);

  return (
    <AppShell>
      <SectionHeader
        eyebrow="Coaching"
        title="Elevate"
        blurb="A private review of your own photos — lighting, grooming, styling and how you're framing yourself for a goal you choose."
        accent="snow"
      />

      {!ageConfirmed ? (
        <AgeGate />
      ) : (
        <>
          <section className="mb-8">
            <Link href="/elevate/new" className="block">
              <Card className="relative overflow-hidden ring-1 ring-scree transition hover:bg-ridge">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-20 h-32 bg-[radial-gradient(ellipse_at_top,rgba(243,241,234,0.08),transparent_70%)]"
                />
                <div className="relative">
                  <p className="font-display text-lg font-medium text-snow">Start a new report</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-sage">
                    Answer three quick questions, upload a couple of your own photos, and get a
                    structured review back.
                  </p>
                  <p className="mt-4 text-sm text-snow/90">
                    Begin <span aria-hidden className="text-sage">→</span>
                  </p>
                </div>
              </Card>
            </Link>
          </section>

          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Your reports</h2>
            {(reports ?? []).length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                body="Your first report will show up here, and stays private to you."
              />
            ) : (
              <div className="space-y-2.5">
                {reports!.map((r) => (
                  <Link key={r.id} href={`/elevate/${r.id}`} className="block">
                    <Card className="flex items-center justify-between gap-3 transition hover:bg-ridge">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-snow">
                          {GOAL_LABEL[r.goal] ?? r.goal}
                        </p>
                        <p className="mt-1 text-xs text-sage">
                          {new Date(r.created_at).toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Badge tone={r.status === "ready" ? "ice" : "muted"}>
                        {r.status === "ready" ? "Ready" : r.status === "failed" ? "Failed" : "In progress"}
                      </Badge>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <p className="mt-7 text-center text-xs leading-relaxed text-sage/80">
        Your photos are private to you, stored in a private bucket, and never shown to anyone else.
        You can delete them and every report at any time from{" "}
        <Link href="/profile" className="text-ice">
          Profile
        </Link>
        .
      </p>
    </AppShell>
  );
}
