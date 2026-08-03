import type { StudioKey } from "@/lib/studios";

// ─────────────────────────────────────────────────────────────────────────────
// THE LIFE EVENTS ENGINE
//
// The inversion the brief asked for. Instead of "what do you want to improve?",
// the app says "you have an interview on Tuesday" and orchestrates backwards
// from the date.
//
// ── WHY THIS IS A SCHEDULER AND NOT A CHATBOT ────────────────────────────────
// Everything here is arithmetic on a calendar plus domain knowledge that does
// not change: skin takes weeks, a haircut needs days to settle, alterations
// need a tailor's turnaround. None of that requires a model, and a model would
// make it non-deterministic — the one property a plan must never have.
//
// ── THE PART THAT MAKES IT FEEL BUILT BY SOMEONE WHO KNOWS ───────────────────
// A haircut the day before an interview is a mistake. Fresh cuts sit wrong for
// about 48 hours, so the ideal is five days out and the window CLOSES at two.
// Every task therefore carries both an ideal lead time and a latest-useful
// date, and a plan built four days before a wedding says which windows have
// already shut instead of cheerfully listing a skincare routine that needed
// three weeks.
//
// That honesty is the feature. A checklist that pretends everything is still
// possible is worse than no checklist, because the person discovers the truth
// on the morning of the event.
// ─────────────────────────────────────────────────────────────────────────────

export type EventKind =
  | "interview"
  | "wedding"
  | "first_date"
  | "presentation"
  | "conference"
  | "business_meeting"
  | "holiday"
  | "photoshoot"
  | "networking"
  | "graduation";

export const EVENT_LABEL: Record<EventKind, string> = {
  interview: "Interview",
  wedding: "Wedding",
  first_date: "First date",
  presentation: "Presentation",
  conference: "Conference",
  business_meeting: "Business meeting",
  holiday: "Holiday",
  photoshoot: "Photoshoot",
  networking: "Networking event",
  graduation: "Graduation",
};

export type TaskKey =
  | "skincare_start"
  | "outfit_chosen"
  | "gap_check"
  | "alterations"
  | "dry_clean"
  | "haircut"
  | "beard_shape"
  | "shoes"
  | "speech_practice"
  | "conversation_practice"
  | "photo_prep"
  | "packing"
  | "route_check"
  | "early_night"
  | "final_check"
  | "follow_up";

export interface TaskSpec {
  key: TaskKey;
  title: string;
  detail: string;
  /** Ideal days before the event. Negative means after. */
  leadDays: number;
  /**
   * Latest useful day-count before the event. Below this the task is no longer
   * worth doing, and the plan says so rather than listing it as merely late.
   * Null means it stays useful right up to the day.
   */
  closesAt: number | null;
  studio: StudioKey | null;
}

/**
 * The task library.
 *
 * Lead times are the domain knowledge, and each one has a reason:
 *   skincare      three weeks is the shortest honest window for skin to change
 *   haircut       five days out; a cut needs ~48h to settle, so it shuts at two
 *   alterations   a week, because a tailor's turnaround is not yours to control
 *   outfit        chosen a week out so a gap can still be filled
 */
