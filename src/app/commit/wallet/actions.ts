"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_WITHDRAWAL_RULES,
  TREASURY,
  checkWithdrawal,
  type Balances,
} from "@/lib/treasury";
import { loadTreasury } from "@/lib/treasuryAccount";

export type TreasuryState = { error?: string; ok?: boolean; reference?: string };

/**
 * TREASURY ACTIONS.
 *
 * ── THE RULE THESE SHARE ─────────────────────────────────────────────────────
 * Every check that matters is re-run here, server-side, against balances read
 * from the database in this request — never against anything the form sent.
 * The eligibility panel on the screen is a courtesy so a person is not
 * surprised; it is not the enforcement. A form field is an attacker's input.
 *
 * None of these move money. `requestWithdrawal` records that somebody asked;
 * an operator pays it and marks it paid. That is what non-custodial means in
 * practice, and it is why there is no payment API call anywhere in this file.
 */

/**
 * Create a deposit instruction.
 *
 * Returns the reference rather than redirecting, because the reference is the
 * whole point: without it the money arrives unattributable.
 */
export async function createDeposit(
  _prev: TreasuryState,
  formData: FormData,
): Promise<TreasuryState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount < 50) return { error: "The smallest payment is R50." };
  if (amount > 50_000) return { error: "The largest single payment is R50,000." };

  // sequence, reference and state are assigned by the database trigger. Sending
  // them would be pointless — the trigger overwrites them — so they are not
  // sent at all, which keeps the intent of the code honest.
  const { data, error } = await supabase
    .from("deposits")
    .insert({ user_id: user.id, amount })
    .select("reference")
    .single();

  if (error || !data) {
    return { error: "We couldn't create that payment instruction. Try again." };
  }

  revalidatePath("/commit/wallet");
  return { ok: true, reference: data.reference };
}

/**
 * Request a withdrawal.
 *
 * Re-checks eligibility against balances read here, not against the ones the
 * page rendered with — they may be minutes old, and in that gap a challenge can
 * settle or a verification hold can open.
 */
export async function requestWithdrawal(
  _prev: TreasuryState,
  formData: FormData,
): Promise<TreasuryState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount." };

  const treasury = await loadTreasury(supabase, user.id);
  const check = checkWithdrawal(
    amount,
    treasury.balances as Balances,
    treasury.destination?.verified ?? false,
    DEFAULT_WITHDRAWAL_RULES,
  );
  if (!check.allowed) {
    const failed = check.reasons.find((r) => !r.met);
    return { error: failed ? `${failed.label}: ${failed.detail}` : "That withdrawal can't go yet." };
  }

  const { data: dest } = await supabase
    .from("payout_destinations")
    .select("id")
    .eq("user_id", user.id)
    .eq("verified", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!dest) return { error: "Add and verify a bank account before withdrawing." };

  const { error } = await supabase.from("withdrawals").insert({
    user_id: user.id,
    destination_id: dest.id,
    amount_requested: amount,
    scheduled_for: treasury.nextRun,
  });

  if (error) return { error: "We couldn't submit that request. Try again." };

  revalidatePath("/commit/wallet");
  return { ok: true };
}

/** Pull a withdrawal back. The RPC re-checks the state; this only calls it. */
export async function cancelWithdrawal(id: string): Promise<TreasuryState> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_my_withdrawal", { _withdrawal_id: id });
  if (error) return { error: "That withdrawal can no longer be cancelled." };
  revalidatePath("/commit/wallet");
  return { ok: true };
}

/**
 * Open a dispute.
 *
 * `state` and `resolution` are not sent for the same reason the deposit's are
 * not: the trigger forces them. The subject is validated as exactly one, which
 * the schema also enforces — belt and braces, because a dispute that points at
 * nothing cannot be reviewed and would sit open forever.
 */
export async function openDispute(
  _prev: TreasuryState,
  formData: FormData,
): Promise<TreasuryState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const category = String(formData.get("category") ?? "");
  const summary = String(formData.get("summary") ?? "").trim();
  const cohortId = String(formData.get("cohort_id") ?? "") || null;
  const depositId = String(formData.get("deposit_id") ?? "") || null;
  const withdrawalId = String(formData.get("withdrawal_id") ?? "") || null;

  if (summary.length < 10) {
    return { error: "Tell us what happened — a sentence or two is enough." };
  }
  if (summary.length > 2000) return { error: "That's longer than we can take. Trim it a little." };

  const subjects = [cohortId, depositId, withdrawalId].filter(Boolean);
  if (subjects.length !== 1) return { error: "Pick the one thing you're disputing." };

  const { error } = await supabase.from("disputes").insert({
    user_id: user.id,
    category,
    summary,
    cohort_id: cohortId,
    deposit_id: depositId,
    withdrawal_id: withdrawalId,
  });

  if (error) return { error: "We couldn't log that. Try again." };

  revalidatePath("/commit/wallet");
  redirect("/commit/wallet/disputes");
}

/** Add evidence to your own open dispute. */
export async function addDisputeMessage(
  _prev: TreasuryState,
  formData: FormData,
): Promise<TreasuryState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const disputeId = String(formData.get("dispute_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Nothing to add." };
  if (body.length > 4000) return { error: "That's longer than we can take." };

  // author is pinned to 'user' here AND in the RLS policy. A message the user
  // could attribute to support is a message they could screenshot.
  const { error } = await supabase.from("dispute_messages").insert({
    dispute_id: disputeId,
    user_id: user.id,
    author: "user",
    body,
  });

  if (error) return { error: "We couldn't add that. The dispute may already be closed." };

  revalidatePath(`/commit/wallet/disputes/${disputeId}`);
  return { ok: true };
}

/** Close your own dispute while it is still open. */
export async function withdrawDispute(id: string): Promise<TreasuryState> {
  const supabase = createClient();
  const { error } = await supabase.rpc("withdraw_my_dispute", { _dispute_id: id });
  if (error) return { error: "That dispute can no longer be withdrawn." };
  revalidatePath("/commit/wallet/disputes");
  return { ok: true };
}

/** Exposed so the deposit screen can name the mode without importing the flag. */
export async function treasuryIsCustodial(): Promise<boolean> {
  return TREASURY.custodial;
}

// ── Form-shaped wrappers ─────────────────────────────────────────────────────
// A <form action> wants (FormData) => Promise<void>. These exist so a server
// component can post directly without shipping a client component just to hold
// a button, which is the whole reason cancelling is one tap and not a page.

export async function cancelWithdrawalForm(formData: FormData): Promise<void> {
  await cancelWithdrawal(String(formData.get("id") ?? ""));
}

export async function withdrawDisputeForm(formData: FormData): Promise<void> {
  await withdrawDispute(String(formData.get("id") ?? ""));
}
