"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ErrorNote } from "@/components/ui";
import { EVENT_LABEL } from "@/lib/events";
import { ask, type DirectorFormState } from "./actions";

const EXAMPLES = [
  "I have a wedding in two weeks",
  "Standard Bank interview next Tuesday",
  "Headshots on the 14th",
  "Holiday in a month",
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working it out…" : "Work it out"}
    </Button>
  );
}

/**
 * The Director's input.
 *
 * The examples are not decoration — they are the grammar. A free-text box with
 * no examples gets sentences the parser cannot read, and the person concludes
 * the feature is broken rather than that they phrased it unusually.
 */
export function DirectorForm({ initial }: { initial?: string }) {
  const [state, action] = useFormState<DirectorFormState, FormData>(ask, {});

  return (
    <div>
      <form action={action} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-micro uppercase text-sage">What&apos;s coming up?</span>
          <input
            name="text"
            defaultValue={initial}
            placeholder="I have a wedding in two weeks"
            autoComplete="off"
            className="min-h-[3.25rem] w-full rounded-field bg-slope px-4 text-[1rem] text-snow ring-1 ring-scree placeholder:text-sage/60 focus:outline-none focus:ring-2 focus:ring-snow/40"
          />
        </label>
        <ErrorNote>{state.problem}</ErrorNote>
        <Submit />
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <form key={e} action={action}>
            <input type="hidden" name="text" value={e} />
            <button
              type="submit"
              className="rounded-pill bg-ridge px-4 py-2 text-caption text-sage ring-1 ring-scree transition hover:text-snow"
            >
              {e}
            </button>
          </form>
        ))}
      </div>

      {state.plan?.intent && (
        <section className="mt-chapter border-t border-snow/25">
          <div className="py-block">
            <p className="text-micro uppercase text-sage">
              {EVENT_LABEL[state.plan.intent.kind]}
              {state.plan.intent.confidence === "low" && " · check the date"}
            </p>
            <h2 className="mt-2 text-balance font-display text-display font-semibold text-snow">
              {state.plan.intent.title}
            </h2>
            <p className="mt-3 text-body text-sage">
              {new Date(`${state.plan.intent.date}T00:00:00Z`).toLocaleDateString("en-ZA", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
              {" — read from "}
              <span className="text-snow">&ldquo;{state.plan.intent.dateSource}&rdquo;</span>.
            </p>
          </div>

          <ul className="border-t border-scree/60">
            {state.plan.proposals.map((p) => (
              <li key={p.id} className="border-b border-scree/40 py-4 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 text-body text-snow">{p.title}</span>
                  <span className="shrink-0 text-micro uppercase text-sage">{p.mode}</span>
                </div>
                <p className="mt-1.5 text-caption text-sage">{p.detail}</p>
                <a
                  href={
                    p.id === "elevate-event"
                      ? `${p.href}?kind=${state.plan!.intent!.kind}&date=${state.plan!.intent!.date}&title=${encodeURIComponent(state.plan!.intent!.title)}`
                      : p.href
                  }
                  className="mt-3 inline-flex min-h-[2.75rem] items-center justify-center rounded-pill bg-snow px-5 text-caption font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
                >
                  {p.touchesMoney ? "Review it" : "Do it"}
                </a>
              </li>
            ))}
          </ul>

          <p className="pt-4 text-meta text-sage/70">
            Nothing here happens on its own. Anything touching a Commit position needs you to
            change it — there is real money on those, and an assistant that quietly moves a target
            has changed what you staked on.
          </p>
        </section>
      )}
    </div>
  );
}
