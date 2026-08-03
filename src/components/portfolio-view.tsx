import Link from "next/link";
import { ModulePage } from "@/components/module-shell";
import { AscentLine } from "@/components/ascent";
import type { ExchangeState } from "@/lib/exchange";
import { probabilityPct, type Position, type StrategyResult } from "@/lib/position";
import { fracOf, num, zar } from "@/lib/format";

/**
 * THE PERFORMANCE PORTFOLIO.
 *
 * Each position in full: exposure, pace, strain, volatility, probability,
 * expected return — and the strategy comparison, which is the part that makes
 * this a portfolio tool rather than a progress screen. You can see what
 * different plans would cost you before you pick one.
 */
export function PortfolioView({
  state,
  strategies,
  series,
}: {
  state: ExchangeState;
  strategies: Record<string, StrategyResult[]>;
  series: Record<string, number[]>;
}) {
  const { positions, portfolio } = state;

  return (
    <ModulePage state={state} moduleKey="portfolio">
      {positions.length === 0 ? (
        <section className="mt-block border-t border-snow/25 pt-block">
          <h2 className="max-w-[18rem] font-display text-display font-semibold text-snow">
            Nothing allocated
          </h2>
          <p className="mt-3.5 max-w-[22rem] text-body text-sage">
            A position opens when you stake against terms you have to meet with verified effort.
          </p>
          <Link
            href="/commit/market"
            className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-snow px-7 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
          >
            See the market
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-block border-t border-snow/25 pt-block">
            <p className="text-micro uppercase text-sage">Total exposure</p>
            <p className="tnum -ml-1 mt-2 font-display text-hero font-semibold text-snow">
              {zar(portfolio.exposure)}
            </p>
            {portfolio.criticalCount > 0 && (
              <p className="mt-3 text-body text-sage">
                <span className="tnum text-snow">{portfolio.criticalCount}</span>{" "}
                {portfolio.criticalCount === 1 ? "position is" : "positions are"} far enough behind
                that the remaining days matter more than the ones already spent.
              </p>
            )}
          </section>

          {positions.map((p) => (
            <PositionDetail
              key={p.cohortId}
              position={p}
              strategies={strategies[p.cohortId] ?? []}
              series={series[p.cohortId] ?? []}
            />
          ))}
        </>
      )}
    </ModulePage>
  );
}

function PositionDetail({
  position: p,
  strategies,
  series,
}: {
  position: Position;
  strategies: StrategyResult[];
  series: number[];
}) {
  return (
    <section className="mt-chapter border-t border-snow/25">
      <div className="flex items-baseline justify-between gap-4 py-block">
        <div className="min-w-0">
          <h2 className="truncate font-display text-title font-semibold text-snow">{p.name}</h2>
          <p className="mt-1.5 text-caption text-sage">
            Day <span className="tnum">{p.dayNumber}</span> of {p.totalDays} ·{" "}
            <span className="tnum">{p.daysRemaining}</span> left
          </p>
        </div>
        <p className="tnum shrink-0 font-display text-2xl font-semibold text-snow">
          {zar(p.exposure)}
        </p>
      </div>

      {/* The metrics grid — the position's actual state. */}
      <dl className="grid grid-cols-2 gap-x-gutter border-t border-scree/60">
        <Metric label="Complete" value={`${Math.round(p.completion * 100)}%`} />
        <Metric label="Expected by now" value={`${Math.round(p.expected * 100)}%`} border />
        <Metric label="Your pace" value={`${num(p.velocity)}/day`} top />
        <Metric label="Now needs" value={`${num(p.requiredVelocity)}/day`} border top />
        {p.strain !== null && (
          <Metric label="Strain" value={`${num(p.strain, fracOf(p.strain))}×`} top />
        )}
        {p.volatility && (
          <Metric
            label="Steadiness"
            value={`${p.volatility.steadiness}`}
            caption={p.volatility.label}
            border={p.strain !== null}
            top
          />
        )}
        {p.projection && (
          <Metric label="Probability" value={`${probabilityPct(p.projection.probability)}%`} top />
        )}
        <Metric
          label="If it closes"
          value={zar(p.expectedReturn)}
          border={p.projection !== null}
          top
          gold
        />
      </dl>

      {series.length > 1 && (
        <div className="mt-block">
          <p className="mb-2 text-micro uppercase text-sage">Daily output</p>
          <AscentLine values={series} height={120} label={`Daily output on ${p.name}`} />
        </div>
      )}

      {/* ── Strategy comparison ───────────────────────────────────────────── */}
      {strategies.length > 0 && (
        <div className="mt-block border-t border-scree/60 pt-block">
          <p className="mb-1 text-micro uppercase text-sage">Ways to finish</p>
          <p className="mb-4 max-w-[24rem] text-caption text-sage">
            The same target, distributed differently. Probability comes from your own logged days —
            your average and how much you vary.
          </p>
          <ul>
            {strategies.map((s) => (
              <li key={s.key} className="border-b border-scree/40 py-4 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-snow">{s.name}</span>
                  <span className="tnum shrink-0 text-body text-snow">
                    {s.probability === null ? "—" : `${probabilityPct(s.probability)}%`}
                  </span>
                </div>
                <p className="mt-1 text-caption text-sage">{s.detail}</p>
                <p className="mt-1.5 text-caption text-sage">
                  Hardest day <span className="tnum text-snow">{num(s.peakDay)}</span>
                </p>
                {s.probability !== null && (
                  <div aria-hidden className="mt-2 h-px w-full bg-scree">
                    <div
                      className="h-px bg-snow"
                      style={{ width: `${Math.round(s.probability * 100)}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="pt-4 text-meta text-sage/70">
            Ascend has no calendar, so it cannot know which days are impossible for you. These are
            options to choose between, never a recommendation about your week.
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  caption,
  border,
  top,
  gold,
}: {
  label: string;
  value: string;
  caption?: string;
  border?: boolean;
  top?: boolean;
  gold?: boolean;
}) {
  return (
    <div className={`py-4 ${border ? "border-l border-scree/60 pl-5" : "pr-3"} ${top ? "border-t border-scree/60" : ""}`}>
      <dt className="text-micro uppercase text-sage">{label}</dt>
      <dd className={`tnum mt-1.5 font-display text-lg leading-none ${gold ? "text-summit" : "text-snow"}`}>
        {value}
        {caption && <span className="ml-1.5 font-sans text-caption text-sage">{caption}</span>}
      </dd>
    </div>
  );
}
