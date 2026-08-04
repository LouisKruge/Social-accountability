# The Treasury — Ascend's money layer

Deposits, withdrawals, escrow, scheduled payouts, disputes and tax.

---

## 1. The problem this design solves

Holding customer funds in South Africa is not a feature, it is a licence.
A spendable balance is deposit-taking, which engages the **Banks Act**; paying
it out engages the **FIC Act's** customer due-diligence duties. No amount of
engineering produces either.

The usual response is to build nothing until the licence exists, and then build
the money layer under time pressure with a launch date attached. That is how
money software gets written badly.

So the treasury is built in full, and the licence is isolated to **one boolean**:

```ts
export const TREASURY: TreasuryMode = {
  custodial: false,          // flip this, and only this
  get automaticSettlement() { return this.custodial },
  beneficiary: { /* the account people pay into */ },
};
```

| | `custodial: false` (shipped) | `custodial: true` |
|---|---|---|
| A deposit is | an instruction to pay by EFT, with a reference | a card/bank charge |
| A withdrawal is | an instruction a human executes | an automatic settlement |
| `available` balance | zero by construction | spendable |
| State machines | run identically | run identically |
| RLS, screens, job | identical | identical |

Everything else — seven deposit states, eight withdrawal states, six dispute
states, the escrow ledger, the eligibility gate, the payment calendar, the tax
export — behaves the same in both modes. **The licence is the only remaining
gap, not six months of engineering.**

`TREASURY` is a constant, deliberately not an environment variable. A misconfigured
deploy must not be able to switch Ascend into deposit-taking; that belongs in a
reviewed commit.

### What is still not built, and why

- **Instant payouts** need custody *and* a payment rail. Two gates.
- **No automated money movement of any kind.** `src/lib/treasuryJob.ts` contains
  no payment API call, by design rather than omission. It advances bookkeeping
  that reflects facts a human already established on a bank statement.

---

## 2. Buckets, not a balance

`treasury_balances()` returns nine figures. One number labelled "balance" is a
lie of omission the moment any of it is committed, escrowed or under review.

| Bucket | Meaning |
|---|---|
| `withdrawable` | Cleared and available to withdraw |
| `available` | Settled and yours to move |
| `locked` | Committed to a challenge still running |
| `escrow` | Held against an outcome not yet decided |
| `pending` | Sent, not yet reconciled against the bank statement |
| `processing` | A payout instruction is with the bank |
| `verification_hold` | Held while the integrity engine finishes a review |
| `rewards` | Earned from finishing challenges |
| `referral` | Earned from people you brought in |

**Derived, never stored.** A stored balance can drift from the ledger meant to
explain it, and when they disagree there is no way to tell which is lying.
Deriving costs one query and buys the property that the total always equals the
sum of its evidence.

**Colour rule.** `withdrawable` and `available` render gold; nothing else ever
does, at any value. A screenshot review caught the met/unmet dots in the
eligibility panel rendering gold — a passed check is not money, and letting the
money colour mean "this bit is fine" is how an accent stops meaning anything.

---

## 3. State machines

Three whitelists, in `src/lib/treasury.ts`. Anything not listed is a bug rather
than an edge case.

**Deposits** — `instructed → awaiting_transfer → received → reconciled → credited`,
with `failed` and `refunded` terminal.

The transition that does not exist is the important one: **nothing reaches
`credited` without passing through `reconciled`.** Money is credited only after
it has been matched to a real bank statement line. `received → credited` is
refused, as is `reconciled → failed` — after reconciliation the money is
demonstrably ours to hold or return, and "failed" would be a claim it never
arrived.

**Withdrawals** — `requested → verification → approved → scheduled → submitted → paid`,
with `rejected` and `cancelled` terminal. Cancellable by the user up to
`scheduled`; once `submitted`, the instruction has left and there is nothing to
cancel. `paid` is terminal in both directions.

**Disputes** — `open → evidence → review → upheld | declined`, withdrawable by
the user only while `open` or `evidence`. A dispute that could be pulled once it
looked like going badly would leave a record showing nothing ever happened.

---

## 4. How state is protected

There is **no `UPDATE` policy on any table** in `20260731000000_treasury.sql`.

A user may *create* a deposit, a withdrawal request and a dispute, and may
*read* their own. Everything else is written by the reconciliation job. The two
state changes a user genuinely owns are `SECURITY DEFINER` RPCs that validate
the transition:

- `cancel_my_withdrawal(uuid)`
- `withdraw_my_dispute(uuid)`

Both filter on `auth.uid()` in the `WHERE` clause, so the id argument cannot
reach another account's row — tested with a real leaked id, not inferred.

Three `BEFORE INSERT` triggers force the entry state, because a client that
could insert `state = 'credited'` has credited its own deposit:

| Trigger | Overwrites |
|---|---|
| `deposits_reference` | `sequence`, `reference`, `state` |
| `withdrawals_initial_state` | `state`, `amount_paid`, `settled_at` |
| `disputes_initial_state` | `state`, `resolution`, `resolved_at` |

The deposit reference is generated server-side for the same reason: a client
that could choose its own reference could claim somebody else's incoming EFT by
guessing theirs.

### The reference

`ASC` + five characters from an FNV-1a hash of the user id + a two-digit
sequence — e.g. `ASC43ECW01`. The alphabet excludes `I`, `L`, `O`, `0` and `1`,
because a reference containing both `O` and `0` gets mistyped by somebody
reading it off a phone.

