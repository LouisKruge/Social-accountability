import Link from "next/link";
import { AppShell, Brand } from "@/components/ui";

/** Hub markup with fixed data, for design review without a database. */
export function HubPreview() {
  const cards = [
    {
      href: "/groups", eyebrow: "Self improvement", title: "Climb",
      body: "Private groups ranked on how fast you improve — savings, debt, steps, habits.",
      status: "#3 this week · +23.4%", accent: "text-ice", ring: "ring-ice/25", glow: "rgba(127,220,192,0.13)",
    },
    {
      href: "/commit", eyebrow: "Bet on yourself", title: "Commit",
      body: "Put money on a 30-day target. Hit it and you share the pool with the others who did.",
      status: "1 active challenge", accent: "text-ice", ring: "ring-ice/20", glow: "rgba(127,220,192,0.10)",
    },
    {
      href: "/elevate", eyebrow: "Coaching", title: "Elevate",
      body: "A private styling, grooming and photo review of your own photos, for a goal you set.",
      status: "Your report is ready", accent: "text-snow", ring: "ring-scree", glow: "rgba(243,241,234,0.08)",
    },
  ];
  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-4">
          <span className="text-sm text-sage">You</span>
        </div>
      </div>
      <header className="mb-7">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tightest text-snow">
          Hi Kabelo.
        </h1>
        <p className="mt-2 text-sm text-sage">Where are you climbing today?</p>
      </header>
      <div className="space-y-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="block">
            <article className={`relative overflow-hidden rounded-card bg-slope p-5 ring-1 transition hover:bg-ridge ${c.ring}`}>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-20 h-32"
                style={{ background: `radial-gradient(ellipse at top, ${c.glow}, transparent 70%)` }} />
              <div className="relative">
                <p className="text-[0.7rem] uppercase tracking-[0.16em] text-sage">{c.eyebrow}</p>
                <h2 className={`mt-1.5 font-display text-2xl font-semibold tracking-tightest ${c.accent}`}>{c.title}</h2>
                <p className="mt-2 max-w-[24rem] text-sm leading-relaxed text-sage">{c.body}</p>
                <p className="mt-4 flex items-center gap-2 text-sm text-snow/90">
                  <span>{c.status}</span><span aria-hidden className="text-sage">→</span>
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
