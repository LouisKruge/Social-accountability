import { AppShell } from "@/components/ui";

/**
 * LOADING STATES.
 *
 * Next's App Router renders these the instant a link is tapped, while the
 * server is still working. Without them the browser sits on the OLD page with
 * no feedback at all until the whole payload arrives — which is why navigation
 * felt slow even after the queries got faster. Perceived latency is mostly
 * about whether anything acknowledged the tap.
 *
 * They mirror the real layout rather than showing a spinner, so nothing jumps
 * when the content lands, and the page never appears to change shape twice.
 */

function Bar({ w = "100%", h = "1rem", className = "" }: { w?: string; h?: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-field bg-slope ${className}`}
      style={{ width: w, height: h }}
    >
      <div className="absolute inset-0 -translate-x-full animate-sheen bg-gradient-to-r from-transparent via-snow/[0.06] to-transparent" />
    </div>
  );
}

/** A screen with an editorial hero and a list beneath it. */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <AppShell>
      <div role="status" aria-label="Loading" className="animate-pulse-soft">
        <Bar w="7rem" h="0.7rem" />
        <Bar w="9rem" h="2rem" className="mt-3" />

        <div className="mt-chapter">
          <Bar w="10rem" h="0.7rem" />
          <Bar w="80%" h="3rem" className="mt-3" />
          <Bar w="60%" h="1rem" className="mt-4" />
        </div>

        <div className="mt-chapter border-t border-scree/50">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="border-b border-scree/40 py-5">
              <Bar w="4rem" h="0.65rem" />
              <Bar w={`${70 - i * 6}%`} h="1.4rem" className="mt-2.5" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

/** A module screen: header, studio/module rail, then content. */
export function ModuleSkeleton() {
  return (
    <AppShell>
      <div role="status" aria-label="Loading" className="animate-pulse-soft">
        <Bar w="6rem" h="0.7rem" />
        <Bar w="8rem" h="1.9rem" className="mt-3" />
        <Bar w="11rem" h="0.9rem" className="mt-2.5" />

        <div className="mt-block flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bar key={i} w="6.2rem" h="3.4rem" />
          ))}
        </div>

        <div className="mt-block space-y-2.5">
          <Bar h="7rem" />
          <Bar h="7rem" />
          <Bar h="7rem" />
        </div>
      </div>
    </AppShell>
  );
}
