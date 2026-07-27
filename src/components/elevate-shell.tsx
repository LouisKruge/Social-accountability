import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/ui";
import { STUDIOS, type ElevateState, type StudioKey } from "@/lib/elevate";

/**
 * Every studio wears the same frame: a way back to Elevate, its own name and
 * the question it answers, and a strip of the other studios so moving between
 * them never costs more than a tap.
 *
 * Elevate's chrome is quieter than Commit's on purpose. Commit is a money
 * surface and rewards density; this one is about how someone feels when they
 * look in a mirror, and crowding that with figures would be the wrong register.
 */
export function StudioPage({
  state,
  studioKey,
  action,
  children,
}: {
  state: ElevateState;
  studioKey: StudioKey;
  action?: ReactNode;
  children: ReactNode;
}) {
  const def = STUDIOS.find((s) => s.key === studioKey)!;

  return (
    <AppShell>
      <header className="mb-6">
        <Link
          href="/elevate"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-sage transition hover:text-snow"
        >
          <span aria-hidden>←</span> Elevate
        </Link>
        <div className="flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-title font-semibold text-snow">
              {def.name}
            </h1>
            <p className="mt-1.5 text-sm text-sage">{def.question}</p>
          </div>
          {action}
        </div>
      </header>

      <nav
        aria-label="Studios"
        className="-mx-5 mb-7 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex gap-2">
          {STUDIOS.map((s) => (
            <li key={s.key} className="shrink-0">
              <Link
                href={s.href}
                aria-current={s.key === studioKey ? "page" : undefined}
                className={`block rounded-full px-3.5 py-1.5 text-caption ring-1 transition ${
                  s.key === studioKey
                    ? "bg-snow/10 text-snow ring-snow/25"
                    : "bg-slope/60 text-sage ring-scree/60 hover:text-snow"
                }`}
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {children}
    </AppShell>
  );
}
