import Link from "next/link";
import { AppShell } from "@/components/ui";
import { STUDIOS } from "@/lib/studios";
import { EVENT_LABEL, whenLabel, type PlannedTask, type TaskStatus } from "@/lib/events";
import { toggleTask } from "@/app/elevate/events/actions";
import type { EventWithPlan } from "@/lib/elevateOs";

/**
 * THE EVENT PREPARATION STUDIO.
 *
 * One event, its plan, and the honest part: a separate section for windows that
 * have already closed.
 *
 * ── WHY CLOSED WINDOWS ARE SHOWN AT ALL ──────────────────────────────────────
 * The easy thing is to hide them. The reason not to is that somebody four days
 * from a wedding needs to know that the three-week skincare routine is not on
 * the table — not so they can feel bad, but so they stop planning around it and
 * put the time into the things that still work. A checklist that pretends
 * everything is possible gets discovered on the morning of the event.
 *
 * They are shown in grey, without a red badge, and phrased as a fact rather
 * than a failure. Missing a window is usually a scheduling reality, not a
 * character flaw.
 */
export function EventPlanView({ event }: { event: EventWithPlan }) {
  const { plan } = event;
  const done = plan.tasks.filter((t) => t.status === "done").length;

  return (
    <AppShell>
      <header className="mb-block">
        <Link
          href="/elevate"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-sage transition hover:text-snow"
        >
          <span aria-hidden>←</span> Elevate
        </Link>
        <p className="text-micro uppercase text-sage">
          {EVENT_LABEL[event.kind]} · {whenLabel(plan.daysUntil)}
        </p>
        <h1 className="mt-2 text-balance font-display text-display font-semibold text-snow">
          {event.title}
        </h1>
        <p className="mt-3 text-body text-sage">
          {new Date(`${event.eventDate}T00:00:00Z`).toLocaleDateString("en-ZA", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </p>
        {event.notes && <p className="mt-3 max-w-[24rem] text-body text-sage">{event.notes}</p>}
      </header>

      {event.readiness !== null && (
        <section className="mb-chapter">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-micro uppercase text-sage">Ready</span>
            <span className="tnum text-body text-snow">
              {done} of {plan.tasks.length}
            </span>
          </div>
          <div aria-hidden className="mt-2 h-px w-full bg-scree">
            <div
              className="h-px bg-snow transition-[width] duration-500 ease-ascend"
              style={{ width: `${Math.round(event.readiness * 100)}%` }}
            />
          </div>
        </section>
      )}

      {/* ── The plan ─────────────────────────────────────────────────────── */}
      <section className="mb-chapter border-t border-snow/25">
        <h2 className="py-block font-display text-title font-semibold text-snow">
          {plan.past ? "What was on the plan" : "The plan"}
        </h2>

        {plan.tasks.length === 0 ? (
          <p className="border-t border-scree/60 py-5 text-body text-sage">
            Nothing left on this plan.
          </p>
        ) : (
          <ul className="border-t border-scree/60">
            {plan.tasks.map((t) => (
              <TaskRow key={t.key} task={t} eventId={event.id} />
            ))}
          </ul>
        )}
      </section>

      {/* ── Windows that have closed ─────────────────────────────────────── */}
      {plan.missed.length > 0 && (
        <section className="mb-chapter border-t border-scree/60">
          <h2 className="py-block text-micro uppercase text-sage">Not worth doing now</h2>
          <ul className="border-t border-scree/60">
            {plan.missed.map((t) => (
              <li key={t.key} className="border-b border-scree/40 py-4 last:border-0">
                <p className="text-body text-sage">{t.title}</p>
                <p className="mt-1 text-caption text-sage/70">{t.detail}</p>
              </li>
            ))}
          </ul>
          <p className="pt-4 text-meta text-sage/70">
            These needed more notice than this event gives them. They are listed so you can plan
            around the gap rather than discover it on the day — and so the next one gets the lead
            time it needs.
          </p>
        </section>
      )}

      <p className="mt-block text-meta text-sage/70">
        Dates are worked backwards from the event. The lead times are fixed domain rules — skin
        takes weeks, a haircut needs about two days to settle, a tailor&apos;s turnaround is not
        yours to control.
      </p>
    </AppShell>
  );
}

function TaskRow({ task: t, eventId }: { task: PlannedTask; eventId: string }) {
  const studio = t.studio ? STUDIOS.find((s) => s.key === t.studio) : null;

  return (
    <li className="border-b border-scree/40 last:border-0">
      <div className="flex items-start gap-3 py-4">
        <form action={toggleTask} className="shrink-0 pt-0.5">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="task_key" value={t.key} />
          <input type="hidden" name="done" value={t.status === "done" ? "0" : "1"} />
          <button
            type="submit"
            aria-label={t.status === "done" ? `Mark ${t.title} not done` : `Mark ${t.title} done`}
            className={`grid h-6 w-6 place-items-center rounded-full ring-1 transition ${
              t.status === "done"
                ? "bg-snow text-valley ring-snow"
                : "bg-transparent text-transparent ring-scree hover:ring-sage"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <p className={`text-body ${t.status === "done" ? "text-sage line-through" : "text-snow"}`}>
            {t.title}
          </p>
          <p className="mt-1 text-caption text-sage">{t.detail}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-micro uppercase text-sage/70">
            <span>{STATUS_LABEL[t.status](t.inDays)}</span>
            {studio && (
              <Link href={studio.href} className="text-sage underline underline-offset-4 hover:text-snow">
                {studio.name}
              </Link>
            )}
          </p>
        </div>
      </div>
    </li>
  );
}

const STATUS_LABEL: Record<TaskStatus, (inDays: number) => string> = {
  done: () => "Done",
  due: () => "Today",
  overdue: (d) => `${Math.abs(d)} ${Math.abs(d) === 1 ? "day" : "days"} late`,
  upcoming: (d) => (d === 1 ? "Tomorrow" : `In ${d} days`),
  missed_window: () => "Window closed",
};
