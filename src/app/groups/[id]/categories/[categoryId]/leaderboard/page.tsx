import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClimbPitchView, pitchNotice } from "@/components/climb-pitch";
import { loadClimb, momentum } from "@/lib/climb";
import { getTier } from "@/lib/entitlements";
import { logReport } from "@/lib/timing";

export const dynamic = "force-dynamic";

export default async function PitchPage({
  params,
  searchParams,
}: {
  params: { id: string; categoryId: string };
  searchParams: { logged?: string; recomputed?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // This screen used to make five queries of its own, several in a waterfall
  // behind the category lookup. It now reads the section's single load.
  const [state, tier] = await Promise.all([
    loadClimb(supabase, user!.id),
    getTier(supabase, user!.id),
  ]);
  logReport("climb.pitch");

  const route = state.routes.find((r) => r.id === params.id);
  const pitch = route?.pitches.find((p) => p.id === params.categoryId);
  if (!route || !pitch) notFound();

  return (
    <ClimbPitchView
      pitch={pitch}
      period={state.period}
      routeName={route.name}
      userId={user!.id}
      isOwner={route.isOwner}
      isPremium={tier === "premium"}
      // The default threshold is one unit of whatever this pitch measures — a
      // percentage point, or a day. Below that it reads as steady rather than
      // as a trend, because calling noise a trend is a fake insight.
      momentum={momentum(pitch.series)}
      notice={pitchNotice(searchParams)}
    />
  );
}
