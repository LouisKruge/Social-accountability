import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header, Card, Badge, EmptyState } from "@/components/ui";
import { validateReport, type GlowupReport } from "@/lib/glowup";
import { Unlock } from "@/components/unlock";

export const dynamic = "force-dynamic";

const GOAL_LABEL: Record<string, string> = {
  dating_profile: "Dating profile",
  job_interview: "Job interview",
  general_confidence: "General confidence",
};

/**
 * Elevate sits on the lighter end of the surface scale (ridge, not slope) and
 * carries no ranks, counters or gold — nothing competitive belongs in here.
 */
function Points({ items }: { items: string[] }) {
  return (
    <Card className="!bg-ridge">
      <ol className="space-y-4">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3.5">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ice/70" />
            <span className="text-body text-snow/90">{item}</span>
          </li>
        ))}
      </ol>
    </Card>
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

  if (row.status === "pending") redirect(`/elevate/${row.id}/upload`);

  // Re-validate on read: never render a stored blob that doesn't match the
  // fixed shape, even if it was written by an earlier version.
  const validated = row.report_json ? validateReport(row.report_json) : null;
  const report: GlowupReport | null = validated?.ok ? validated.report : null;

  return (
    <AppShell>
      <Header
        title={GOAL_LABEL[row.goal] ?? "Your report"}
        back="/elevate"
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
              href="/elevate/new"
              className="inline-flex w-full items-center justify-center rounded-field bg-ridge px-4 py-3 text-sm text-snow ring-1 ring-scree transition hover:bg-scree"
            >
              Start again
            </Link>
          }
        />
      ) : (
        <>
          <p className="mb-7 text-body text-sage">
            Prepared for you, one part at a time. Take it in whatever order suits you.
          </p>

          <Unlock
            sections={[
              { title: "Your photos", node: <Points items={report.photo_feedback} /> },
              { title: "Grooming", node: <Points items={report.grooming} /> },
              {
                title: "Wardrobe capsule",
                node: (
                  <div className="space-y-2.5">
                    <div className="flex justify-end">
                      <Badge tone="muted">
                        {row.budget_tier === "low"
                          ? "Budget"
                          : row.budget_tier === "high"
                            ? "Premium"
                            : "Middle"}
                      </Badge>
                    </div>
                    {report.wardrobe_capsule.map((item, i) => (
                      <Card key={i} className="!bg-ridge">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-display text-base font-medium text-snow">
                            {item.category}
                          </p>
                          <p className="tnum shrink-0 text-sm text-sage">{item.price_range_zar}</p>
                        </div>
                        <p className="mt-1.5 text-body text-snow/90">
                          {item.suggestion}
                        </p>
                        <p className="mt-2 text-xs text-sage">Try: {item.where_to_look}</p>
                      </Card>
                    ))}
                  </div>
                ),
              },
              { title: "Taking the photo", node: <Points items={report.photo_guidance} /> },
              { title: "Small daily habits", node: <Points items={report.confidence_exercises} /> },
            ]}
          />

          <p className="mt-8 text-center text-meta text-sage/80">
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
