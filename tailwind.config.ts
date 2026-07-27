import type { Config } from "tailwindcss";

/**
 * ASCEND DESIGN TOKENS.
 *
 * Three scales and nothing outside them. The point of a scale is not tidiness —
 * it is that a screen built from a scale has a rhythm the eye can follow, and a
 * screen built from arbitrary values does not, however carefully each value was
 * chosen. Before this file the app used `mb-5`, `mb-6`, `mb-7`, `text-[1.7rem]`
 * and `text-[0.62rem]` interchangeably. Every one looked fine alone; together
 * they read as assembled.
 *
 * COLOUR resolves through CSS custom properties (see globals.css) so a theme is
 * eleven values, not a rewrite. `<alpha-value>` keeps Tailwind's opacity
 * modifiers working: `bg-slope/60` still does what it says.
 */

/** rgb var with Tailwind alpha support. */
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Terrain (surfaces, valley → ridge) ──────────────────────────────
        valley: c("valley"),
        slope: c("slope"),
        ridge: c("ridge"),
        scree: c("scree"),

        // ── Light (accents, one fixed meaning each) ─────────────────────────
        summit: {
          DEFAULT: c("summit"), // gold — money confirmed as yours, nothing else
          soft: c("summit-soft"),
          deep: c("summit-deep"),
        },
        ice: {
          DEFAULT: c("ice"), // mint — live, in progress, not yet won
          soft: c("ice-soft"),
          deep: c("ice-deep"),
        },

        // ── Text ───────────────────────────────────────────────────────────
        snow: c("snow"),
        sage: c("sage"),
        fall: c("fall"), // a descent — warm, never alarm-red
      },

      /**
       * TYPE SCALE — editorial, not UI-kit.
       *
       * The jump from `title` to `display` is deliberately violent (1.75rem →
       * 2.5rem). A gentle scale reads as a settings screen; a scale with a real
       * gap between "the headline" and "everything else" reads as a magazine,
       * and gives the eye somewhere to land first.
       *
       * Line height and tracking are baked in, because a size without them is
       * half a decision and the other half ends up scattered across components.
       */
      fontSize: {
        micro: ["0.625rem", { lineHeight: "1.2", letterSpacing: "0.14em" }],
        caption: ["0.6875rem", { lineHeight: "1.45", letterSpacing: "0.01em" }],
        meta: ["0.75rem", { lineHeight: "1.5" }],
        body: ["0.875rem", { lineHeight: "1.6" }],
        lead: ["1rem", { lineHeight: "1.6" }],
        title: ["1.75rem", { lineHeight: "1.05", letterSpacing: "-0.035em" }],
        display: ["2.5rem", { lineHeight: "0.98", letterSpacing: "-0.045em" }],
        hero: ["3.5rem", { lineHeight: "0.9", letterSpacing: "-0.05em" }],
      },

      /**
       * SPACING RHYTHM — a 4px grid, with named steps for the four distances
       * that actually recur. Components use the names; arbitrary values are the
       * exception that has to justify itself.
       */
      spacing: {
        hair: "0.125rem", //  2 — inside a chip
        tight: "0.375rem", //  6 — between a label and its value
        gutter: "1.25rem", // 20 — the page margin, everywhere
        block: "1.75rem", // 28 — between sections of one idea
        chapter: "2.75rem", // 44 — between one idea and the next
      },

      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },

      borderRadius: {
        card: "1.125rem",
        field: "0.875rem",
        pill: "999px",
      },

      /**
       * ELEVATION — four layers, and a component may only claim one.
       *   flat    on the page, no shadow (most things)
       *   lift    a resting card
       *   float   something that came from somewhere — sheets, menus
       *   crest   summit light pooling above an element, not a drop shadow
       */
      boxShadow: {
        lift: "var(--shadow-lift)",
        float: "var(--shadow-float)",
        crest: "0 -24px 48px -24px rgb(var(--glow-summit) / 0.3)",
      },

      letterSpacing: {
        tightest: "-0.045em",
      },

      transitionTimingFunction: {
        // The house curve. Matches SPRING in src/lib/motion.ts.
        ascend: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },

      keyframes: {
        draw: {
          from: { strokeDashoffset: "var(--dash)" },
          to: { strokeDashoffset: "0" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glint: {
          "0%,100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        /** A live surface, breathing. Used only where data is genuinely live. */
        pulse_soft: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        /** Skeleton shimmer — a loading state that reads as loading. */
        sheen: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(100%)" },
        },
      },
      animation: {
        draw: "draw 1100ms cubic-bezier(0.22,0.61,0.36,1) forwards",
        rise: "rise 420ms cubic-bezier(0.22,0.61,0.36,1) both",
        glint: "glint 2.4s ease-in-out infinite",
        "pulse-soft": "pulse_soft 2s cubic-bezier(0.4,0,0.6,1) infinite",
        sheen: "sheen 1.6s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
