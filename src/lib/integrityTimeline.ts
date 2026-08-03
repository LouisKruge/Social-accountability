// ─────────────────────────────────────────────────────────────────────────────
// THE INTEGRITY TIMELINE
//
// A single chronological record of everything that has happened to a person's
// money and their verification: capital committed, EFTs confirmed, days held
// for review, challenges settled, payouts moving state, rand landing.
//
// ── WHY THIS IS THE TRUST FEATURE AND NOT A FEED ─────────────────────────────
// Ascend asks people to send money to a company they have never met, on the
// promise that a verified result decides who gets it back. The only thing that
// makes that reasonable is a record they can read afterwards: what was
// committed, what was checked, what was decided, and when.
//
// Every entry is derived from a row the user owns. Nothing here is generated,
// and nothing is smoothed — a held day appears in the same list as a payout,
// in the same voice. A trust ledger that only shows good news is marketing.
// ─────────────────────────────────────────────────────────────────────────────

export type TimelineKind =
  | "stake_committed"
  | "payment_confirmed"
  | "payment_pending"
  | "day_verified"
  | "day_held"
  | "challenge_settled"
  | "payout_state"
  | "payout_paid";

export interface IntegrityEntry {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  detail: string;
  /** Signed from the user's point of view, or null for non-money events. */
  amount: number | null;
  /** True for anything that went against the user. Shown, never hidden. */
  adverse: boolean;
}

export interface TimelineSource {
  stakes: {
    id: string;
    cohortId: string;
    cohortName: string;
    amount: number;
    paymentConfirmed: boolean;
    createdAt: string;
  }[];
  /** Only days the integrity engine held. Verified days are summarised. */
  heldDays: { date: string; cohortName: string; reason: string }[];
  verifiedDayCount: number;
  settled: {
    id: string;
    name: string;
    endDate: string;
    hitTarget: boolean | null;
    payout: number | null;
  }[];
  payoutEvents: {
    payoutId: string;
    at: string;
    to: string;
    reason: string;
    amount: number;
    cohortName: string;
  }[];
}

/**
 * Build the record, newest first.
 *
 * Verified days are deliberately NOT one entry each. A person forty days into a
 * challenge would otherwise have forty identical lines burying the four that
 * matter, and a record nobody scrolls is not a record.
 */
export function buildIntegrityTimeline(src: TimelineSource): IntegrityEntry[] {
  const entries: IntegrityEntry[] = [];

  for (const s of src.stakes) {
    entries.push({
      id: `stake-${s.id}`,
      at: s.createdAt,
      kind: "stake_committed",
      title: `Committed to ${s.cohortName}`,
      detail: s.paymentConfirmed
        ? "Capital confirmed and locked to the challenge."
        : "Capital committed. The EFT has not landed yet.",
      amount: -s.amount,
      adverse: false,
    });

    if (s.paymentConfirmed) {
      entries.push({
        id: `confirm-${s.id}`,
        at: s.createdAt,
        kind: "payment_confirmed",
        title: "Payment confirmed",
        detail: `${s.cohortName} — funds verified against the reference.`,
        amount: null,
        adverse: false,
      });
    }
  }

  for (const d of src.heldDays) {
    entries.push({
      id: `held-${d.date}-${d.cohortName}`,
      at: `${d.date}T23:59:00Z`,
      kind: "day_held",
      title: "A day was held for review",
      detail: `${d.cohortName} — ${d.reason}. Held days are never deleted; they wait for a person.`,
      amount: null,
      adverse: true,
    });
  }

  for (const c of src.settled) {
    entries.push({
      id: `settled-${c.id}`,
      at: `${c.endDate}T23:59:00Z`,
      kind: "challenge_settled",
      title: c.hitTarget ? `${c.name} closed — target met` : `${c.name} closed — target missed`,
      detail: c.hitTarget
        ? "Verified effort met the terms."
        : "Verified effort fell short of the terms. The stake stays in the pool.",
      amount: null,
      adverse: c.hitTarget === false,
    });
  }

  for (const e of src.payoutEvents) {
    const paid = e.to === "paid";
    entries.push({
      id: `payout-${e.payoutId}-${e.at}`,
      at: e.at,
      kind: paid ? "payout_paid" : "payout_state",
      title: paid ? "Paid out" : `Payout — ${e.to.replace(/_/g, " ")}`,
      detail: `${e.cohortName}${e.reason ? ` — ${e.reason}` : ""}`,
      amount: paid ? e.amount : null,
      adverse: e.to === "failed" || e.to === "fraud_review",
    });
  }

  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export interface IntegritySummary {
  daysVerified: number;
  daysHeld: number;
  challengesClosed: number;
  challengesMet: number;
  committed: number;
  received: number;
  /** Held days as a share of all judged days, or null with nothing judged. */
  holdRate: number | null;
}

export function summarise(src: TimelineSource): IntegritySummary {
  const judged = src.verifiedDayCount + src.heldDays.length;
  const closed = src.settled.filter((c) => c.hitTarget !== null);

  return {
    daysVerified: src.verifiedDayCount,
    daysHeld: src.heldDays.length,
    challengesClosed: closed.length,
    challengesMet: closed.filter((c) => c.hitTarget).length,
    committed: src.stakes.reduce((t, s) => t + s.amount, 0),
    received: src.payoutEvents.filter((e) => e.to === "paid").reduce((t, e) => t + e.amount, 0),
    holdRate: judged > 0 ? Math.round((src.heldDays.length / judged) * 1000) / 1000 : null,
  };
}
