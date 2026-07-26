import Link from "next/link";
import { Brand } from "./ui";

/**
 * Header for a section landing page. Carries the section's accent and a way back
 * to the hub, so it always reads as "you are inside one of the three apps".
 */
export function SectionHeader({
  eyebrow,
  title,
  blurb,
  accent,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  accent: "ice" | "summit" | "snow";
}) {
  const accentClass =
    accent === "ice" ? "text-ice" : accent === "summit" ? "text-summit" : "text-snow";
  const glow =
    accent === "ice"
      ? "rgba(127,220,192,0.12)"
      : accent === "summit"
        ? "rgba(232,184,75,0.13)"
        : "rgba(243,241,234,0.07)";

  return (
    <>
      <div className="mb-7 flex items-center justify-between">
        <Link href="/home" aria-label="All sections">
          <Brand />
        </Link>
        <Link href="/profile" className="text-sm text-sage transition hover:text-ice">
          Profile
        </Link>
      </div>

      <header className="relative mb-7 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-20 h-32"
          style={{ background: `radial-gradient(ellipse at top left, ${glow}, transparent 70%)` }}
        />
        <div className="relative">
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-sage">{eyebrow}</p>
          <h1
            className={`mt-1.5 font-display text-[1.9rem] font-semibold leading-none tracking-tightest ${accentClass}`}
          >
            {title}
          </h1>
          <p className="mt-2.5 max-w-[26rem] text-sm leading-relaxed text-sage">{blurb}</p>
        </div>
      </header>
    </>
  );
}
