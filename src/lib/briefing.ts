import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { loadClimb, type ClimbState } from "@/lib/climb";
import { loadExchange, type ExchangeState } from "@/lib/exchange";
import { loadElevate, type ElevateState } from "@/lib/elevate";
import { deriveSignals, effortDays, integrityDays } from "@/lib/lifeOs";
import { disciplineScore, momentumScore, statusTier, type DisciplineScore, type Tier } from "@/lib/intelligence";
import { withTiming, type TimingReport } from "@/lib/timing";
import { fracOf, num, zar } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// THE BRIEFING — one surface across all three modes.
//
// The brief asked for a living ecosystem where "every module communicates with
// every other module":
//
//     Commit → Wallet → Analytics → AI Coach → Achievements → Groups → …
//
// ── HOW THAT IS DONE, AND HOW IT IS DELIBERATELY NOT DONE ────────────────────
// It is composed in the APPLICATION layer, not in the database. Each mode's own
// loader runs independently against its own tables, and this file arranges the
// three results. There is no cross-feature join, no shared view, and no table
// that reads another mode's rows.
//
// That is a hard constraint, not a shortcut. Elevate holds photographs of a
// person's face; Commit holds what they staked and what they were paid. A view
// or a join that spans them turns one RLS mistake into a breach of both at
// once, and makes every future policy change a question about two products
// instead of one. `profiles.id` is the only thing they share, and it stays that
// way.
//
// ── THE ORDER IS THE PRODUCT ─────────────────────────────────────────────────
// Items are ranked by what it COSTS THE USER not to know, in this order:
//
//   1. money blocked on them                  (a payout waiting on bank details)
//   2. money at risk today                    (behind pace with a stake on it)
//   3. a commitment with a deadline           (a week that has not been logged)
//   4. something finished and waiting         (a report that is ready)
//   5. the single best next step              (only when nothing above applies)
//
// ── WHY THERE IS NO GENERATED PROSE HERE ─────────────────────────────────────
// "AI Daily Briefing" in the brief. This one is rule-based, and that is the
// correct engineering answer rather than a limitation: every sentence on this
// screen is derived arithmetically from a row the user owns, so it cannot
// hallucinate a figure about somebody's money. A model is used in this codebase
// where judgement is genuinely needed — reading a photograph — and not where
// arithmetic already knows the answer. See docs/AI_OPERATING_SYSTEM.md §2.
//
// When there is nothing to say, this returns an empty list and the screen says
// so. It never manufactures urgency to look alive.
// ─────────────────────────────────────────────────────────────────────────────

export type BriefingMode = "climb" | "commit" | "elevate";

export interface BriefingItem {
  id: string;
  mode: BriefingMode;
  /** One sentence, in the second person, stating what is true. */
  text: string;
  href: string;
  /** Lower sorts first. See the ordering note above. */
  priority: number;
  /** `blocked` means it cannot proceed without the user. */
  kind: "blocked" | "at_risk" | "due" | "ready" | "next";
}

export interface ModeSummary {
  mode: BriefingMode;
  name: string;
  href: string;
  /** The one figure for this mode, or null when there is nothing yet. */
  value: string | null;
  caption: string;
}

export interface Briefing {
  greeting: string | null;
  items: BriefingItem[];
  modes: ModeSummary[];
  /**
   * The same Discipline Score the Life OS shows, computed from the states this
   * loader already has. Pure arithmetic, so it costs no extra query — and
   * computing it here rather than re-deriving it another way is what stops the
   * two screens from ever disagreeing about a person's own number.
   */
  discipline: DisciplineScore;
  tier: Tier | null;
  climb: ClimbState;
  commit: ExchangeState;
  elevate: ElevateState;
  timing: TimingReport;
}

/**
 * Build the ordered list from three already-loaded mode states.
 *
 * Pure, so the ordering rules can be tested without a database — which matters
 * because the ordering IS the feature.
 */
