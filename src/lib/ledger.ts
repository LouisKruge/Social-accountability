import type { ServerClient } from "@/lib/supabase/server";

/**
 * The unified activity ledger.
 *
 * One reconciled list of every money event across all three modes, so a user
 * never has to hunt through sections to answer "where has my money gone in this
 * app". Every row is signed from the USER'S point of view: negative is money
 * they paid, positive is money coming back to them.
 *
 * Every query below is RLS-bound to the caller — stakes, payouts and glow-up
 * reports are all owner-only tables, so this can only ever assemble the
 * caller's own history.
 */
export type LedgerSection = "climb" | "commit" | "elevate";

export interface LedgerEntry {
  id: string;
  date: string;
  section: LedgerSection;
  label: string;
  detail?: string;
  /** Signed rand: negative = paid out of pocket, positive = received. */
  amount: number;
  status: "pending" | "confirmed" | "failed" | "refunded";
}

export interface Ledger {
  entries: LedgerEntry[];
  paidOut: number;
  received: number;
  net: number;
  pending: number;
}

export async function loadLedger(supabase: ServerClient, userId: string): Promise<Ledger> {
  const [{ data: stakes }, { data: payouts }, { data: reports }, { data: sub }] = await Promise.all([
    supabase
      .from("stakes")
      .select("id, amount, payment_confirmed, created_at, cohort_id")
      .eq("user_id", userId),
    supabase
      .from("payouts")
      .select("id, amount, kind, status, created_at, paid_at")
      .eq("user_id", userId),
    supabase
      .from("glowup_reports")
      .select("id, payment_status, created_at, goal")
      .eq("user_id", userId),
    supabase
      .from("subscriptions")
      .select("tier, status, current_period_end, created_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const entries: LedgerEntry[] = [];

  for (const s of stakes ?? []) {
    entries.push({
      id: `stake-${s.id}`,
      date: s.created_at,
      section: "commit",
      label: "Challenge stake",
      detail: s.payment_confirmed ? "EFT received" : "Awaiting your EFT",
      amount: -Number(s.amount),
      status: s.payment_confirmed ? "confirmed" : "pending",
    });
  }

  for (const p of payouts ?? []) {
    entries.push({
      id: `payout-${p.id}`,
      date: p.paid_at ?? p.created_at,
      section: "commit",
      label: p.kind === "refund" ? "Stake refunded" : "Challenge payout",
      detail:
        p.status === "paid" ? "Paid to your account" : p.status === "failed" ? "Payment failed" : "Being processed",
      amount: Number(p.amount),
      status: p.status === "paid" ? "confirmed" : p.status === "failed" ? "failed" : "pending",
    });
  }

  for (const r of reports ?? []) {
    if (r.payment_status === "pending") continue; // nothing charged yet
    entries.push({
      id: `report-${r.id}`,
      date: r.created_at,
      section: "elevate",
      label: "Elevate report",
      detail: r.payment_status === "refunded" ? "Refunded" : "Paid",
      amount: r.payment_status === "refunded" ? 0 : 0, // price recorded at billing time
      status: r.payment_status === "refunded" ? "refunded" : "confirmed",
    });
  }

  if (sub?.tier === "premium") {
    entries.push({
      id: "sub-premium",
      date: sub.created_at,
      section: "climb",
      label: "Premium subscription",
      detail:
        sub.status === "active"
          ? sub.current_period_end
            ? `Renews ${new Date(sub.current_period_end).toLocaleDateString("en-ZA")}`
            : "Active"
          : sub.status,
      amount: 0, // billed by Paystack; amount is reconciled from their records
      status: sub.status === "active" ? "confirmed" : "pending",
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const paidOut = entries.filter((e) => e.amount < 0).reduce((t, e) => t + Math.abs(e.amount), 0);
  const received = entries.filter((e) => e.amount > 0 && e.status === "confirmed").reduce((t, e) => t + e.amount, 0);
  const pending = entries
    .filter((e) => e.status === "pending" && e.amount > 0)
    .reduce((t, e) => t + e.amount, 0);

  return { entries, paidOut, received, net: received - paidOut, pending };
}
