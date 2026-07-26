import type { Config } from "tailwindcss";

/**
 * Ascend design tokens.
 *
 * The palette is derived from ALTITUDE, not from "dark mode": a cold, dark
 * valley floor at the base warming to summit light at the top. That gives each
 * accent a fixed meaning and keeps gold rare:
 *   ice   → the cold start (your baseline, 0%)
 *   summit→ altitude achieved (the leading tip of a climb, rank 1, a rank-up)
 * Gold is rendered as LIGHT (soft glows, gradient tips), never as a flat neon
 * fill — that is what keeps this from collapsing into "near-black + one acid
 * accent".
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Terrain (surfaces, valley → ridge) ──────────────────────────────
        valley: "#0E1712", // page base — near-black, green-tinted
        slope: "#16221C", // cards / elevated panels
        ridge: "#1E2C25", // hover / raised state
        scree: "#2A3A32", // hairlines, dividers, inactive strokes

        // ── Light (accents) ────────────────────────────────────────────────
        summit: {
          DEFAULT: "#E8B84B", // warm gold — altitude achieved
          soft: "#F0CE7E",
          deep: "#B98F2E",
        },
        ice: {
          DEFAULT: "#7FDCC0", // cool mint — the cold start
          soft: "#A9E9D6",
          deep: "#4FB196",
        },

        // ── Text ───────────────────────────────────────────────────────────
        snow: "#F3F1EA", // primary — warm off-white, never stark
        sage: "#8A9A90", // muted
        fall: "#E06D5A", // regression (a descent) — warm, not alarm-red
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // soft, deliberate — keeps this clearly out of broadsheet territory
        card: "1.125rem",
        field: "0.875rem",
      },
      boxShadow: {
        // summit light pooling at the top of an element
        crest: "0 -24px 48px -24px rgba(232,184,75,0.30)",
        lift: "0 8px 32px -12px rgba(0,0,0,0.6)",
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      keyframes: {
        // the one orchestrated moment: the line draws itself from the origin
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
      },
      animation: {
        draw: "draw 1100ms cubic-bezier(0.22,0.61,0.36,1) forwards",
        rise: "rise 420ms cubic-bezier(0.22,0.61,0.36,1) both",
        glint: "glint 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
