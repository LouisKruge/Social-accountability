"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Counter, ProgressRing, StatTile, DayBars } from "./dash";
import { Pool } from "./pool";
import type { Achievement, BoardRow, HistoryItem } from "@/lib/commitDashboard";
import { num, zar } from "@/lib/format";

/**
 * The challenge mark — a stair whose rise IS the difficulty.
 *
 * It used to be an icon guessed from a substring of the challenge's name, which
 * gave two unrelated challenges the same mark and told the reader nothing.
 * `habit_type` is constrained to 'steps' in the schema, so an activity icon
 * would be speculative anyway. A stair that gets steeper as the daily demand
 * rises carries real information, derived from the terms on the card.
 */
function ChallengeGlyph({ difficulty }: { difficulty: ChallengeCardData["difficulty"] }) {
  const treads = { Starter: 2, Steady: 3, Serious: 4, Elite: 5 }[difficulty];
  const stroke = {
    Starter: "#8A9A90",
    Steady: "#7FDCC0",
    Serious: "#F3F1EA",
    Elite: "#E06D5A",
  }[difficulty];

  // One stair, drawn bottom-left to top-right, with `treads` steps in it.
  const span = 16 / treads;
  let d = `M 4 20`;
  for (let i = 0; i < treads; i += 1) {
    d += ` v -${span.toFixed(2)} h ${span.toFixed(2)}`;
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface ChallengeCardData {
  id: string;
  name: string;
  difficulty: "Starter" | "Steady" | "Serious" | "Elite";
  targetLabel: string;
  stakeAmount: number;
  participants: number;
  poolTotal: number;
  daysRemaining: number;
  completionRate: number | null;
  /** Estimated return per winner at the current pool and completion rate. */
  projectedReturn: number | null;
  joined: boolean;
  trend?: "most-joined" | "highest-paying" | "fastest-growing";
}

// A difficulty ramp that never reaches gold. Gold on this page means money that
// has actually been paid to you, and "Elite" is not money.
const DIFFICULTY: Record<ChallengeCardData["difficulty"], string> = {
  Starter: "bg-ridge text-sage ring-scree",
  Steady: "bg-ice/10 text-ice ring-ice/20",
  Serious: "bg-snow/10 text-snow ring-snow/20",
  Elite: "bg-fall/10 text-fall ring-fall/25",
};

const TREND_LABEL: Record<NonNullable<ChallengeCardData["trend"]>, string> = {
  "most-joined": "Most joined",
  "highest-paying": "Highest paying",
  "fastest-growing": "Filling fast",
};

/**
 * A challenge, presented like a market: what it costs, what it pays, how full
 * it is, how long is left. Every figure is real — the projected return is
 * labelled as an estimate because it moves with the pool, and it is never
 * rendered in gold, because gold means confirmed.
 */
export function ChallengeCard({
  c,
  /**
   * The biggest pool on screen. The vessels are scaled against each other, so
   * "fuller" means "more money in it than the others" — a real comparison. An
   * invented capacity (say, twenty seats) made the largest pool look emptiest.
   */
  scale,
}: {
  c: ChallengeCardData;
  scale: number;
}) {
  const reduce = useReducedMotion();

  return (
    // Animated on mount, deliberately NOT on scroll. A figure someone has money
    // riding on must never be waiting on an IntersectionObserver to become
    // readable.
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.4 }}
    >
      <Link href={`/commit/${c.id}`} className="block">
        <article className="group relative overflow-hidden rounded-card bg-slope p-5 ring-1 ring-scree/70 transition hover:bg-ridge hover:ring-ice/25">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(ellipse_at_top,rgba(127,220,192,0.10),transparent_70%)]"
          />

          <div className="relative">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.8rem] bg-valley ring-1 ring-scree"
              >
                <ChallengeGlyph difficulty={c.difficulty} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-display text-base font-semibold tracking-tight text-snow">
                    {c.name}
                  </p>
                  {c.trend && (
                    <span className="shrink-0 rounded-full bg-ice/10 px-2.5 py-1 text-[0.62rem] font-medium text-ice ring-1 ring-ice/20">
                      {TREND_LABEL[c.trend]}
                    </span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-medium ring-1 ${DIFFICULTY[c.difficulty]}`}
                  >
                    {c.difficulty}
                  </span>
                  <span className="tnum min-w-0 truncate text-xs text-sage">{c.targetLabel}</span>
                </p>
              </div>
            </div>

            {/* The pool, with the figures beside it — never instead of them.
                A brand-new challenge has an empty vessel, which is three-quarters
                of dead space saying nothing; say it in words instead. */}
            <div className="mt-4">
              {c.participants === 0 ? (
                <p className="rounded-field bg-valley/70 px-4 py-2.5 text-center text-xs text-sage ring-1 ring-scree/70">
                  Nobody&apos;s staked yet — be the first in
                </p>
              ) : (
                <Pool
                  filled={c.poolTotal}
                  capacity={Math.max(scale, c.poolTotal)}
                  participants={c.participants}
                  height={62}
                />
              )}
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[0.6rem] uppercase tracking-wider text-sage">Pool</dt>
                <dd className="tnum mt-0.5 text-sm text-snow">
                  <Counter value={c.poolTotal} prefix="R" />
                </dd>
              </div>
              <div>
                <dt className="text-[0.6rem] uppercase tracking-wider text-sage">In</dt>
                <dd className="tnum mt-0.5 text-sm text-snow">
                  <Counter value={c.participants} />
                </dd>
              </div>
              <div>
                <dt className="text-[0.6rem] uppercase tracking-wider text-sage">Stake</dt>
                <dd className="tnum mt-0.5 text-sm text-snow">{zar(c.stakeAmount)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-scree/50 pt-3.5">
              <div className="min-w-0">
                {c.projectedReturn !== null ? (
                  <p className="truncate text-xs text-sage">
                    Payout{" "}
                    <span className="tnum text-snow">{zar(c.projectedReturn)}</span>
                    <span className="text-sage/70"> each, if you finish</span>
                  </p>
                ) : (
                  <p className="text-xs text-sage">Payout depends on how many finish</p>
                )}
                <p className="tnum mt-0.5 text-[0.68rem] text-sage">
                  {c.daysRemaining > 0 ? `Closes in ${c.daysRemaining}d` : "Closing today"}
                  {c.completionRate !== null && ` · ${Math.round(c.completionRate * 100)}% finish`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-field px-4 py-2.5 text-xs font-semibold transition ${
                  c.joined
                    ? "bg-ridge text-snow ring-1 ring-scree"
                    : "bg-ice text-valley group-hover:bg-ice-soft"
                }`}
              >
                {c.joined ? "View" : "Join"}
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

export interface ActiveBetData {
  cohortId: string;
  name: string;
  stake: number;
  progress: number;
  target: number;
  dayNumber: number;
  totalDays: number;
  daysRemaining: number;
  rank: number;
  cohortSize: number;
  streak: number;
  projectedPayout: number | null;
  poolTotal: number;
  participants: number;
  recentDays: { label: string; value: number }[];
  dailyTarget: number;
}

/**
 * MY ACTIVE BET — the centrepiece.
 *
 * Answers, in one card: how far am I, how much of mine is on the line, what do
 * I get if I finish, how many days left, am I on pace. "On pace" is arithmetic
 * (required daily rate vs actual), not a prediction dressed up as one.
 */
export function ActiveBet({ b }: { b: ActiveBetData }) {
  const ratio = b.target > 0 ? b.progress / b.target : 0;
  const remaining = Math.max(0, b.target - b.progress);
  const neededPerDay = b.daysRemaining > 0 ? remaining / b.daysRemaining : remaining;
  const paceSoFar = b.dayNumber > 0 ? b.progress / b.dayNumber : 0;
  const onPace = paceSoFar >= neededPerDay || remaining === 0;

  return (
    <article className="relative overflow-hidden rounded-card bg-slope p-5 ring-1 ring-ice/20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-28 h-48 bg-[radial-gradient(ellipse_at_top,rgba(127,220,192,0.16),transparent_70%)]"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-sage">Your live bet</p>
            <p className="mt-1 truncate font-display text-xl font-semibold tracking-tight text-snow">
              {b.name}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.62rem] font-medium ring-1 ${
              onPace
                ? "bg-ice/10 text-ice ring-ice/25"
                : "bg-fall/10 text-fall ring-fall/25"
            }`}
          >
            {onPace ? "On pace" : "Behind pace"}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-5">
          <ProgressRing ratio={ratio}>
            <div>
              <p className="tnum font-display text-2xl font-semibold leading-none text-snow">
                <Counter value={Math.round(ratio * 100)} suffix="%" />
              </p>
              <p className="mt-1 text-[0.6rem] uppercase tracking-wider text-sage">done</p>
            </div>
          </ProgressRing>

          <dl className="flex-1 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-sage">Your total</dt>
              <dd className="tnum text-sm text-snow">
                <Counter value={b.progress} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-sage">Target</dt>
              <dd className="tnum text-sm text-snow/80">{num(b.target)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-sage">Still needed</dt>
              <dd className="tnum text-sm text-snow">{num(remaining)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-sage">Per day to finish</dt>
              <dd className={`tnum text-sm ${onPace ? "text-ice" : "text-fall"}`}>
                {num(neededPerDay)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <StatTile label="At stake">{zar(b.stake)}</StatTile>
          <StatTile label="Est. payout" tone="default" hint="Moves with the pool">
            {b.projectedPayout !== null ? zar(b.projectedPayout) : "—"}
          </StatTile>
          <StatTile label="Days left" tone="cool">
            {b.daysRemaining}
          </StatTile>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile label="Cohort rank">
            {b.rank}
            <span className="text-sm text-sage">/{b.cohortSize}</span>
          </StatTile>
          <StatTile label="Streak" tone="cool">
            {b.streak}
            <span className="text-sm text-sage">d</span>
          </StatTile>
          <StatTile label="Day">
            {b.dayNumber}
            <span className="text-sm text-sage">/{b.totalDays}</span>
          </StatTile>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[0.62rem] uppercase tracking-[0.14em] text-sage">
            Last {b.recentDays.length} days · target {num(b.dailyTarget)}/day
          </p>
          <DayBars days={b.recentDays} target={b.dailyTarget} />
        </div>

        <Link
          href={`/commit/${b.cohortId}`}
          className="mt-5 flex w-full items-center justify-center rounded-field bg-ice px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-ice-soft"
        >
          Log today&apos;s steps
        </Link>
      </div>
    </article>
  );
}

/**
 * STANDINGS — ranked by verified effort, and by nothing else.
 *
 * There is no "top earners" board in Commit and there never will be: one
 * person's stake is not another person's business. What everybody in a cohort
 * can already see is how far each of them has walked, so that is what competes.
 */
export function Standings({
  rows,
  unit = "steps",
  limit = 5,
}: {
  rows: BoardRow[];
  unit?: string;
  limit?: number;
}) {
  const reduce = useReducedMotion();
  const top = rows.slice(0, limit);
  const me = rows.find((r) => r.isMe);
  const meBelow = me && !top.some((r) => r.isMe) ? me : null;

  return (
    <ol className="space-y-1.5">
      {[...top, ...(meBelow ? [meBelow] : [])].map((r, i) => {
        const lead = r.rank === 1;
        const gap = meBelow && i === top.length;
        return (
          <li key={r.userId}>
            {gap && (
              <p aria-hidden className="py-1 text-center text-sage/60">
                ···
              </p>
            )}
            <div
              className={`relative flex items-center gap-3 overflow-hidden rounded-card px-4 py-3 ${
                lead ? "bg-slope ring-1 ring-ice/25" : "bg-slope/60"
              }`}
            >
              {r.isMe && (
                <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-ice" />
              )}
              <span
                className={`tnum w-5 shrink-0 text-center text-sm ${lead ? "text-snow" : "text-sage"}`}
              >
                {r.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-snow/90">
                {r.name}
                {r.isMe && <span className="text-sage"> · you</span>}
              </span>
              {/* how much of their OWN target they covered — comparable across
                  people starting from very different places */}
              <span className="hidden w-24 shrink-0 items-center gap-1.5 min-[360px]:flex">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-valley">
                  <motion.span
                    className={`block h-full rounded-full ${r.hitTarget ? "bg-ice" : "bg-ice/50"}`}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${Math.max(3, Math.min(100, r.pct * 100))}%` }}
                    transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : i * 0.05 }}
                  />
                </span>
                <span className="tnum w-8 text-right text-[0.68rem] text-sage">
                  {Math.round(r.pct * 100)}%
                </span>
              </span>
              <span className="tnum w-16 shrink-0 text-right text-sm text-snow">
                {num(r.progress)}
              </span>
            </div>
          </li>
        );
      })}
      <li className="pt-1 text-center text-[0.68rem] text-sage/70">
        Ranked on {unit}. Nobody can see anybody&apos;s stake, including yours.
      </li>
    </ol>
  );
}

