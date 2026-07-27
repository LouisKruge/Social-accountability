import type { Transition, Variants } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// ASCEND MOTION — one vocabulary, used everywhere.
//
// Before this file, every component picked its own duration and easing. Fifteen
// components, fifteen slightly different feels — which is exactly what makes an
// interface read as assembled rather than designed. A person cannot name what
// is wrong, but they can feel that the app is not one thing.
//
// ── THE RULE: MOTION CARRIES INFORMATION, OR IT DOESN'T HAPPEN ───────────────
// Every transition here says something:
//   ENTER    something arrived that was not here before
//   SETTLE   a value changed and has come to rest
//   EXPAND   more of this exists, and it came from here
//   EXIT     this is gone, and here is where it went
// Decoration is not on the list. If a movement doesn't answer "what changed?",
// it should be a static state.
//
// ── WHY SPRINGS, NOT DURATIONS ───────────────────────────────────────────────
// A duration says "take 300ms whatever you are doing". A spring says "you have
// mass and you are settling", so a 4px nudge finishes fast and a full-height
// sheet takes its time — from the same declaration. That is the difference
// between motion that feels physical and motion that feels scheduled.
//
// Durations survive only where there is genuinely no distance to travel: an
// opacity fade, a colour change.
// ─────────────────────────────────────────────────────────────────────────────

/** The house curve. Fast out of the gate, long settle — confident, not eager. */
export const EASE = [0.22, 0.61, 0.36, 1] as const;

export const SPRING = {
  /** Small, decisive: chips, toggles, checkboxes, a number landing. */
  snap: { type: "spring", stiffness: 420, damping: 32, mass: 0.6 },
  /** The default. Cards arriving, panels settling, most of the app. */
  settle: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  /** Large surfaces with real weight: sheets, overlays, page-level panels. */
  weighty: { type: "spring", stiffness: 200, damping: 34, mass: 1.2 },
  /** A value coming to rest. Deliberately slow — money should not twitch. */
  figure: { type: "spring", stiffness: 90, damping: 20, mass: 0.6 },
} satisfies Record<string, Transition>;

export const DURATION = {
  /** A state change with no distance: colour, opacity, a ring appearing. */
  state: 0.18,
  /** A fade where something is genuinely replaced. */
  cross: 0.28,
  /** A line drawing itself — the one place a long duration is the point. */
  draw: 1.1,
} as const;

/**
 * Stagger, capped.
 *
 * A list of forty items staggered at 40ms each takes 1.6 seconds to finish,
 * and the last row arrives long after the reader got there. Capping the index
 * means a long list still feels sequenced without making anybody wait.
 */
export function stagger(index: number, step = 0.04, cap = 6): number {
  return Math.min(index, cap) * step;
}

// ── Variants ─────────────────────────────────────────────────────────────────

/** Something arrived. Rises a little, because up is the app's whole metaphor. */
export const enter: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0 },
};

/** A surface that came from somewhere: sheets, menus, the command bar. */
export const emerge: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  shown: { opacity: 1, y: 0, scale: 1 },
  gone: { opacity: 0, y: -8, scale: 0.98 },
};

/** A drawer from the bottom edge. */
export const sheet: Variants = {
  hidden: { y: "100%" },
  shown: { y: 0 },
  gone: { y: "100%" },
};

/**
 * Under prefers-reduced-motion every variant above must still END in the same
 * place — the value is never withheld, only the travel. Pass the result of
 * `useReducedMotion()`.
 */
export function initialFor(reduce: boolean | null, variant: keyof Variants = "hidden") {
  return reduce ? false : variant;
}

export function transitionFor(
  reduce: boolean | null,
  t: Transition = SPRING.settle,
): Transition {
  return reduce ? { duration: 0 } : t;
}
