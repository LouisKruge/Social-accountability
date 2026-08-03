import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header } from "@/components/ui";
import { currentPeriod, formatPeriod } from "@/lib/period";
import { LogEntryForm } from "./log-form";

export const dynamic = "force-dynamic";

export default async function LogEntryPage({
  params,
}: {
  params: { id: string; categoryId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const period = currentPeriod();

  // All three key off `params.categoryId`, so none of them needs to wait on
  // another. They used to run in a waterfall — three sequential trips to Paris
  // to render a form with one input on it.
  const [{ data: category }, { data: baseline }, { data: entry }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, unit, metric_type, group_id")
      .eq("id", params.categoryId)
      .maybeSingle(),
    supabase
      .from("category_baselines")
      .select("baseline_value")
      .eq("user_id", user!.id)
      .eq("category_id", params.categoryId)
      .maybeSingle(),
    supabase
      .from("entries")
      .select("raw_value, share_raw_value")
      .eq("user_id", user!.id)
      .eq("category_id", params.categoryId)
      .eq("period_start", period.start)
      .maybeSingle(),
  ]);

  if (!category) notFound();

  return (
    <AppShell>
      <Header
        title={`Log · ${category.name}`}
        back={`/groups/${params.id}`}
        subtitle={`This week · ${formatPeriod(period)}`}
      />
      <LogEntryForm
        groupId={params.id}
        categoryId={category.id}
        unit={category.unit}
        metricType={category.metric_type}
        hasBaseline={Boolean(baseline)}
        existingValue={entry ? Number(entry.raw_value) : null}
        existingShare={entry?.share_raw_value ?? false}
      />
    </AppShell>
  );
}
