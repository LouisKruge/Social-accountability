import { createClient } from "@/lib/supabase/server";
import { StudioPage } from "@/components/elevate-shell";
import { EmptyState } from "@/components/ui";
import { loadElevate } from "@/lib/elevate";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  photo: "Photo",
  action_done: "Done",
  look_saved: "Look saved",
  goal_changed: "Goal changed",
  report_ready: "Report",
  note: "Note",
};

/**
 * TIMELINE — the record of what actually changed.
 *
 * Deliberately a record of ACTIONS and DECISIONS, not a before-and-after photo
 * grid. A grid of your own face over time invites exactly the comparison this
 * product refuses to encourage; a list of things you did is progress you can
 * point at without judging how you looked in March.
 */
export default async function TimelinePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadElevate(supabase, user!.id);

  return (
    <StudioPage state={state} studioKey="timeline">
      {state.timeline.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          body="As you tick off recommendations, save outfits and set goals, they land here — so you can see what you've actually changed rather than trying to remember."
        />
      ) : (
        <ol className="relative space-y-4 border-l border-scree/60 pl-5">
          {state.timeline.map((t) => (
            <li key={t.id} className="relative">
              <span
                aria-hidden
                className="absolute -left-[1.42rem] top-1.5 h-2 w-2 rounded-full bg-sage ring-4 ring-valley"
              />
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-sage">
                {KIND_LABEL[t.kind] ?? t.kind} ·{" "}
                {new Date(t.occurredAt).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 text-sm leading-snug text-snow/90">{t.title}</p>
              {t.detail && (
                <p className="mt-1 text-xs leading-relaxed text-sage">{t.detail}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-8 text-center text-xs leading-relaxed text-sage/70">
        This tracks what you did, not how you looked. There&apos;s no before-and-after grid here —
        comparing photographs of yourself is the habit this app is trying to replace.
      </p>
    </StudioPage>
  );
}
