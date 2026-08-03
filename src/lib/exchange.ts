import type { ServerClient } from "@/lib/supabase/server";
import { loadCommitDashboard, type CommitDashboard } from "@/lib/commitDashboard";
import { loadWallet, type Wallet } from "@/lib/wallet";
import { assessWindow, integrityLabel, type DayLog } from "@/lib/integrity";
import { isOutstanding } from "@/lib/payoutLifecycle";

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

export type ModuleKey =
  | "market"
  | "portfolio"
  | "treasury"
  | "lab"
  | "trust"
  | "floor"
  | "standing";

export interface ModuleDef {
  key: ModuleKey;
  href: string;
  name: string;
  /** What question this module answers. Shown under the name. */
  question: string;
}

/**
 * The seven modules. Each is named for what it IS rather than what it does,
 * and each carries the single question it exists to answer — if a module can't
 * name its question it shouldn't be a module.
 */
export const MODULES: ModuleDef[] = [
  { key: "portfolio", href: "/commit/portfolio", name: "Portfolio", question: "What am I holding?" },
  { key: "market", href: "/commit/market", name: "Market", question: "What can I take on?" },
  { key: "treasury", href: "/commit/wallet", name: "Treasury", question: "Where is my money?" },
  { key: "lab", href: "/commit/lab", name: "Lab", question: "Am I actually improving?" },
  { key: "floor", href: "/commit/floor", name: "Floor", question: "Who am I up against?" },
  { key: "trust", href: "/commit/trust", name: "Trust", question: "Can this be verified?" },
  { key: "standing", href: "/commit/standing", name: "Standing", question: "What have I earned?" },
];

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
    loadCommitDashboard(supabase, userId),
    loadWallet(supabase, userId),
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

  return {
    dashboard,
    wallet,
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
