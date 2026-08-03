// Server only. A client component importing a value from this file would drag
// the database client and node: built-ins into the browser bundle — which is
// exactly what happened before src/lib/modules.ts and src/lib/studios.ts
// existed, and it only surfaced as a build error once a node: import appeared.
// This import turns that mistake into a build failure naming the culprit.
import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { loadCommitDashboard, type CommitDashboard } from "@/lib/commitDashboard";
import { loadWallet, type Wallet } from "@/lib/wallet";
import { assessWindow, integrityLabel, type DayLog } from "@/lib/integrity";
import { isOutstanding } from "@/lib/payoutLifecycle";
import type { ModuleKey } from "@/lib/modules";
import { buildPosition, portfolioHealth, type Position } from "@/lib/position";
import {
  buildIntegrityTimeline,
  summarise,
  type IntegrityEntry,
  type IntegritySummary,
} from "@/lib/integrityTimeline";
import { assessDay } from "@/lib/integrity";
import { logReport, timed } from "@/lib/timing";

/**
 * THE DISCIPLINE EXCHANGE.
 *
 * Commit stopped being a page. It is a set of modules, and this file is the
 * index that binds them: one load produces the headline figure and status for
 * every module, so the shell can show what is happening everywhere without
 * each module having to be opened.
 *
 * The rule from the rest of Commit still holds without exception: every figure
 * here is read from the database or derived arithmetically from figures that
 * were. A module with nothing in it says so; it does not show a plausible
 * number.
 */

export { MODULES } from "@/lib/modules";
export type { ModuleDef, ModuleKey } from "@/lib/modules";

export interface ModuleStatus {
  key: ModuleKey;
  /** The one figure worth putting on the tile. Null when there is nothing yet. */
  value: string | null;
  /** A short qualifier under the value. */
  caption: string;
  /** Draws attention when something needs the user. */
  alert: boolean;
  tone: "default" | "money" | "good" | "warn";
}

export interface ExchangeState {
  dashboard: CommitDashboard;
  wallet: Wallet;
  /** Every open challenge as a position, with its own analytics. */
  positions: Position[];
  portfolio: ReturnType<typeof portfolioHealth>;
  /** The trust record: what was committed, checked, decided and paid. */
  timeline: IntegrityEntry[];
  integritySummary: IntegritySummary;
  modules: Record<ModuleKey, ModuleStatus>;
  /** The single most important thing to say right now, or null. */
  headline: { text: string; href: string; tone: "good" | "warn" | "default" } | null;
  integrity: { score: number; label: string; tone: "good" | "watch" | "bad" } | null;
}