const TASKS: Record<TaskKey, TaskSpec> = {
  skincare_start: {
    key: "skincare_start",
    title: "Start the skincare run",
    detail: "Three weeks is the shortest window in which skin actually changes. Starting later is not a shortcut, it is a different plan.",
    leadDays: 21,
    closesAt: 10,
    studio: "look",
  },
  outfit_chosen: {
    key: "outfit_chosen",
    title: "Choose the outfit",
    detail: "Pick it from your wardrobe now, while there is still time to fill a gap if one turns up.",
    leadDays: 7,
    closesAt: 1,
    studio: "style",
  },
  gap_check: {
    key: "gap_check",
    title: "Check for gaps",
    detail: "Anything missing from the outfit — a belt, the right shoes, a second shirt — is cheaper to solve now than the night before.",
    leadDays: 7,
    closesAt: 2,
    studio: "style",
  },
  alterations: {
    key: "alterations",
    title: "Alterations, if anything needs them",
    detail: "A tailor's turnaround is not yours to control. Six days is the shortest safe assumption.",
    leadDays: 6,
    closesAt: 3,
    studio: "style",
  },
  dry_clean: {
    key: "dry_clean",
    title: "Clean or press what you're wearing",
    detail: "Four days covers a normal turnaround with a day of slack.",
    leadDays: 4,
    closesAt: 2,
    studio: "style",
  },
  haircut: {
    key: "haircut",
    title: "Haircut",
    detail: "Five days out. A fresh cut sits wrong for about forty-eight hours, which is why the day before is a mistake rather than a close call.",
    leadDays: 5,
    closesAt: 2,
    studio: "look",
  },
  beard_shape: {
    key: "beard_shape",
    title: "Shape the beard",
    detail: "Two days, so any line you are unhappy with has time to soften.",
    leadDays: 2,
    closesAt: 1,
    studio: "look",
  },
  shoes: {
    key: "shoes",
    title: "Clean the shoes",
    detail: "The one thing people notice and nobody plans for.",
    leadDays: 2,
    closesAt: null,
    studio: "style",
  },
  speech_practice: {
    key: "speech_practice",
    title: "Practise out loud",
    detail: "Start ten days out and repeat. Reading it in your head is not practice.",
    leadDays: 10,
    closesAt: 1,
    studio: "confidence",
  },
  conversation_practice: {
    key: "conversation_practice",
    title: "Run the conversation",
    detail: "Two or three openers and one thing you actually want to ask them.",
    leadDays: 5,
    closesAt: 1,
    studio: "confidence",
  },
  photo_prep: {
    key: "photo_prep",
    title: "Work the shot list",
    detail: "Angles, light and the frame, decided before you are standing in front of a camera.",
    leadDays: 3,
    closesAt: 1,
    studio: "photo",
  },
  packing: {
    key: "packing",
    title: "Pack",
    detail: "Two days out, so anything missing is still buyable.",
    leadDays: 2,
    closesAt: null,
    studio: "style",
  },
  route_check: {
    key: "route_check",
    title: "Check the route and the time",
    detail: "Where it is, how long it takes, and what you do if that fails.",
    leadDays: 1,
    closesAt: null,
    studio: null,
  },
  early_night: {
    key: "early_night",
    title: "An early night",
    detail: "The highest-return thing on this list and the one most often skipped.",
    leadDays: 1,
    closesAt: null,
    studio: null,
  },
  final_check: {
    key: "final_check",
    title: "Lay it all out",
    detail: "Clothes, shoes, anything you have to carry. On the day, decisions are expensive.",
    leadDays: 1,
    closesAt: null,
    studio: null,
  },
  follow_up: {
    key: "follow_up",
    title: "Follow up",
    detail: "Two days after. The part almost everybody skips, and the part that compounds.",
    leadDays: -2,
    closesAt: null,
    studio: null,
  },
};

/** Which tasks each kind of event actually needs. */
const PLANS: Record<EventKind, TaskKey[]> = {
  interview: ["skincare_start", "outfit_chosen", "gap_check", "alterations", "dry_clean", "haircut", "beard_shape", "shoes", "speech_practice", "route_check", "early_night", "final_check", "follow_up"],
  wedding: ["skincare_start", "outfit_chosen", "gap_check", "alterations", "dry_clean", "haircut", "beard_shape", "shoes", "route_check", "early_night", "final_check"],
  first_date: ["outfit_chosen", "haircut", "beard_shape", "shoes", "conversation_practice", "route_check", "final_check", "follow_up"],
  presentation: ["outfit_chosen", "dry_clean", "haircut", "shoes", "speech_practice", "route_check", "early_night", "final_check", "follow_up"],
  conference: ["outfit_chosen", "gap_check", "haircut", "shoes", "conversation_practice", "packing", "route_check", "final_check", "follow_up"],
  business_meeting: ["outfit_chosen", "dry_clean", "haircut", "shoes", "speech_practice", "route_check", "final_check", "follow_up"],
  holiday: ["skincare_start", "outfit_chosen", "gap_check", "haircut", "packing", "final_check"],
  photoshoot: ["skincare_start", "outfit_chosen", "gap_check", "haircut", "beard_shape", "photo_prep", "early_night", "final_check"],
  networking: ["outfit_chosen", "haircut", "shoes", "conversation_practice", "route_check", "final_check", "follow_up"],
  graduation: ["outfit_chosen", "gap_check", "haircut", "beard_shape", "shoes", "photo_prep", "final_check"],
};

