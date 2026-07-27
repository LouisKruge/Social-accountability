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

      <header className={`relative mb-block overflow-hidden ${accent === "summit" ? "lit-summit" : "lit-ice"}`}>
        <div className="relative">
          <p className="text-micro uppercase text-sage">{eyebrow}</p>
          <h1
            className={`mt-tight font-display text-title font-semibold ${accentClass}`}
          >
            {title}
          </h1>
          <p className="mt-tight max-w-[26rem] text-body text-sage">{blurb}</p>
        </div>
      </header>
    </>
  );
}
