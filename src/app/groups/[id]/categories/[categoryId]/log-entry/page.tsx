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

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, unit, metric_type, group_id")
    .eq("id", params.categoryId)
    .maybeSingle();

  if (!category) notFound();

  const period = currentPeriod();

  const { data: baseline } = await supabase
    .from("category_baselines")
    .select("baseline_value")
    .eq("user_id", user!.id)
    .eq("category_id", category.id)
    .maybeSingle();

  const { data: entry } = await supabase
    .from("entries")
    .select("raw_value, share_raw_value")
    .eq("user_id", user!.id)
    .eq("category_id", category.id)
    .eq("period_start", period.start)
    .maybeSingle();

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
