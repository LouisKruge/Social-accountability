"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { SPRING } from "@/lib/motion";

/**
 * THE DOCK.
 *
 * A bar pinned edge-to-edge across the bottom is the single most generic thing
 * a mobile app can do — it is the first thing every framework hands you, and it
 * makes every app that has one look like every other app that has one.
 *
 * So this floats. It is inset from all three edges, sits on real black glass,
 * and the selected item is marked by a MORPHING pill that travels between
 * destinations rather than four icons taking turns being tinted. The travel is
 * the point: it tells you where you came from, which a colour change cannot.
 *
 * `layoutId` gives shared-element transition for free — one element, moving,
 * not two elements cross-fading.
 */
const ITEMS = [
  { href: "/groups", label: "Climb", match: ["/groups"] },
  { href: "/commit", label: "Commit", match: ["/commit"] },
  { href: "/elevate", label: "Elevate", match: ["/elevate"] },
  { href: "/you", label: "You", match: ["/you", "/profile", "/billing"] },
] as const;

function Glyph({ i, active }: { i: number; active: boolean }) {
  const s = active ? "rgb(var(--valley))" : "rgb(var(--sage))";
  const common = { fill: "none", stroke: s, strokeWidth: 1.8, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
      {i === 0 && <path d="M4 18 L9.5 12.5 L13 15.5 L20 7" {...common} strokeLinejoin="round" />}
      {i === 1 && (
        <>
          <path d="M5 6 L7.5 18 Q12 19.6 16.5 18 L19 6" {...common} />
          <path d="M7 12 Q12 13.4 17 12" {...common} />
        </>
      )}
      {i === 2 && (
        <>
          <circle cx="12" cy="12" r="3.4" {...common} />
          <path d="M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2" {...common} />
        </>
      )}
      {i === 3 && (
        <>
          <circle cx="12" cy="8.6" r="3.2" {...common} />
          <path d="M5.5 19.5 Q12 14 18.5 19.5" {...common} />
        </>
      )}
    </svg>
  );
}

export function Dock() {
  const pathname = usePathname() ?? "";
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="Sections"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <ul className="glass pointer-events-auto flex items-center gap-hair rounded-pill p-hair shadow-float ring-1 ring-scree/80">
        {ITEMS.map((item, i) => {
          const active = item.match.some(
            (m) => pathname === m || pathname.startsWith(`${m}/`),
          );
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="relative flex min-h-[2.75rem] items-center gap-2 rounded-pill px-4"
              >
                {active && (
                  // One pill, travelling. Not four states cross-fading.
                  <motion.span
                    layoutId="dock-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-pill bg-snow"
                    transition={reduce ? { duration: 0 } : SPRING.snap}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Glyph i={i} active={active} />
                  {/* The label only exists on the selected item — the dock
                      stays narrow, and the selection is unmissable. */}
                  <motion.span
                    initial={false}
                    animate={{
                      width: active ? "auto" : 0,
                      opacity: active ? 1 : 0,
                    }}
                    transition={reduce ? { duration: 0 } : SPRING.snap}
                    className="overflow-hidden whitespace-nowrap text-caption font-medium text-valley"
                  >
                    {item.label}
                  </motion.span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