export type TaskStatus = "upcoming" | "due" | "overdue" | "missed_window" | "done";

export interface PlannedTask {
  key: TaskKey;
  title: string;
  detail: string;
  studio: StudioKey | null;
  /** ISO date this should happen on. */
  dueOn: string;
  /** Days from today until `dueOn`. Negative is in the past. */
  inDays: number;
  status: TaskStatus;
}

export interface EventPlan {
  daysUntil: number;
  /** Everything still worth doing, soonest first. */
  tasks: PlannedTask[];
  /** Windows that have already closed — stated, not hidden. */
  missed: PlannedTask[];
  /** The single next thing. */
  next: PlannedTask | null;
  /** True once the event date has passed. */
  past: boolean;
}

/**
 * Build the plan for one event.
 *
 * `doneKeys` are tasks the user has ticked; they never appear as overdue.
 */
export function planEvent(
  kind: EventKind,
  eventDate: string,
  today: string,
  doneKeys: TaskKey[] = [],
): EventPlan {
  const done = new Set(doneKeys);
  const daysUntil = daysBetween(today, eventDate);

  const all: PlannedTask[] = PLANS[kind].map((key) => {
    const spec = TASKS[key];
    const dueOn = shiftDays(eventDate, -spec.leadDays);
    const inDays = daysBetween(today, dueOn);

    let status: TaskStatus;
    if (done.has(key)) {
      status = "done";
    } else if (spec.leadDays < 0) {
      // A follow-up cannot be late before the event has even happened.
      status = daysUntil > 0 ? "upcoming" : inDays > 0 ? "upcoming" : inDays === 0 ? "due" : "overdue";
    } else if (spec.closesAt !== null && daysUntil < spec.closesAt) {
      // The window shut. Not "late" — no longer worth doing, and saying so is
      // more useful than a red badge on something that cannot help any more.
      status = "missed_window";
    } else if (inDays > 0) {
      status = "upcoming";
    } else if (inDays === 0) {
      status = "due";
    } else {
      status = "overdue";
    }

    return { key, title: spec.title, detail: spec.detail, studio: spec.studio, dueOn, inDays, status };
  });

  const live = all
    .filter((t) => t.status !== "missed_window")
    .sort((a, b) => a.inDays - b.inDays || a.key.localeCompare(b.key));

  return {
    daysUntil,
    tasks: live,
    missed: all.filter((t) => t.status === "missed_window"),
    next: live.find((t) => t.status === "overdue" || t.status === "due" || t.status === "upcoming") ?? null,
    past: daysUntil < 0,
  };
}

/** How ready is this event? Done over everything still achievable. */
export function readiness(plan: EventPlan): number | null {
  const countable = plan.tasks.length;
  if (countable === 0) return null;
  return plan.tasks.filter((t) => t.status === "done").length / countable;
}

/**
 * The events worth putting in front of someone right now.
 *
 * Past events drop off, and anything beyond the horizon is not urgent enough to
 * take space on a home screen from something that is.
 */
export function upcoming<T extends { eventDate: string }>(
  events: T[],
  today: string,
  horizonDays = 120,
): T[] {
  return events
    .filter((e) => {
      const d = daysBetween(today, e.eventDate);
      return d >= 0 && d <= horizonDays;
    })
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

/** "in 12 days", "tomorrow", "today". */
export function whenLabel(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)} ${Math.abs(daysUntil) === 1 ? "day" : "days"} ago`;
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  if (daysUntil < 14) return `in ${daysUntil} days`;
  if (daysUntil < 60) return `in ${Math.round(daysUntil / 7)} weeks`;
  return `in ${Math.round(daysUntil / 30)} months`;
}

// ── Date helpers, all UTC calendar dates ─────────────────────────────────────

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