/** Badges, each with the real distance still to run. Locked ones stay legible. */
export function Achievements({ items }: { items: Achievement[] }) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid grid-cols-2 gap-2">
      {items.map((a, i) => (
        <motion.li
          key={a.key}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : Math.min(i, 5) * 0.04 }}
          className={`rounded-field p-3 ring-1 ${
            a.unlocked ? "bg-slope ring-ice/25" : "bg-valley/60 ring-scree/70"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-[0.8rem] font-medium leading-tight ${
                a.unlocked ? "text-snow" : "text-sage"
              }`}
            >
              {a.label}
            </p>
            {a.unlocked && (
              <span aria-label="unlocked" className="shrink-0 text-ice">
                ✓
              </span>
            )}
          </div>
          <p className="mt-1 text-[0.65rem] leading-tight text-sage/80">{a.detail}</p>
          {!a.unlocked && (
            <span className="mt-2 block h-0.5 overflow-hidden rounded-full bg-scree/60">
              <span
                className="block h-full rounded-full bg-ice/70"
                style={{ width: `${Math.max(2, a.progress * 100)}%` }}
              />
            </span>
          )}
        </motion.li>
      ))}
    </ul>
  );
}

/** A finished challenge: what you did, and what came back. */
export function HistoryRow({ h }: { h: HistoryItem }) {
  const paid = h.payoutStatus === "paid";
  return (
    <li className="flex items-center gap-3 rounded-card bg-slope/60 px-4 py-3.5">
      <span
        aria-hidden
        className={`h-8 w-1 shrink-0 rounded-full ${h.hitTarget ? "bg-ice" : "bg-scree"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-snow/90">{h.name}</p>
        <p className="tnum mt-0.5 text-[0.68rem] text-sage">
          {num(h.progress)} of {num(h.target)} ·{" "}
          {new Date(h.endDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[0.7rem] ${h.hitTarget ? "text-ice" : "text-sage"}`}>
          {h.hitTarget ? "Target hit" : "Missed"}
        </p>
        {h.payout !== null && (
          // Gold only once it has actually been paid.
          <p className={`tnum text-sm ${paid ? "text-summit" : "text-sage"}`}>
            {paid ? "" : "+"}
            {zar(h.payout)}
            {!paid && <span className="text-[0.65rem]"> pending</span>}
          </p>
        )}
      </div>
    </li>
  );
}
