import { createClient } from "@/lib/supabase/server";
import { StudioPage } from "@/components/elevate-shell";
import { loadElevate } from "@/lib/elevate";

export const dynamic = "force-dynamic";

/**
 * LOOK LAB — what to ask for, and what it will cost you in upkeep.
 *
 * ── WHAT THIS DELIBERATELY IS NOT ────────────────────────────────────────────
 * There is no "preview it on your face". Rendering a different haircut, beard,
 * skin or nail colour onto a photograph of a real person requires generative
 * image editing — the same machinery as a deepfake — and pointing it at
 * someone's own face to show them alternative versions of themselves is exactly
 * the appearance-anxiety engine this product is not allowed to become.
 *
 * What a good barber or stylist actually gives you is not a render. It is: what
 * to ask for in words, how long it takes to grow out, what it costs to keep up,
 * and what happens if you hate it. That is buildable, honest, and the part
 * people actually can't get elsewhere.
 */
const PLANS = [
  {
    name: "Shorter on the sides, length on top",
    ask: "\"Scissor cut on top, leave 5–7cm, taper the sides down to a number 2 — no hard line.\"",
    upkeep: "Every 4–5 weeks",
    effort: "2 minutes with a matte paste on damp hair",
    growOut: "Grows out evenly. Awkward stage is around week 7.",
    reverse: "Fully reversible — it's a length change, nothing structural.",
  },
  {
    name: "Grown out, one length",
    ask: "\"Just tidy the ends and take the weight out of the back. Don't touch the length.\"",
    upkeep: "Every 8–10 weeks",
    effort: "Air-dry, but it needs conditioner and a comb",
    growOut: "Expect 3–4 months of in-between before it sits properly.",
    reverse: "Cutting it back is quick; growing it is the slow direction.",
  },
  {
    name: "Short beard, defined line",
    ask: "\"Number 3 all over, sharpen the cheek line but keep it natural, and follow my jaw for the neckline.\"",
    upkeep: "Every 5–7 days",
    effort: "5 minutes with a trimmer, plus beard oil after washing",
    growOut: "Fills in over 2–3 weeks if you leave it alone.",
    reverse: "Immediately — it's a trim.",
  },
  {
    name: "Clean shaven",
    ask: "Nothing to ask — but change the blade, shave with the grain, and finish with a balm not an alcohol splash.",
    upkeep: "Every 1–2 days",
    effort: "10 minutes, and it's the highest-maintenance option here",
    growOut: "Stubble returns in 2–3 days.",
    reverse: "Fully — just stop.",
  },
];

export default async function LookLabPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadElevate(supabase, user!.id);

  return (
    <StudioPage state={state} studioKey="look">
      <p className="mb-6 rounded-card bg-slope/50 p-4 text-meta text-sage ring-1 ring-scree/50">
        <span className="text-snow/90">There&apos;s no preview here, on purpose.</span> Rendering a
        different haircut onto your face needs the same technology as a deepfake, and showing people
        edited versions of themselves is not what this app is for. What a good barber actually gives
        you is the sentence to say, and an honest answer about upkeep. That&apos;s what&apos;s below.
      </p>

      <div className="space-y-3">
        {PLANS.map((p) => (
          <details
            key={p.name}
            className="group rounded-card bg-slope/70 ring-1 ring-scree/60 transition open:ring-snow/20"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-5">
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold tracking-tight text-snow">
                  {p.name}
                </span>
                <span className="mt-0.5 block text-xs text-sage">Upkeep: {p.upkeep}</span>
              </span>
              <span
                aria-hidden
                className="shrink-0 text-sage transition group-open:rotate-90"
              >
                →
              </span>
            </summary>
            <div className="space-y-3.5 border-t border-scree/50 px-5 pb-5 pt-4">
              <Line label="What to say">{p.ask}</Line>
              <Line label="Daily effort">{p.effort}</Line>
              <Line label="Growing out">{p.growOut}</Line>
              <Line label="If you hate it">{p.reverse}</Line>
            </div>
          </details>
        ))}
      </div>

      <p className="mt-8 text-center text-meta text-sage/70">
        These are options, not instructions. Nothing here is about what would &ldquo;suit&rdquo;
        you — that&apos;s your call, and a stranger&apos;s opinion of your face isn&apos;t data.
      </p>
    </StudioPage>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-micro uppercase text-sage">{label}</p>
      <p className="mt-1 text-body text-snow/85">{children}</p>
    </div>
  );
}