It is implemented **twice**: `depositReference()` in TypeScript so the UI can
show it before the row exists, and `deposit_reference()` in SQL so the trigger
writes the stored one. If those ever disagree, a person pays with a reference
nothing matches and the money is untraceable until an operator finds it by
hand — so both a unit test and a SQL assertion pin them to the same output.

---

## 5. Escrow

A hold is open (`released_to is null`) or fully accounted for. The CHECK
constraint refuses anything in between:

```sql
amount_to_user + amount_to_pool + fee = amount
```

**The fee comes out of the forfeit, never out of a returned stake.** Somebody
who hit their target gets *all* of their own money back. Charging a fee on the
return of your own money is the mechanic that makes people feel cheated by a
product that was technically correct.

**A cancelled challenge refunds in full, fee-free, regardless of progress**
(`settleForCohort()`). Treating a cancellation like a miss would take money for
a target the person was never given the chance to hit — and it would hand the
platform a financial reason to cancel challenges, which is precisely the
incentive a staking product must not have.

Outcome is determined by the person's own verified effort. There is no
randomness anywhere in this path and there must never be: an outcome decided
even partly by chance changes what Commit legally is.

---

## 6. The eligibility gate

`checkWithdrawal()` returns **every** rule with its own met/unmet state and its
own numbers — the same principle as the elite challenge gate. Somebody refused
access to their own money is owed the specific line that stopped it. The four
rules: enough cleared, minimum R50, bank details verified, nothing under review.

The disabled button is a courtesy so nobody is surprised. **The server re-runs
every check against balances it reads itself**, because in the gap between
render and submit a challenge can settle or a hold can open — and because a form
field is an attacker's input.

---

## 7. Payment runs

Tuesdays and Thursdays, 15:00 UTC cut-off. A fixed schedule beats "3–5 working
days" because it is checkable: a person can see the exact date their money is
due and hold the product to it. Vague ranges protect the operator, not the
person waiting.

`nextPayoutRun()` is property-tested across 400 consecutive days: the answer is
always a declared run day, and never earlier than the day asked about.

---

## 8. Disputes

Sixty days from settlement, because a bank statement is monthly and somebody may
not notice until the one after. A shorter window quietly transfers the cost of
the product's own mistakes onto the person who did not check fast enough.

`dispute_messages` pins `author = 'user'` **in the RLS policy**, not only in the
action. Without it a user could post a message attributed to support and
screenshot it.

The `/commit/wallet/disputes` screen lists what is still challengeable rather
than waiting to be asked. A right nobody can find is a right on paper.

---

## 9. Tax

The South African tax year runs **1 March to 28/29 February**. January and
February belong to the year that started the *previous* March — the single most
likely thing to get wrong, and getting it wrong files a transaction in the wrong
return. Leap years are handled, including the 100/400 century rule.

The export reports what moved, in the periods SARS uses. It does **not** say
what anyone owes and does not classify the net figure as income, a capital gain
or a hobby loss — that depends on facts Ascend does not have. The screen says so
plainly.

Refunded stakes are netted out of the staked figure, so a challenge you were
refunded for does not show as a loss.

---

## 10. Account deletion, and a tension worth naming

Every table cascades from `profiles(id)`, and `audit.test.sql` asserts each one
is gone after `delete_my_account()` — deposits, deposit events, withdrawals,
withdrawal events, bank details, disputes and dispute evidence. Money records
are the ones most likely to be quietly exempted from a deletion flow, so they
are seeded and asserted like everything else.

The tension: the **FIC Act** requires financial records to be retained for five
years, and **POPIA** permits retention where another law requires it. Resolving
that properly means keeping a de-identified statutory record separate from the
profile — part of the same compliance review already blocking automated money
movement, not something to improvise in a migration.

Until that review happens, **deletion wins**, because that is the promise the
product currently makes to the person.

---

## 11. Verification

| | |
|---|---|
| Unit tests | 73 in `src/lib/treasury.test.ts` |
| SQL assertions | 134 across three suites (was 90) |
| Isolation | Two real users, two real rows, per table |
| Screenshots | 390×844 ×2, three variants, via `/design-preview?view=treasury` |

Two bugs were found by screenshot that reading the source did not reveal: the
gold check-dots, and a **failed** deposit hiding its reference while the copy on
that same card said "contact support with the reference".

One was found by the SQL suite failing honestly: a `reset role` inside a `DO`
block leaked superuser to every following statement, so a negative RLS test was
passing while running as a role that bypasses RLS entirely. The suite now
asserts `current_user = 'authenticated'` before the negative tests — a negative
RLS test is worthless unless the role it runs under is asserted.

---

## 12. Files

| Path | What |
|---|---|
| `src/lib/treasury.ts` | Pure engine — modes, machines, eligibility, escrow, runs, tax |
| `src/lib/treasury.test.ts` | 73 unit tests |
| `src/lib/treasuryAccount.ts` | Loader (server-only) |
| `src/lib/treasuryJob.ts` | Reconciliation job (service role, no payment calls) |
| `src/components/treasury-ui.tsx` | Buckets, eligibility panel, cards |
| `src/app/commit/wallet/**` | Treasury, deposits, withdraw, disputes, tax |
| `src/app/api/treasury/tax` | CSV export |
| `src/app/api/treasury/reconcile` | Bearer-gated daily job |
| `supabase/migrations/20260731000000_treasury.sql` | Schema + RLS, in one file |

RLS is enabled in the same migration that creates each table. Not in a later
security pass.
