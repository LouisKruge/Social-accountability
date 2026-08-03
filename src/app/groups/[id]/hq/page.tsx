import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClubHq } from "@/components/club-hq";
import { loadClimb } from "@/lib/climb";
import { logReport } from "@/lib/timing";

export const dynamic = "force-dynamic";

export default async function ClubHqPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const state = await loadClimb(supabase, user!.id);
  logReport("climb.hq");

  const route = state.routes.find((r) => r.id === params.id);
  if (!route) notFound();

  return <ClubHq route={route} />;
}
