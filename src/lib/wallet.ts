import type { ServerClient } from "@/lib/supabase/server";
import {
  PRESENTATION,
  expectedArrival,
  isOutstanding,
  trackerSteps,
  type PayoutState,
} from "@/lib/payoutLifecycle";

/**
 * THE WALLET — Ascend's money, from the user's side.
 *
 * ── WHAT THIS DELIBERATELY IS NOT ────────────────────────────────────────────
 * There is no available balance and no withdraw. Ascend does not hold customer
 * funds: a stake is money the user has sent to a challenge, and a payout is
 * money owed and then transferred. Rendering a spendable balance would imply
 * custody that does not exist and that Ascend is not licensed to have — see
 * docs/COMMIT_PLATFORM.md.
 *
 * So the wallet reports POSITIONS, each of which is a true statement:
 *
 *   locked      confirmed stakes on challenges still running
 *   awaitingEft stakes committed but whose EFT has not arrived
 *   comingToYou settled winnings not yet paid
 *   paidOut     winnings that landed
 *
 * ── PRIVACY ──────────────────────────────────────────────────────────────────
 * Every query is RLS-bound to the caller. wallet_positions() takes no arguments
 * precisely so there is no user id to substitute.
 */

export interface WalletPositions {
  locked: number;
  awaitingEft: number;
  comingToYou: number;
  paidOut: number;
  lifetimeStaked: number;
  lifetimeWon: number;
  lifetimeLost: number;
  net: number;
  /** Return on everything staked so far, or null before anything has settled. */
  roi: number | null;
}

export interface PayoutTracking {
  id: string;
  cohortId: string;
  cohortName: string;
  amount: number;
  kind: "winnings" | "refund";
  state: PayoutState;
  label: string;
  blurb: string;
  tone: "neutral" | "progress" | "good" | "warn" | "bad";
  progress: number;
  needsUser: boolean;
  expectedBy: string | null;
  steps: { state: string; label: string; done: boolean; active: boolean }[];
  history: { at: string; to: string; reason: string; actor: string }[];
  settledAt: string;
}

export interface LedgerLine {
  id: string;
  at: string;
  label: string;
  memo: string;
  /** Signed from the user's point of view. */
  amount: number;
  status: "pending" | "cleared" | "failed" | "reversed";
  reference: string | null;
}

export interface TrustSummary {
  destination: { holder: string; bank: string; last4: string; verified: boolean } | null;
  flags: { code: string; severity: number; detail: string; at: string }[];
  events: { kind: string; at: string; city: string | null; userAgent: string | null }[];
  devices: { id: string; label: string; lastSeen: string; trusted: boolean }[];
}

export interface Wallet {
  positions: WalletPositions;
  payouts: PayoutTracking[];
  ledger: LedgerLine[];
  trust: TrustSummary;
}

const n = (v: unknown) => Number(v ?? 0);

export function computeRoi(lifetimeStaked: number, lifetimeWon: number): number | null {
  if (lifetimeStaked <= 0) return null;
  return (lifetimeWon - lifetimeStaked) / lifetimeStaked;
}

/**
 * Build the ledger.
 *
 * `wallet_transactions` is the authority once the settlement job has written to
 * it. Until a cohort settles there are no ledger rows, but the user has still
 * parted with money — so stakes without a corresponding ledger row are folded
 * in. Anything already represented in `wallet_transactions` is skipped, so a
 * stake never appears twice.
 */
