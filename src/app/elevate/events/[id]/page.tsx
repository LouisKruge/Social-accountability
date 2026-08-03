import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventPlanView } from "@/components/event-plan";
import { loadElevateOs } from "@/lib/elevateOs";
import { logReport } from "@/lib/timing";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const os = await loadElevateOs(supabase, user!.id);
  logReport("elevate.event");

  // RLS already hid anyone else's events, so a miss here is genuinely "not
  // found" and there is nothing to distinguish between.
  const event = os.events.find((e) => e.id === params.id);
  if (!event) notFound();

  return <EventPlanView event={event} />;
}
