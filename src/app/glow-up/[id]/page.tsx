import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header, Card, Badge, EmptyState } from "@/components/ui";
import { validateReport, type GlowupReport } from "@/lib/glowup";

export const dynamic = "force-dynamic";

const GOAL_LABEL: Record<string, string> = {
  dating_profile: "Dating profile",
  job_interview: "Job interview",
  general_confidence: "General confidence",
};

function Section({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">{title}</h2>
      <Card>
        <ol className="space-y-3.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="tnum mt-0.5 shrink-0 text-xs text-ice">{i + 1}</span>
              <span className="text-sm leading-relaxed text-snow/90">{item}</span>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}

export default async function ReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: row } = await supabase
    .from("glowup_reports")
    .select("id, goal, budget_tier, status, report_json, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!row) notFound();

  if (row.status === "pending") redirect(`/glow-up/${row.id}/upload`);

  // Re-validate on read: never render a stored blob that doesn't match the
  // fixed shape, even if it was written by an earlier version.
  const validated = row.report_json ? validateReport(row.report_json) : null;
  const report: GlowupReport | null = validated?.ok ? validated.report : null;

  return (
    <AppShell>
      <Header
        title={GOAL_LABEL[row.goal] ?? "Your report"}
        back="/glow-up"
        subtitle={new Date(row.created_at).toLocaleDateString("en-ZA", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      />

      {!report ? (
        <EmptyState
          title="This one didn't come through"
          body="Something went wrong generating it. Start a fresh report and we'll try again."
          cta={
            <Link
              href="/glow-up/new"
              className="inline-flex w-full items-center justify-center rounded-field bg-ridge px-4 py-3 text-sm text-snow ring-1 ring-scree transition hover:bg-scree"
            >
              Start again
            </Link>
          }
        />
      ) : (
        <>
          <Section title="Your photos" items={report.photo_feedback} />
          <Section title="Grooming" items={report.grooming} />

          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-[0.16em] text-sage">Wardrobe capsule</h2>
              <Badge tone="muted">
                {row.budget_tier === "low" ? "Budget" : row.budget_tier === "high" ? "Premium" : "Middle"}
              </Badge>
            </div>
            <div className="space-y-2.5">
              {report.wardrobe_capsule.map((item, i) => (
                <Card key={i}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-base font-medium text-snow">{item.category}</p>
                    <p className="tnum shrink-0 text-sm text-summit">{item.price_range_zar}</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-snow/90">{item.suggestion}</p>
                  <p className="mt-2 text-xs text-sage">Try: {item.where_to_look}</p>
                </Card>
              ))}
            </div>
          </section>

          <Section title="Taking the photo" items={report.photo_guidance} />
          <Section title="Small daily habits" items={report.confidence_exercises} />

          <p className="mt-2 text-center text-xs leading-relaxed text-sage/80">
            This report is private to you. Delete it and your photos any time from{" "}
            <Link href="/profile" className="text-ice">
              Profile
            </Link>
            .
          </p>
        </>
      )}
    </AppShell>
  );
}
