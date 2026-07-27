"use client";

import { useMemo, useState } from "react";
import { ChallengeCard, type ChallengeCardData } from "@/components/commit-cards";
import { EmptyState } from "@/components/ui";
import Link from "next/link";

/**
 * THE MARKET.
 *
 * Sorts are computed from figures the market already publishes — the stake, the
 * headcount, the window, the daily demand. There is deliberately no "highest
 * ROI" or "highest win rate" sort on a challenge that has not run yet: those
 * would be invented numbers dressed as market data. Once challenges have
 * settled, historical completion rates become real and the sorts can grow.
 */
const SORTS = [
  { key: "filling", label: "Filling fastest", hint: "Most people already in" },
  { key: "pool", label: "Biggest pool", hint: "Most money in play" },
  { key: "closing", label: "Closing soonest", hint: "Least time to decide" },
  { key: "cheap", label: "Lowest stake", hint: "Smallest amount at risk" },
  { key: "hard", label: "Hardest", hint: "Steepest daily demand" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const DIFFICULTY_ORDER = { Starter: 0, Steady: 1, Serious: 2, Elite: 3 };

export function MarketView({ open }: { open: ChallengeCardData[] }) {
  const [sort, setSort] = useState<SortKey>("filling");
  const [maxStake, setMaxStake] = useState<number | null>(null);

  const shown = useMemo(() => {
    const filtered = maxStake === null ? open : open.filter((c) => c.stakeAmount <= maxStake);
    const s = [...filtered];
    switch (sort) {
      case "filling":
        return s.sort((a, b) => b.participants - a.participants);
      case "pool":
        return s.sort((a, b) => b.poolTotal - a.poolTotal);
      case "closing":
        return s.sort((a, b) => a.daysRemaining - b.daysRemaining);
      case "cheap":
        return s.sort((a, b) => a.stakeAmount - b.stakeAmount);
      case "hard":
        return s.sort(
          (a, b) => DIFFICULTY_ORDER[b.difficulty] - DIFFICULTY_ORDER[a.difficulty],
        );
    }
  }, [open, sort, maxStake]);

  const scale = Math.max(1, ...shown.map((c) => c.poolTotal));
  const active = SORTS.find((s) => s.key === sort)!;

  return (
    <>
      <div className="-mx-5 mb-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={`shrink-0 rounded-full px-3 py-1.5 text-caption ring-1 transition ${
                sort === s.key
                  ? "bg-ice/12 text-ice ring-ice/30"
                  : "bg-slope/60 text-sage ring-scree/60 hover:text-snow"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-caption text-sage/80">{active.hint}</p>

      <div className="mb-5 flex items-center gap-2">
        <span className="text-caption text-sage">Stake up to</span>
        {[null, 100, 250, 500].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setMaxStake(v)}
            aria-pressed={maxStake === v}
            className={`rounded-full px-2.5 py-1 text-caption ring-1 transition ${
              maxStake === v
                ? "bg-ridge text-snow ring-ice/25"
                : "bg-slope/50 text-sage ring-scree/50 hover:text-snow"
            }`}
          >
            {v === null ? "Any" : `R${v}`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={open.length === 0 ? "Nothing open right now" : "Nothing at that stake"}
          body={
            open.length === 0
              ? "Set a target and a stake, share it with the people who will hold you to it, and it lists here for them to join."
              : "Raise the stake filter, or start a challenge at the amount you want."
          }
          cta={
            <Link
              href="/commit/new"
              className="inline-flex w-full items-center justify-center rounded-field bg-ice px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-ice-soft"
            >
              Start a challenge
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {shown.map((c) => (
            <ChallengeCard key={c.id} c={c} scale={scale} />
          ))}
        </div>
      )}
    </>
  );
}
