"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The four tabs. The three modes are named for what they emotionally do, not
 * for their mechanics, and each carries a fixed accent so you always know which
 * mode you're in:
 *   Climb   → ice    · competitive, public
 *   Commit  → ice     · money; gold is withheld here and reserved strictly for
 *                       confirmed payouts, so it never becomes UI chrome
 *   Elevate → snow   · private, considered
 *   You     → sage   · the unified hub; deliberately the quietest tab
 */
export const SECTIONS = [
  { key: "climb", href: "/groups", label: "Climb", match: ["/groups"], accent: "text-ice" },
  { key: "commit", href: "/commit", label: "Commit", match: ["/commit", "/commit"], accent: "text-ice" },
  { key: "elevate", href: "/elevate", label: "Elevate", match: ["/elevate", "/elevate"], accent: "text-snow" },
  { key: "you", href: "/you", label: "You", match: ["/you", "/profile", "/billing"], accent: "text-snow" },
] as const;

function Glyph({ section, active }: { section: (typeof SECTIONS)[number]["key"]; active: boolean }) {
  const stroke = active ? "currentColor" : "rgb(var(--sage))";

  if (section === "climb") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M3 19 L9 13 L13 16 L21 6" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="3" cy="19" r="1.8" fill={stroke} />
      </svg>
    );
  }
  if (section === "commit") {
    // the pool: a basin holding a level
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M4 6 L7 18 Q12 20 17 18 L20 6" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.4 12 Q12 13.6 17.6 12" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (section === "elevate") {
    // light blooming
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="3.6" fill="none" stroke={stroke} strokeWidth="1.8" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            x1={12 + 6.2 * Math.cos((a * Math.PI) / 180)}
            y1={12 + 6.2 * Math.sin((a * Math.PI) / 180)}
            x2={12 + 8.6 * Math.cos((a * Math.PI) / 180)}
            y2={12 + 8.6 * Math.sin((a * Math.PI) / 180)}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.4" fill="none" stroke={stroke} strokeWidth="1.8" />
      <path d="M5 20 Q12 14 19 20" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SectionNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Sections"
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-scree/60"
    >
      <ul className="mx-auto flex w-full max-w-[30rem] items-stretch">
        {SECTIONS.map((s) => {
          const active = s.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          return (
            <li key={s.key} className="flex-1">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-1 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-3 text-caption transition duration-150 ease-ascend active:scale-[0.96] ${
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