export function buildLedger(
  txs: {
    id: string;
    kind: string;
    amount: number;
    status: string;
    memo: string;
    bank_reference: string | null;
    effective_at: string;
    stake_id: string | null;
  }[],
  stakes: {
    id: string;
    amount: number;
    payment_confirmed: boolean;
    payment_reference: string | null;
    created_at: string;
    cohort_id: string;
  }[],
  cohortNames: Map<string, string>,
): LedgerLine[] {
  const covered = new Set(txs.map((t) => t.stake_id).filter(Boolean) as string[]);

  const lines: LedgerLine[] = txs.map((t) => ({
    id: `tx-${t.id}`,
    at: t.effective_at,
    label: LEDGER_LABEL[t.kind] ?? "Adjustment",
    memo: t.memo,
    amount: n(t.amount),
    status: t.status as LedgerLine["status"],
    reference: t.bank_reference,
  }));

  for (const s of stakes) {
    if (covered.has(s.id)) continue;
    lines.push({
      id: `stake-${s.id}`,
      at: s.created_at,
      label: "Stake committed",
      memo: cohortNames.get(s.cohort_id) ?? "Challenge",
      amount: -n(s.amount),
      status: s.payment_confirmed ? "cleared" : "pending",
      reference: s.payment_reference,
    });
  }

  return lines.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

const LEDGER_LABEL: Record<string, string> = {
  stake_locked: "Stake committed",
  stake_refunded: "Stake refunded",
  winnings_credited: "Winnings",
  fee_charged: "Platform fee",
  adjustment: "Adjustment",
};

/** A statement a person can hand to an accountant. */
export function toCsv(lines: LedgerLine[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = ["Date", "Type", "Detail", "Amount (ZAR)", "Status", "Reference"];
  const rows = lines.map((l) => [
    esc(l.at.slice(0, 10)),
    esc(l.label),
    esc(l.memo),
    l.amount.toFixed(2),
    esc(l.status),
    esc(l.reference ?? ""),
  ]);
  return [head.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export async function loadWallet(supabase: ServerClient, userId: string): Promise<Wallet> {
  const [
    { data: positionRows },
    { data: payoutRows },
    { data: txRows },
    { data: stakeRows },
    { data: cohortRows },
    { data: destRows },
    { data: flagRows },
    { data: eventRows },
    { data: deviceRows },
  ] = await Promise.all([
    supabase.rpc("wallet_positions"),
    supabase
      .from("payouts")
      .select("id, cohort_id, amount, kind, status, created_at, paid_at, expected_by")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("wallet_transactions")
      .select("id, kind, amount, status, memo, bank_reference, effective_at, stake_id")
      .eq("user_id", userId)
      .order("effective_at", { ascending: false })
      .limit(200),
    supabase
      .from("stakes")
      .select("id, amount, payment_confirmed, payment_reference, created_at, cohort_id")
      .eq("user_id", userId),
    supabase.from("stake_cohorts").select("id, name"),
    supabase
      .from("payout_destinations")
      .select("account_holder, bank_name, account_last4, verified")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle(),
    supabase
      .from("verification_flags")
      .select("code, severity, detail, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("security_events")
      .select("kind, created_at, city, user_agent")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("trusted_devices")
      .select("id, label, last_seen, trusted")
      .eq("user_id", userId)
      .order("last_seen", { ascending: false }),
  ]);

  const p = positionRows?.[0];
  const lifetimeStaked = n(p?.lifetime_staked);
  const lifetimeWon = n(p?.lifetime_won);

  const positions: WalletPositions = {
    locked: n(p?.locked),
    awaitingEft: n(p?.awaiting_eft),
    comingToYou: n(p?.pending_in),
    paidOut: n(p?.paid_out),
    lifetimeStaked,
    lifetimeWon,
    lifetimeLost: n(p?.lifetime_lost),
    net: n(p?.net),
    roi: computeRoi(lifetimeStaked, lifetimeWon),
  };

  const cohortNames = new Map((cohortRows ?? []).map((c) => [c.id, c.name]));

  // Event history for the payouts that are still moving.
  const outstandingIds = (payoutRows ?? [])
    .filter((r) => isOutstanding(normalise(r.status)))
    .map((r) => r.id);

  const { data: histRows } = outstandingIds.length
    ? await supabase
        .from("payout_events")
        .select("payout_id, to_state, reason, actor, created_at")
        .in("payout_id", outstandingIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const histByPayout = new Map<string, PayoutTracking["history"]>();
  for (const h of histRows ?? []) {
    const list = histByPayout.get(h.payout_id) ?? [];
    list.push({ at: h.created_at, to: h.to_state, reason: h.reason, actor: h.actor });
    histByPayout.set(h.payout_id, list);
  }

  const payouts: PayoutTracking[] = (payoutRows ?? []).map((r) => {
    const state = normalise(r.status);
    const pres = PRESENTATION[state];
    const settledAt = r.created_at;
    return {
      id: r.id,
      cohortId: r.cohort_id,
      cohortName: cohortNames.get(r.cohort_id) ?? "Challenge",
      amount: n(r.amount),
      kind: r.kind as "winnings" | "refund",
      state,
      label: pres.label,
      blurb: pres.blurb,
      tone: pres.tone,
      progress: pres.progress,
      needsUser: pres.needsUser,
      // A stored date wins over an estimate; otherwise estimate, or say nothing.
      expectedBy: r.expected_by ?? expectedArrival(state, settledAt),
      steps: trackerSteps(state),
      history: histByPayout.get(r.id) ?? [],
      settledAt,
    };
  });

  return {
    positions,
    payouts,
    ledger: buildLedger(txRows ?? [], stakeRows ?? [], cohortNames),
    trust: {
      destination: destRows
        ? {
            holder: destRows.account_holder,
            bank: destRows.bank_name,
            last4: destRows.account_last4,
            verified: destRows.verified,
          }
        : null,
      flags: (flagRows ?? []).map((f) => ({
        code: f.code,
        severity: f.severity,
        detail: f.detail,
        at: f.created_at,
      })),
      events: (eventRows ?? []).map((e) => ({
        kind: e.kind,
        at: e.created_at,
        city: e.city,
        userAgent: e.user_agent,
      })),
      devices: (deviceRows ?? []).map((d) => ({
        id: d.id,
        label: d.label,
        lastSeen: d.last_seen,
        trusted: d.trusted,
      })),
    },
  };
}

/** Older rows carry the pre-lifecycle `pending`; map it to the real first state. */
function normalise(status: string): PayoutState {
  return status === "pending" ? "pending_verification" : (status as PayoutState);
}
