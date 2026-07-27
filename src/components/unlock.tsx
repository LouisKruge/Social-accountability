"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * THE UNLOCK — Elevate's signature.
 *
 * Report sections arrive one at a time, like pages of a dossier prepared for
 * this person, rather than landing as a wall of text. This is the one place in
 * the product where ceremony is earned: the user paid for this result.
 *
 * Two hard rules, because a reveal must never become a way of withholding:
 *   • "Show everything" is always available, from the first section onward.
 *   • Under prefers-reduced-motion every section is revealed immediately, so
 *     the static state carries exactly the same information.
 *
 * Quieter than Climb by construction — no counters, no gold, no ranking.
 */
export function Unlock({
  sections,
}: {
  sections: { title: string; node: ReactNode }[];
}) {
  const [revealed, setRevealed] = useState(1);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setInstant(true);
      setRevealed(sections.length);
    }
  }, [sections.length]);

  const allShown = revealed >= sections.length;

  return (
    <div>
      <div className="space-y-6">
        {sections.slice(0, revealed).map((s, i) => (
          <section
            key={s.title}
            className={instant ? "" : "motion-safe:animate-rise"}
            style={instant ? undefined : { animationDelay: `${Math.min(i, 1) * 60}ms` }}
          >
            <h2 className="mb-3 text-micro uppercase text-sage">{s.title}</h2>
            {s.node}
          </section>
        ))}
      </div>

      {!allShown && (
        <div className="mt-7 space-y-2.5">
          <button
            onClick={() => setRevealed((r) => r + 1)}
            className="w-full rounded-field bg-ridge px-4 py-3.5 text-sm font-medium text-snow ring-1 ring-scree transition hover:bg-scree"
          >
            Next: {sections[revealed]?.title}
          </button>
          <button
            onClick={() => setRevealed(sections.length)}
            className="w-full rounded-field px-4 py-2 text-xs text-sage transition hover:text-snow"
          >
            Show everything
          </button>
          <p className="pt-1 text-center text-xs text-sage/70">
            {revealed} of {sections.length}
          </p>
        </div>
      )}
    </div>
  );
}
