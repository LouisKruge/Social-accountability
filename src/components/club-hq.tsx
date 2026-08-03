import Link from "next/link";
import { AppShell } from "@/components/ui";
import { Counter } from "@/components/dash";
import type { ClimbRoute } from "@/lib/climb";
import { formatPeriod, weekStart } from "@/lib/period";
import { num } from "@/lib/format";

/**
 * CLUB HEADQUARTERS.
 *
 * The club's own standing: level, reputation, records, and last week written
 * out. Everything here is derived from `leaderboard_rankings` — the one table a
 * group can read about each other — so nothing on this screen can expose a
 * number a member chose not to publish.
 *
 * ── WHAT IS NOT HERE, AND WHY ────────────────────────────────────────────────
 * No club treasury. Pooled group money is custody, and custody is the thing
 * blocked on compliance review across the whole product.
 *
 * No "worst" record of any kind. A group's permanent wall is not the place to
 * enshrine somebody's bad month, and a hall of fame with a wall of shame beside
 * it is a group people quietly leave.
 */
export function ClubHq({ route }: { route: ClimbRoute }) {
  const { club, hallOfFame, recap, rivals } = route;

  return (
    <AppShell>
      <header className="mb-block">
        <Link
          href={`/groups/${route.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-sage transition hover:text-snow"
        >
          <span aria-hidden>←</span> {route.name}
        </Link>
        <p className="text-micro uppercase text-sage">Headquarters</p>
        <h1 className="mt-2 text-balance font-display text-display font-semibold text-snow">
          {route.name}
        </h1>
      </header>

      {/* ── Standing ─────────────────────────────────────────────────────── */}
      <section className="mb-chapter">
        <p className="text-micro uppercase text-sage">Club level</p>
        <p className="tnum -ml-1 mt-2 font-display text-hero font-semibold text-snow">
          <Counter value={club.level} />
        </p>
        <p className="mt-3 max-w-[23rem] text-body text-sage">
          {club.toNextLevel === null ? (
            "Top level. There is nothing above this."
          ) : (
            <>
              <span className="tnum text-snow">{num(club.toNextLevel)}</span> more ranked results to
              level {club.level + 1}.
            </>
          )}{" "}
          Levels count <span className="text-snow">results</span>, never members — a club of three
          who have logged for months is further along than twenty who joined yesterday.
        </p>

        <dl className="mt-block flex flex-wrap gap-x-8 gap-y-3 border-t border-scree/60 pt-4">
          <Figure label="Weeks active" value={num(club.activeWeeks)} />
          <Figure label="Climbers" value={num(club.climbers)} />
          <Figure label="Results" value={num(club.totalResults)} />
          {club.reputation !== null && (
            <Figure
              label="Moving forward"
              value={`${Math.round(club.reputation * 100)}%`}
              caption="of all results"
            />
          )}
        </dl>
      </section>

      {/* ── Last week ────────────────────────────────────────────────────── */}
      <section className="mb-chapter border-t border-snow/25">
        <div className="flex items-baseline justify-between gap-4 py-block">
          <h2 className="font-display text-title font-semibold text-snow">Last week</h2>
          {recap.participants > 0 && (
            <span className="shrink-0 text-caption text-sage">
              {recap.participants} ranked
            </span>
          )}
        </div>

        {recap.items.length === 0 ? (
          <p className="border-t border-scree/60 py-5 text-body text-sage">
            Nothing to write up yet. A recap appears once a week has closed with people on the
            board — it is never padded to fill the space.
          </p>
        ) : (
          <ul className="border-t border-scree/60">
            {recap.items.map((item) => (
              <li key={item.kind + item.headline} className="border-b border-scree/40 py-4 last:border-0">
                <p className="text-body text-snow">{item.headline}</p>
                <p className="mt-1 text-caption text-sage">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Records ──────────────────────────────────────────────────────── */}
      {hallOfFame.length > 0 && (
        <section className="mb-chapter border-t border-snow/25">
          <h2 className="py-block font-display text-title font-semibold text-snow">Records</h2>
          <ul className="border-t border-scree/60">
            {hallOfFame.map((e) => (
              <li key={e.title} className="border-b border-scree/40 py-4 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-micro uppercase text-sage">{e.title}</span>
                  <span className="shrink-0 text-body text-snow">{e.holder}</span>
                </div>
                <p className="mt-1.5 text-caption text-sage">{e.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Rivals ───────────────────────────────────────────────────────── */}
      <section className="border-t border-snow/25">
        <h2 className="py-block font-display text-title font-semibold text-snow">Head to head</h2>

        {rivals.length === 0 ? (
          <p className="border-t border-scree/60 py-5 text-body text-sage">
            No head-to-head yet. A record starts the first week you and someone else are both
            ranked on the same pitch.
          </p>
        ) : (
          <ul className="border-t border-scree/60">
            {rivals.map((h) => (
              <li key={h.rivalId} className="border-b border-scree/40 py-4 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-body text-snow">{h.rivalName}</span>
                  <span className="tnum shrink-0 text-body text-snow">
                    {h.yourWins}–{h.theirWins}
                    {h.draws > 0 && `–${h.draws}`}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 text-caption text-sage">
                  <span>
                    {h.metWeeks} {h.metWeeks === 1 ? "week" : "weeks"} met
                  </span>
                  {h.form.length > 0 && <span className="tnum">{h.form.join(" ")}</span>}
                  {h.averageMargin !== null && (
                    <span>
                      {h.averageMargin >= 0 ? "+" : "−"}
                      <span className="tnum">{Math.abs(h.averageMargin)}</span> average margin
                    </span>
                  )}
                  {h.currentlyAhead && (
                    <span className="text-snow">
                      {h.currentlyAhead === "you"
                        ? "ahead this week"
                        : h.currentlyAhead === "them"
                          ? "behind this week"
                          : "level this week"}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="pt-4 text-meta text-sage/70">
          Only weeks where you were both ranked on the same pitch count. A week they did not log is
          an absence, not a win.
        </p>
      </section>

      <p className="mt-chapter text-meta text-sage/70">
        Week of {formatPeriod(periodOf(recap.periodStart))}. Everything
        here comes from the leaderboard your group can already see — no raw numbers, no private
        data.
      </p>
    </AppShell>
  );
}

/** The Monday–Sunday window a recap's period start belongs to. */
function periodOf(start: string): { start: string; end: string } {
  const monday = weekStart(new Date(`${start}T00:00:00Z`));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

function Figure({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div>
      <dt className="text-micro uppercase text-sage">{label}</dt>
      <dd className="tnum mt-1 font-display text-lg text-snow">
        {value}
        {caption && <span className="ml-1.5 font-sans text-caption text-sage">{caption}</span>}
      </dd>
    </div>
  );
}
