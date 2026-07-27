import { createClient } from "@/lib/supabase/server";
import { StudioPage } from "@/components/elevate-shell";
import { loadElevate } from "@/lib/elevate";

export const dynamic = "force-dynamic";

/**
 * CONFIDENCE COACH — small, concrete things to practise.
 *
 * ── THE LINE THIS DOES NOT CROSS ─────────────────────────────────────────────
 * This is rehearsal for specific situations, not therapy. Every exercise below
 * is a behaviour you can do in a room — an opening line, a handshake, a pause —
 * not an instruction about how to feel. Nothing here diagnoses anxiety, nothing
 * asks about mood, and nothing suggests the user is broken in a way that needs
 * fixing. A styling app is not a clinician and must not perform as one.
 */
const DRILLS: Record<
  string,
  { title: string; practise: string; why: string; time: string }[]
> = {
  interview: [
    {
      title: "The 40-second answer",
      practise:
        "Say out loud what you do and why you're good at it, in 40 seconds. Time it. Do it three times until it stops sounding rehearsed.",
      why: "The opening question is the same in every interview, and it is the one people improvise worst.",
      time: "5 min",
    },
    {
      title: "Land the pause",
      practise:
        "Next time you're asked something hard, count two silent seconds before answering.",
      why: "A pause reads as considered. Filling it reads as guessing, and it is a habit you can break in a week.",
      time: "In the moment",
    },
    {
      title: "Have three questions ready",
      practise: "Write three questions you actually want answered about the job. Not about the company — about the work.",
      why: "\"Any questions?\" is the last thing they'll remember. Having none reads as indifference.",
      time: "10 min",
    },
  ],
  dating_profile: [
    {
      title: "Write the opener you'd want to receive",
      practise:
        "Pick something specific from a profile and ask one real question about it. No compliments about appearance.",
      why: "Specific beats flattering every time, and it gives the other person something to answer.",
      time: "2 min",
    },
    {
      title: "The one-line story",
      practise:
        "Find a 20-second version of something you did recently that you enjoyed. Practise telling it.",
      why: "Conversations stall on 'what do you do'. A short story about something real restarts them.",
      time: "5 min",
    },
  ],
  networking: [
    {
      title: "The exit line",
      practise: "Rehearse one sentence for leaving a conversation politely. \"I'm going to grab a drink — good to meet you.\"",
      why: "Most people avoid starting conversations because they don't know how to end them.",
      time: "2 min",
    },
    {
      title: "Name it back",
      practise: "Say the person's name once, out loud, within the first minute of meeting them.",
      why: "It fixes the name in your memory and it is the single most reliable way to seem present.",
      time: "In the moment",
    },
  ],
  general_confidence: [
    {
      title: "Take up your own space",
      practise:
        "In your next meeting, put both forearms on the table instead of your hands in your lap.",
      why: "It is a posture change you can make deliberately, and it changes how a room reads you without changing you.",
      time: "In the moment",
    },
    {
      title: "One unhurried sentence a day",
      practise: "Once today, say something at half your normal speed. Just once.",
      why: "Speed is the most common tell of nerves and the easiest to control on purpose.",
      time: "In the moment",
    },
    {
      title: "Ask one more question",
      practise: "In your next conversation, ask a follow-up to something they said rather than moving on.",
      why: "Being interested is easier than being interesting, and people remember it more.",
      time: "In the moment",
    },
  ],
};

export default async function ConfidencePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadElevate(supabase, user!.id);

  const goal = state.profile?.goalMode ?? "general_confidence";
  const drills = DRILLS[goal] ?? DRILLS.general_confidence;

  return (
    <StudioPage state={state} studioKey="confidence">
      <p className="mb-6 text-body text-sage">
        Small things you can practise before they matter. Pick one — doing a single drill properly
        beats reading all of them.
      </p>

      <div className="space-y-3">
        {drills.map((d) => (
          <article key={d.title} className="rounded-card bg-slope/70 p-5 ring-1 ring-scree/60">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-base font-semibold tracking-tight text-snow">
                {d.title}
              </h2>
              <span className="shrink-0 rounded-full bg-valley/70 px-2.5 py-1 text-[0.62rem] text-sage ring-1 ring-scree/60">
                {d.time}
              </span>
            </div>
            <p className="mt-2.5 text-body text-snow/85">{d.practise}</p>
            <p className="mt-2 text-meta text-sage">{d.why}</p>
          </article>
        ))}
      </div>

      <p className="mt-8 rounded-card bg-slope/40 p-4 text-meta text-sage ring-1 ring-scree/40">
        These are rehearsals for specific situations, not therapy. If what you&apos;re carrying is
        heavier than a nervous interview — and that is common and nothing to be embarrassed by — a
        counsellor is the right person, not a styling app. In South Africa, SADAG is on{" "}
        <span className="text-snow/85">0800 567 567</span>.
      </p>
    </StudioPage>
  );
}
