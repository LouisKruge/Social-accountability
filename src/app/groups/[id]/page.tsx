import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClimbRouteView } from "@/components/climb-route";
import { loadClimb } from "@/lib/climb";
import { getTier } from "@/lib/entitlements";
import { logReport } from "@/lib/timing";

export const dynamic = "force-dynamic";

export default async function RoutePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // One load serves every Climb screen. This page used to issue three of its
  // own queries; it now filters a result the section already has.
  const [state, tier] = await Promise.all([
    loadClimb(supabase, user!.id),
    getTier(supabase, user!.id),
  ]);
  logReport("climb.route");

  const route = state.routes.find((r) => r.id === params.id);
  // Not a member, or no such group — RLS already hid it, so there is nothing to
  // distinguish between and nothing to leak by saying "not found".
  if (!route) notFound();

  return (
    <ClimbRouteView
      route={route}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
      canAddPitch={tier === "premium" || route.pitches.length === 0}
    />
  );
}
