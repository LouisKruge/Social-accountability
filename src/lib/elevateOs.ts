import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { loadElevate, type ElevateState } from "@/lib/elevate";
import {
  planEvent,
  readiness,
  todayIso,
  upcoming,
  type EventKind,
  type EventPlan,
  type TaskKey,
} from "@/lib/events";
import { transformationScore, type TransformationInputs } from "@/lib/transformation";
import { timed, withTiming, type TimingReport } from "@/lib/timing";

// ─────────────────────────────────────────────────────────────────────────────
// ELEVATE'S COMMAND CENTRE
//
// The brief: replace the list with an intelligent command centre, and make the
// Life Events Engine the thing it is organised around.
//
// The ordering principle is Elevate's version of the briefing's: what has a
// DATE attached beats what does not. A wedding in nine days outranks a wardrobe
// gap that has been there for a month, because one of them has a deadline the
// world imposed and the other is a preference.
// ─────────────────────────────────────────────────────────────────────────────

export interface EventWithPlan {
  id: string;
  kind: EventKind;
  title: string;
  eventDate: string;
  notes: string | null;
  plan: EventPlan;
  /** Fraction of still-achievable tasks completed, or null when none remain. */
  readiness: number | null;
}

export interface ElevateOs {
  state: ElevateState;
  events: EventWithPlan[];
  /** The nearest event, which is what the command centre leads with. */
  focus: EventWithPlan | null;
  transformation: ReturnType<typeof transformationScore>;
  timing: TimingReport;
}

export async function loadElevateOs(
  supabase: ServerClient,
  userId: string,
): Promise<ElevateOs> {
  const { result, timing } = await withTiming(async () => {
    const [state, eventRows, taskRows] = await Promise.all([
      loadElevate(supabase, userId),
      timed(
        "life_events",
        async () => {
          const { data } = await supabase
            .from("life_events")
            .select("id, kind, title, event_date, notes")
            .order("event_date", { ascending: true })
            .limit(100);
          return data ?? [];
        },
        (r) => r.length,
      ),
      timed(
        "event_tasks",
        async () => {
          const { data } = await supabase.from("event_tasks").select("event_id, task_key");
          return data ?? [];
        },
        (r) => r.length,
      ),
    ]);
    return { state, eventRows, taskRows };
  });

  const { state, eventRows, taskRows } = result;
  const today = todayIso();

  const doneByEvent = new Map<string, TaskKey[]>();
  for (const t of taskRows) {
    const list = doneByEvent.get(t.event_id) ?? [];
    list.push(t.task_key as TaskKey);
    doneByEvent.set(t.event_id, list);
  }

  const events: EventWithPlan[] = eventRows.map((e) => {
    const plan = planEvent(e.kind as EventKind, e.event_date, today, doneByEvent.get(e.id) ?? []);
    return {
      id: e.id,
      kind: e.kind as EventKind,
      title: e.title,
      eventDate: e.event_date,
      notes: e.notes,
      plan,
      readiness: readiness(plan),
    };
  });

  const ahead = upcoming(events, today);

  return {
    state,
    events,
    focus: ahead[0] ?? null,
    transformation: transformationScore(transformationInputs(state, events, today)),
    timing,
  };
}

/**
 * Elevate's signals, from rows only.
 *
 * Nothing here is an opinion about how somebody looks — see the header of
 * `src/lib/transformation.ts` for why that is the load-bearing constraint
 * rather than a nicety.
 */
export function transformationInputs(
  state: ElevateState,
  events: EventWithPlan[],
  today: string,
): TransformationInputs {
  const dates = state.timeline.map((t) => t.occurredAt.slice(0, 10)).sort();
  const spanWeeks =
    dates.length > 1
      ? Math.max(
          0,
          Math.round(
            (Date.parse(`${dates[dates.length - 1]}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) /
              (7 * 86_400_000),
          ),
        )
      : 0;

  // An event counts as "prepared for" only once it has happened and its plan
  // was more than half done. Counting future events would let somebody raise
  // the score by adding events they have not prepared for.
  const past = events.filter((e) => e.eventDate < today);
  const prepared = past.filter((e) => (e.readiness ?? 0) >= 0.5).length;

  return {
    wardrobeItems: state.wardrobeStats.total,
    wardrobeWorn: state.wardrobeStats.total - state.wardrobeStats.neverWornCount,
    looks: state.looksCount,
    actionsTotal: state.actions.length,
    actionsDone: state.actions.filter((a) => a.status === "done").length,
    reports: state.reportCount,
    timelineEntries: state.timeline.length,
    recordSpanWeeks: spanWeeks,
    eventsPrepared: prepared,
    eventsTotal: past.length,
  };
}
