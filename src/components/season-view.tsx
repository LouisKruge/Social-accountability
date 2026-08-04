import Link from "next/link";
import { AppShell } from "@/components/ui";
import { Counter } from "@/components/dash";
import type { LifeOs } from "@/lib/lifeOs";
import type { AwardedTrophy, Rarity } from "@/lib/trophies";
import { PRESTIGE_THRESHOLD } from "@/lib/season";
import { num } from "@/lib/format";

/**
 * THE SEASON — Layer 5 made visible.
 *
 * The season window, prestige, the vault, and the recovery protocol when it is
 * engaged. Everything derived: a season is 90 days from a fixed epoch, prestige
 * is a count of seasons finished above the line, a trophy is a rule evaluated
 * against a real record.
 *
 * ── THE RECOVERY PANEL COMES FIRST WHEN IT IS ACTIVE ─────────────────────────
 * Somebody four days into a gap does not need their trophy shelf. They need one
 * small thing they can do today, and the shelf can wait until they are back.
 */
export function SeasonView({ os }: { os: LifeOs }) {
  const { season, seasonResult: result, prestige, trophies, vault, recovery } = os;
  const earned = trophies.filter((t) => t.earned);
  const chasing = trophies.filter((t) => !t.earned).sort((a, b) => b.progress - a.progress);

  return (
    <AppShell>
      <header className="mb-block flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">Season {season.number}</p>
          <h1 className="font-display text-title font-semibold text-snow">{prestige.title}</h1>
        </div>
        <Link href="/os" className="shrink-0 text-xs text-sage transition hover:text-snow">
          Discipline
        </Link>
      </header>

      {/* ── Recovery, when it is engaged ─────────────────────────────────── */}
      {recovery.active && (
        <section className="mb-chapter rounded-field bg-ridge px-5 py-5 ring-1 ring-scree">
          <p className="text-micro uppercase text-sage">Recovery</p>
          <p className="mt-2 max-w-[22rem] text-lead text-snow">{recovery.headline}</p>
          <ul className="mt-4 space-y-2.5">
            {recovery.steps.map((s) => (
              <li key={s} className="flex gap-3">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sage" />
                <span className="text-body text-sage">{s}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-meta text-sage/70">
            Nobody has been told. This is between you and the app.
          </p>
        </section>
      )}

      {/* ── The season ───────────────────────────────────────────────────── */}
      <section className="mb-chapter">
        <p className="text-micro uppercase text-sage">Days left in the season</p>
        <p className="tnum -ml-1 mt-2 font-display text-hero font-semibold text-snow">
          <Counter value={season.daysRemaining} />
        </p>
        <p className="mt-3 max-w-[23rem] text-body text-sage">
          Season {season.number} closes on{" "}
          {new Date(`${season.end}T00:00:00Z`).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
          . It qualifies toward prestige if you finish above{" "}
          <span className="tnum text-snow">{PRESTIGE_THRESHOLD}</span> having measured at least 30
          days.
        </p>

        <div aria-hidden className="mt-block h-px w-full bg-scree">
          <div
            className="h-px bg-snow transition-[width] duration-500 ease-ascend"
            style={{ width: `${Math.round(season.progress * 100)}%` }}
          />
        </div>

        <dl className="mt-block flex flex-wrap gap-x-8 gap-y-3 border-t border-scree/60 pt-4">
          {result.closingScore !== null ? (
            <>
              <Figure label="Now" value={num(result.closingScore)} />
              {result.peakScore !== null && <Figure label="Peak" value={num(result.peakScore)} />}
              <Figure label="Measured" value={`${result.daysMeasured}`} caption="days" />
              <Figure
                label="Qualifying"
                value={result.qualified ? "Yes" : "Not yet"}
                gold={result.qualified}
              />
            </>
          ) : (
            <Figure label="Measured" value="0" caption="days this season" />
          )}
        </dl>
      </section>

      {/* ── Prestige ─────────────────────────────────────────────────────── */}
      <section className="mb-chapter border-t border-snow/25">
        <div className="flex items-baseline justify-between gap-4 py-block">
          <h2 className="font-display text-title font-semibold text-snow">Prestige</h2>
          <span className="tnum shrink-0 text-body text-sage">Level {prestige.level}</span>
        </div>
        <p className="border-t border-scree/60 pt-4 text-body text-sage">
          {prestige.qualifyingSeasons === 0 ? (
            <>
              No season finished above the line yet. Prestige is the one thing here that cannot be
              bought — the only way to it is a season you actually completed.
            </>
          ) : (
            <>
              <span className="tnum text-snow">{prestige.qualifyingSeasons}</span>{" "}
              {prestige.qualifyingSeasons === 1 ? "season" : "seasons"} finished above{" "}
              {PRESTIGE_THRESHOLD}.
              {prestige.next && (
                <>
                  {" "}
                  One more makes you <span className="text-snow">{prestige.next.title}</span>.
                </>
              )}
            </>
          )}
        </p>
        <p className="pt-4 text-meta text-sage/70">
          Season standings reset. Your Discipline Score, momentum, wallet history and integrity
          record do not — a product that wipes your record every quarter has told you the first two
          years did not count.
        </p>
      </section>

      {/* ── The vault ────────────────────────────────────────────────────── */}
      <section className="border-t border-snow/25">
        <div className="flex items-baseline justify-between gap-4 py-block">
          <h2 className="font-display text-title font-semibold text-snow">The vault</h2>
          <span className="tnum shrink-0 text-body text-sage">
            {vault.earned}/{vault.total}
          </span>
        </div>

        {earned.length > 0 && (
          <ul className="border-t border-scree/60">
            {earned.map((t) => (
              <TrophyRow key={t.key} trophy={t} />
            ))}
          </ul>
        )}

        {chasing.length > 0 && (
          <>
            <p className="pt-block text-micro uppercase text-sage">
              {earned.length > 0 ? "Still to earn" : "How the vault fills"}
            </p>
            <ul className="mt-3 border-t border-scree/60">
              {chasing.map((t) => (
                <TrophyRow key={t.key} trophy={t} />
              ))}
            </ul>
          </>
        )}

        <p className="pt-4 text-meta text-sage/70">
          Rarity describes how hard the requirement is, never a random draw. Nothing in Ascend is
          decided by chance.
        </p>
      </section>
    </AppShell>
  );
}

/**
 * One trophy.
 *
 * Rarity reads by brightness, because gold means money confirmed as yours and a
 * trophy is not money. A legendary trophy is simply the brightest line.
 */
function TrophyRow({ trophy: t }: { trophy: AwardedTrophy }) {
  return (
    <li className="border-b border-scree/40 py-4 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`min-w-0 flex-1 text-body ${t.earned ? RARITY_TONE[t.rarity] : "text-sage"}`}>
          {t.name}
        </span>
        <span className="shrink-0 text-micro uppercase text-sage">{t.rarity}</span>
      </div>
      <p className="mt-1 text-caption text-sage">{t.earned ? t.evidence : t.requirement}</p>
      {!t.earned && t.progress > 0 && (
        <>
          <div aria-hidden className="mt-2 h-px w-full bg-scree">
            <div className="h-px bg-snow/60" style={{ width: `${Math.round(t.progress * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-micro uppercase text-sage/70">{t.evidence}</p>
        </>
      )}
    </li>
  );
}

const RARITY_TONE: Record<Rarity, string> = {
  common: "text-snow/70",
  rare: "text-snow/85",
  elite: "text-snow",
  legendary: "text-snow font-semibold",
};

function Figure({
  label,
  value,
  caption,
  gold,
}: {
  label: string;
  value: string;
  caption?: string;
  gold?: boolean;
}) {
  return (
    <div>
      <dt className="text-micro uppercase text-sage">{label}</dt>
      <dd className={`tnum mt-1 font-display text-lg ${gold ? "text-summit" : "text-snow"}`}>
        {value}
        {caption && <span className="ml-1.5 font-sans text-caption text-sage">{caption}</span>}
      </dd>
    </div>
  );
}
