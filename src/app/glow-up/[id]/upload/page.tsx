import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header, Button, ErrorNote } from "@/components/ui";
import { Uploader } from "./uploader";
import { generateReport } from "./actions";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS already scopes this to the owner; maybeSingle gives a clean 404 instead
  // of an empty page if someone tries another person's report id.
  const { data: report } = await supabase
    .from("glowup_reports")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!report) notFound();
  if (report.status === "ready") redirect(`/glow-up/${report.id}`);

  const { data: photos } = await supabase
    .from("glowup_photos")
    .select("photo_type")
    .eq("report_id", report.id);

  const ready = (photos ?? []).length > 0;

  return (
    <AppShell>
      <Header
        title="Your photos"
        back="/glow-up"
        subtitle="Two shots of yourself is plenty. Only you will ever see them."
      />

      <Uploader reportId={report.id} userId={user!.id} existing={photos ?? []} />

      {searchParams.error && (
        <div className="mt-5">
          <ErrorNote>
            {searchParams.error === "not_configured"
              ? "Reports aren't switched on yet. Hang tight."
              : "We couldn't finish that report. Try again in a moment."}
          </ErrorNote>
        </div>
      )}

      <form action={generateReport} className="mt-6">
        <input type="hidden" name="report_id" value={report.id} />
        <Button type="submit" disabled={!ready}>
          {ready ? "Get my report" : "Add a photo first"}
        </Button>
      </form>
    </AppShell>
  );
}