export async function loadExchange(
  supabase: ServerClient,
  userId: string,
): Promise<ExchangeState> {
  const [dashboard, wallet] = await Promise.all([
    timed("loader.dashboard", () => loadCommitDashboard(supabase, userId)),
    timed("loader.wallet", () => loadWallet(supabase, userId)),
  ]);

  // Integrity is assessed from logs the dashboard has ALREADY fetched. This
  // used to be two more round trips fired AFTER both loaders had resolved —
  // a waterfall on top of a waterfall, on every module page.
  const dayLogs: DayLog[] = dashboard.rawLogs.map((l) => ({
    date: l.log_date,
    value: Number(l.verified_value ?? 0),
    source: l.source,
    recordedAt: l.recorded_at ?? `${l.log_date}T23:00:00Z`,
    deviceId: l.device_id,
  }));

  const integrity = dayLogs.length
    ? (() => {
        const w = assessWindow(dayLogs);
        const l = integrityLabel(w.integrityScore);
        return { score: w.integrityScore, label: l.label, tone: l.tone };
      })()
    : null;

  // ── Positions ─────────────────────────────────────────────────────────────
  const logsByCohort = new Map<string, number[]>();
  for (const l of dashboard.rawLogs) {
    const arr = logsByCohort.get(l.cohort_id) ?? [];
    arr.push(Number(l.verified_value ?? 0));
    logsByCohort.set(l.cohort_id, arr);
  }

  const positions: Position[] = dashboard.active.map((a) =>
    buildPosition({
      cohortId: a.cohortId,
      name: a.name,
      stake: a.stake,
      progress: a.progress,
      target: a.target,
      dayNumber: a.dayNumber,
      totalDays: a.totalDays,
      daysRemaining: a.daysRemaining,
      history: logsByCohort.get(a.cohortId) ?? [],
      poolTotal: a.poolTotal,
      participants: a.participants,
      feeRate: dashboard.feeRate,
    }),
  );

  // ── The integrity record ──────────────────────────────────────────────────
  const cohortNameById = new Map<string, string>([
    ...dashboard.active.map((a) => [a.cohortId, a.name] as const),
    ...dashboard.history.map((h) => [h.id, h.name] as const),
  ]);

  const heldDays = dayLogs
    .map((d) => ({ log: d, verdict: assessDay(d, dayLogs.filter((o) => o.date !== d.date)) }))
    .filter((x) => !x.verdict.accepted)
    .map((x) => ({
      date: x.log.date,
      cohortName: "a challenge",
      // The engine's own wording, which is written to be read by the person it
      // concerns. Paraphrasing it here would create a second voice for the
      // same decision.
      reason:
        [...x.verdict.flags].sort((a, b) => b.severity - a.severity)[0]?.detail ??
        "flagged for review",
    }));

  const timelineSource = {
    stakes: dashboard.active.map((a) => ({
      id: a.cohortId,
      cohortId: a.cohortId,
      cohortName: a.name,
      amount: a.stake,
      paymentConfirmed: true,
      createdAt: `${new Date(Date.now() - a.dayNumber * 86_400_000).toISOString()}`,
    })),
    heldDays,
    verifiedDayCount: dayLogs.length - heldDays.length,
    settled: dashboard.history.map((h) => ({
      id: h.id,
      name: h.name,
      endDate: h.endDate,
      hitTarget: h.hitTarget,
      payout: h.payout,
    })),
    payoutEvents: wallet.payouts.flatMap((p) =>
      p.history.map((h) => ({
        payoutId: p.id,
        at: h.at,
        to: h.to,
        reason: h.reason,
        amount: p.amount,
        cohortName: cohortNameById.get(p.cohortId) ?? p.cohortName,
      })),
    ),
  };

  const outstanding = wallet.payouts.filter((p) => isOutstanding(p.state));
  const needsUser = wallet.payouts.some((p) => p.needsUser);
  const unlocked = dashboard.achievements.filter((a) => a.unlocked).length;

  const modules: Record<ModuleKey, ModuleStatus> = {
    portfolio: {
      key: "portfolio",
      value: dashboard.active.length ? `R${Math.round(wallet.positions.locked)}` : null,
      caption: dashboard.active.length
        ? `${dashboard.active.length} open ${dashboard.active.length === 1 ? "position" : "positions"}`
        : "Nothing on the line",
      alert: false,
      tone: "default",
    },
    market: {
      key: "market",
      value: dashboard.open.length ? String(dashboard.open.length) : null,
      caption: dashboard.open.length ? "open to join" : "Nothing open",
      alert: false,
      tone: "default",
    },
    treasury: {
      key: "treasury",
      value: outstanding.length
        ? `R${Math.round(wallet.positions.comingToYou)}`
        : wallet.positions.paidOut > 0
          ? `R${Math.round(wallet.positions.paidOut)}`
          : null,
      caption: outstanding.length
        ? "coming to you"
        : wallet.positions.paidOut > 0
          ? "paid to you"
          : "No movement yet",
      alert: needsUser,
      tone: outstanding.length ? "default" : wallet.positions.paidOut > 0 ? "money" : "default",
    },
    lab: {
      key: "lab",
      value:
        dashboard.analytics && dashboard.analytics.consistency !== null
          ? `${Math.round(dashboard.analytics.consistency * 100)}%`
          : null,
      caption: dashboard.analytics ? "consistency" : "Nothing to analyse yet",
      alert: false,
      tone: "default",
    },
    floor: {
      key: "floor",
      value: dashboard.standings ? `#${dashboard.standings.rows.find((r) => r.isMe)?.rank ?? "—"}` : null,
      caption: dashboard.standings
        ? `of ${dashboard.standings.rows.length}`
        : "No cohort yet",
      alert: false,
      tone: "default",
    },
    trust: {
      key: "trust",
      value: integrity ? String(integrity.score) : null,
      caption: integrity ? integrity.label : "Nothing logged yet",
      alert: integrity ? integrity.tone === "bad" : false,
      tone: integrity?.tone === "bad" ? "warn" : "default",
    },
    standing: {
      key: "standing",
      value: `${unlocked}`,
      caption: `of ${dashboard.achievements.length} milestones`,
      alert: false,
      tone: "default",
    },
  };

  logReport("exchange");

  return {
    dashboard,
    wallet,
    positions,
    portfolio: portfolioHealth(positions),
    timeline: buildIntegrityTimeline(timelineSource),
    integritySummary: summarise(timelineSource),
    modules,
    headline: buildHeadline(dashboard, wallet, needsUser),
    integrity,
  };
}

/**
 * The one thing worth saying above everything else.
 *
 * Ordered by what actually costs the user: money blocked on them, then a
 * challenge they are about to lose, then a challenge closing. Returns null
 * rather than manufacturing urgency when nothing is urgent.
 */
function buildHeadline(
  d: CommitDashboard,
  w: Wallet,
  needsUser: boolean,
): ExchangeState["headline"] {
  if (needsUser) {
    return {
      text: "A payout is waiting on your bank details",
      href: "/commit/wallet/bank",
      tone: "warn",
    };
  }
  if (w.positions.awaitingEft > 0) {
    return {
      text: `R${Math.round(w.positions.awaitingEft)} of your stake hasn't reached us yet`,
      href: "/commit/wallet",
      tone: "warn",
    };
  }

  const behind = d.active.find((a) => {
    const remaining = Math.max(0, a.target - a.progress);
    const needed = a.daysRemaining > 0 ? remaining / a.daysRemaining : remaining;
    const pace = a.dayNumber > 0 ? a.progress / a.dayNumber : 0;
    return remaining > 0 && pace < needed;
  });
  if (behind) {
    const remaining = Math.max(0, behind.target - behind.progress);
    const needed = Math.round(behind.daysRemaining > 0 ? remaining / behind.daysRemaining : remaining);
    return {
      text: `${needed.toLocaleString("en")} a day for ${behind.daysRemaining} days to save your R${Math.round(behind.stake)}`,
      href: `/commit/${behind.cohortId}`,
      tone: "warn",
    };
  }

  const onPace = d.active[0];
  if (onPace) {
    return {
      text: `On pace in ${onPace.name} — ${onPace.daysRemaining} days left`,
      href: `/commit/${onPace.cohortId}`,
      tone: "good",
    };
  }
  // Nothing else to say. Deliberately NOT "N challenges open" — with no live
  // position the hero already leads with exactly that, and a banner repeating
  // the headline underneath it is the kind of filler this rebuild removed.
  return null;
}
