import Link from "next/link";
import { AppShell } from "@/components/ui";
import { MiniAscent } from "@/components/ascent";
import { CategoryForm } from "@/app/groups/[id]/category-form";
import { InviteShare } from "@/app/groups/[id]/invite-share";
import type { ClimbPitch, ClimbRoute } from "@/lib/climb";
import { fracOf, num, ordinal } from "@/lib/format";

/**
 * A ROUTE — one group.
 *
 * The old version of this screen was a menu: a card per category with a "Log"
 * button and a "Climb" button, and no indication of what was actually happening
 * inside either. You had to open a leaderboard to find out whether anything had
 * moved.
 *
 * So each pitch now shows its podium in place. The standings ARE the product,
 * and a screen that hides them behind a tap is a table of contents pretending
 * to be a page.
 */
export function ClimbRouteView({
  route,
  siteUrl,
  canAddPitch,
}: {
  route: ClimbRoute;
  siteUrl: string;
  canAddPitch: boolean;
}) {
  return (
    <AppShell>
      <header className="mb-block">
        <Link
          href="/groups"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-sage transition hover:text-snow"
        >
          <span aria-hidden>←</span> The face
        </Link>
        <h1 className="font-display text-title font-semibold text-snow">{route.name}</h1>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 text-body text-sage">
          <Link
            href={`/groups/${route.id}/hq`}
            className="text-snow underline underline-offset-4 transition hover:opacity-80"
          >
            Level {route.club.level}
          </Link>
          <span>
            {route.memberCount} {route.memberCount === 1 ? "climber" : "climbers"}
          </span>
          {route.bestRank !== null && (
            <span>
              best position <span className="tnum text-snow">{ordinal(route.bestRank)}</span>
            </span>
          )}
        </p>
      </header>

      {route.pitches.length === 0 ? (
        <section className="mb-chapter border-t border-snow/25 pt-block">
          <h2 className="font-display text-display font-semibold text-snow">
            Pick what
            <br />
            you&apos;re
            <br />
            climbing
          </h2>
          <p className="mt-3.5 max-w-[22rem] text-body text-sage">
            Steps, savings, debt coming down, or a daily habit. Everyone is ranked on how far they
            move from their own starting point — so nobody is out of it before they begin.
          </p>
        </section>
      ) : (
        route.pitches.map((p) => <PitchBand key={p.id} pitch={p} />)
      )}

      <section className="mb-chapter border-t border-scree/60 pt-block">
        <p className="mb-4 text-micro uppercase text-sage">Bring your people</p>
        <InviteShare groupName={route.name} inviteCode={route.inviteCode} siteUrl={siteUrl} />
      </section>

      <section className="mb-chapter border-t border-scree/60 pt-block">
        <p className="mb-4 text-micro uppercase text-sage">Add a pitch</p>
        {canAddPitch ? (
          <CategoryForm groupId={route.id} />
        ) : (
          <p className="text-body text-sage">
            The free plan carries one pitch per group.{" "}
            <Link href="/billing" className="text-snow underline underline-offset-4">
              Go Premium
            </Link>{" "}
            to climb more than one thing at a time.
          </p>
        )}
      </section>

      <section className="border-t border-scree/60 pt-block">
        <p className="mb-1 text-micro uppercase text-sage">Climbers</p>
        <ul>
          {route.members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between border-b border-scree/40 py-3.5 last:border-0"
            >
              <span className="min-w-0 truncate text-body text-snow">
                {m.displayName}
                {m.isViewer && <span className="text-sage"> · you</span>}
              </span>
              {m.isOwner && <span className="shrink-0 text-micro uppercase text-sage">Owner</span>}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

/**
 * One pitch with its standings in place.
 *
 * Rank reads by BRIGHTNESS, not by hue. Gold means money confirmed as yours and
 * nothing else (design language §2), so the leader here is simply the brightest
 * row and everyone below recedes toward grey — which is a stronger signal than a
 * colour anyway, and survives a monochrome palette without a second accent.
 */
function PitchBand({ pitch: p }: { pitch: ClimbPitch }) {
  const podium = p.rows.slice(0, 3);
  const hidden = p.rows.length - podium.length;

  return (
    <section className="mb-chapter border-t border-snow/25">
      <div className="flex items-baseline justify-between gap-4 py-block">
        <div className="min-w-0">
          <h2 className="truncate font-display text-title font-semibold text-snow">{p.name}</h2>
          <p className="mt-1.5 text-caption text-sage">
            {p.metricType === "streak"
              ? "Longest run wins"
              : p.direction === "decrease"
                ? "Ranked on how far you bring it down"
                : "Ranked on how far you climb"}
            {p.unit && ` · ${p.unit}`}
          </p>
        </div>
        {p.series.length > 1 && (
          <span className="shrink-0">
            <MiniAscent
              values={p.series}
              climbing={p.series[p.series.length - 1] >= p.series[0]}
              width={72}
              height={30}
            />
          </span>
        )}
      </div>

      {p.rows.length === 0 ? (
        <p className="border-t border-scree/60 py-5 text-body text-sage">
          No one has been ranked this week yet.
        </p>
      ) : (
        <ol className="border-t border-scree/60">
          {podium.map((r) => (
            <li
              key={r.userId}
              className="flex items-center gap-3 border-b border-scree/40 py-3.5 last:border-0"
            >
              <span
                className={`tnum w-5 shrink-0 text-caption ${
                  r.rank === 1 ? "text-snow" : "text-sage"
                }`}
              >
                {r.rank}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-body ${
                  r.rank === 1 ? "text-snow" : "text-snow/70"
                }`}
              >
                {r.displayName}
                {r.userId === p.viewer?.userId && <span className="text-sage"> · you</span>}
              </span>
              <span
                className={`tnum shrink-0 text-body ${r.rank === 1 ? "text-snow" : "text-sage"}`}
              >
                {stateValue(r.pctChange, r.isAbsolute, p.metricType)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-center gap-4 pt-4">
        <Link
          href={`/groups/${p.groupId}/categories/${p.id}/log-entry`}
          className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-pill bg-snow px-5 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
        >
          {p.logged ? "Update this week" : "Log this week"}
        </Link>
        <Link
          href={`/groups/${p.groupId}/categories/${p.id}/leaderboard`}
          className="shrink-0 text-body text-sage transition hover:text-snow"
        >
          {hidden > 0 ? `${hidden} more →` : "The climb →"}
        </Link>
      </div>
    </section>
  );
}

function stateValue(value: number, isAbsolute: boolean, metricType: ClimbPitch["metricType"]): string {
  if (metricType === "streak") return `${num(value)}d`;
  return `${value > 0 ? "+" : ""}${num(value, fracOf(value))}${isAbsolute ? "" : "%"}`;
}
