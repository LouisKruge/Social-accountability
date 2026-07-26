"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The three tracks Ascend contains. Each is effectively its own app — its own
 * data, its own RLS boundary, its own screens — so the nav treats them as peers
 * rather than nesting them under one another.
 *
 * Each carries a fixed accent so you always know which app you are inside:
 *   Climb   → ice   (the shared-baseline leaderboard)
 *   Stakes  → summit (money on the line)
 *   Glow Up → snow  (light on the person)
 */
export const SECTIONS = [
  {
    key: "climb",
    href: "/groups",
    label: "Climb",
    match: ["/groups"],
    accent: "text-ice",
  },
  {
    key: "stakes",
    href: "/challenges",
    label: "Stakes",
    match: ["/challenges"],
    accent: "text-summit",
  },
  {
    key: "glowup",
    href: "/glow-up",
    label: "Glow Up",
    match: ["/glow-up"],
    accent: "text-snow",
  },
] as const;

function Glyph({ section, active }: { section: (typeof SECTIONS)[number]["key"]; active: boolean }) {
  const stroke = active ? "currentColor" : "#8A9A90";
  if (section === "climb") {
    // a rising trajectory from the shared origin
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M3 19 L9 13 L13 16 L21 6" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="3" cy="19" r="1.8" fill={stroke} />
      </svg>
    );
  }
  if (section === "stakes") {
    // a climb meeting a target line
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M3 19 C 8 19, 10 10, 19 7" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M14 7 H21" stroke={stroke} strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" />
        <circle cx="19" cy="7" r="2.2" fill={stroke} />
      </svg>
    );
  }
  // glow up — light blooming
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="none" stroke={stroke} strokeWidth="2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={12 + 6.5 * Math.cos((a * Math.PI) / 180)}
          y1={12 + 6.5 * Math.sin((a * Math.PI) / 180)}
          x2={12 + 9 * Math.cos((a * Math.PI) / 180)}
          y2={12 + 9 * Math.sin((a * Math.PI) / 180)}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/**
 * Persistent bottom switcher. Bottom-anchored for thumb reach on the phone,
 * which is where this app is actually used.
 */
export function SectionNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-scree/70 bg-valley/95 backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-[30rem] items-stretch">
        {SECTIONS.map((s) => {
          const active = s.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          return (
            <li key={s.key} className="flex-1">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-2 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-3 text-[0.7rem] transition ${
                  active ? `${s.accent} font-medium` : "text-sage hover:text-snow"
                }`}
              >
                <Glyph section={s.key} active={active} />
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