export function buildItems(
  climb: ClimbState,
  commit: ExchangeState,
  elevate: ElevateState,
): BriefingItem[] {
  const items: BriefingItem[] = [];

  // 1 — money blocked on the user.
  const needsBank = commit.wallet.payouts.find((p) => p.needsUser);
  if (needsBank) {
    items.push({
      id: "payout-blocked",
      mode: "commit",
      text: `${zar(needsBank.amount)} is waiting on your bank details.`,
      href: "/commit/wallet/bank",
      priority: 10,
      kind: "blocked",
    });
  }

  if (commit.wallet.positions.awaitingEft > 0) {
    items.push({
      id: "eft-outstanding",
      mode: "commit",
      text: `${zar(commit.wallet.positions.awaitingEft)} of your stake has not reached us yet.`,
      href: "/commit/wallet",
      priority: 11,
      kind: "blocked",
    });
  }

  // 2 — money at risk today. Behind pace with rand on the line.
  for (const a of commit.dashboard.active) {
    const remaining = Math.max(0, a.target - a.progress);
    if (remaining === 0) continue;
    const needed = a.daysRemaining > 0 ? remaining / a.daysRemaining : remaining;
    const pace = a.dayNumber > 0 ? a.progress / a.dayNumber : 0;
    if (pace >= needed) continue;
    items.push({
      id: `at-risk-${a.cohortId}`,
      mode: "commit",
      text: `${num(Math.round(needed))} a day for ${a.daysRemaining} days to save your ${zar(a.stake)} in ${a.name}.`,
      href: `/commit/${a.cohortId}`,
      priority: 20,
      kind: "at_risk",
    });
  }

  // 3 — a week that has not been logged. One item, not one per pitch: a list of
  // six identical rows is a chore list, and a person with six pitches has
  // already understood the situation from the first sentence.
  if (climb.pending.length > 0) {
    const first = climb.pending[0];
    items.push({
      id: "climb-pending",
      mode: "climb",
      text:
        climb.pending.length === 1
          ? `${first.pitchName} in ${first.routeName} has no number this week.`
          : `${climb.pending.length} pitches have no number this week.`,
      href: `/groups/${first.routeId}/categories/${first.pitchId}/log-entry`,
      priority: 30,
      kind: "due",
    });
  }

  // 4 — finished and waiting.
  const ready = elevate.actions.filter((a) => a.status === "open").length;
  if (elevate.reportCount > 0 && ready > 0) {
    items.push({
      id: "elevate-actions",
      mode: "elevate",
      text: `${ready} coaching ${ready === 1 ? "action is" : "actions are"} waiting for you.`,
      href: "/elevate/confidence",
      priority: 40,
      kind: "ready",
    });
  }

  // 5 — the best next step, only when nothing above needs the user.
  if (items.length === 0) {
    if (climb.routes.length === 0) {
      items.push({
        id: "next-climb",
        mode: "climb",
        text: "Start a group and put your first week on the board.",
        href: "/groups",
        priority: 90,
        kind: "next",
      });
    } else if (commit.dashboard.active.length === 0 && commit.dashboard.open.length > 0) {
      const cheapest = commit.dashboard.open.reduce((lo, c) =>
        c.stakeAmount < lo.stakeAmount ? c : lo,
      );
      items.push({
        id: "next-commit",
        mode: "commit",
        text: `${commit.dashboard.open.length} ${commit.dashboard.open.length === 1 ? "challenge is" : "challenges are"} open, from ${zar(cheapest.stakeAmount)}.`,
        href: "/commit/market",
        priority: 91,
        kind: "next",
      });
    } else if (elevate.nextStep) {
      items.push({
        id: "next-elevate",
        mode: "elevate",
        text: elevate.nextStep.text,
        href: elevate.nextStep.href,
        priority: 92,
        kind: "next",
      });
    }
  }

  return items.sort((a, b) => a.priority - b.priority);
}

/** The one figure per mode, for the index beneath the briefing. */
export function buildModes(
  climb: ClimbState,
  commit: ExchangeState,
  elevate: ElevateState,
): ModeSummary[] {
  const best = climb.best;

  return [
    {
      mode: "climb",
      name: "Climb",
      href: "/groups",
      value: best
        ? best.metricType === "streak"
          ? `${num(best.value)}d`
          : `${best.value > 0 ? "+" : ""}${num(best.value, fracOf(best.value))}${best.isAbsolute ? "" : "%"}`
        : null,
      caption: best
        ? `${best.pitchName} · ${climb.routes.length} ${climb.routes.length === 1 ? "route" : "routes"}`
        : climb.routes.length > 0
          ? "Nothing ranked yet"
          : "No route yet",
    },
    {
      mode: "commit",
      name: "Commit",
      href: "/commit",
      value: commit.dashboard.active.length ? zar(commit.wallet.positions.locked) : null,
      caption: commit.dashboard.active.length
        ? `on the line · ${commit.dashboard.active.length} open`
        : commit.dashboard.open.length
          ? `${commit.dashboard.open.length} open to join`
          : "Nothing on the line",
    },
    {
      mode: "elevate",
      name: "Elevate",
      href: "/elevate",
      value: elevate.reportCount > 0 ? String(elevate.reportCount) : null,
      caption:
        elevate.reportCount > 0
          ? `${elevate.reportCount === 1 ? "review" : "reviews"} · ${elevate.wardrobeStats.total} in wardrobe`
          : "No review yet",
    },
  ];
}

/**
 * Load all three modes and compose the briefing.
 *
 * The three loaders run concurrently — they touch disjoint tables, so there is
 * nothing to serialise. `withTiming` scopes the spans to this request so the
 * report is exactly this page's work and nothing inherited from a warm
 * container.
 */
export async function loadBriefing(
  supabase: ServerClient,
  userId: string,
  displayName?: string | null,
): Promise<Briefing> {
  const { result, timing } = await withTiming(async () => {
    const [climb, commit, elevate] = await Promise.all([
      loadClimb(supabase, userId),
      loadExchange(supabase, userId),
      loadElevate(supabase, userId),
    ]);
    return { climb, commit, elevate };
  });

  const { climb, commit, elevate } = result;

  const effort = effortDays(commit);
  const discipline = disciplineScore(
    deriveSignals(climb, commit, effort, integrityDays(commit), momentumScore(effort)),
  );

  return {
    greeting: displayName ? displayName.trim().split(/\s+/)[0] : null,
    items: buildItems(climb, commit, elevate),
    modes: buildModes(climb, commit, elevate),
    discipline,
    tier: statusTier(discipline.score),
    climb,
    commit,
    elevate,
    timing,
  };
}
