# Commit — platform specification

Commit is the mode where people stake their own money on their own verified
effort. This document is the architecture of record: what is built, what is
deliberately not built, and why.

---

## 0. The one-sentence product

You put money on a target you set for yourself, you either hit it or you don't,
and the outcome depends on nothing but your own verified effort.

Three properties follow from that sentence and constrain everything below.

1. **No chance element, anywhere, ever.** No randomised bonus, no lottery, no
   luck multiplier, no odds display. This is not a style preference — an outcome
   that turns partly on chance changes the product's legal classification from a
   skill/effort contract to gambling, which in South Africa engages the National
   Gambling Act and a licensing regime Ascend does not have.
2. **Nobody sees anybody else's money.** Not their stake, not their winnings,
   not their balance. This is enforced in the database, not in the UI.
3. **Ascend does not hold customer funds.** See §5.

---

## 1. Information architecture — the Discipline Exchange

Commit is no longer a page. It is an exchange of seven modules, each named for
what it is and carrying the one question it exists to answer. A module that
cannot name its question should not be a module.

| Module | Route | Answers |
|---|---|---|
| Portfolio | `/commit/portfolio` | What am I holding? |
| Market | `/commit/market` | What can I take on? |
| Treasury | `/commit/wallet` | Where is my money? |
| Lab | `/commit/lab` | Am I actually improving? |
| Floor | `/commit/floor` | Who am I up against? |
| Trust | `/commit/trust` | Can this be verified? |
| Standing | `/commit/standing` | What have I earned? |

### Why the old page was deleted rather than improved

The previous Commit was twelve sections stacked vertically on one route. That
architecture degrades as the product improves: every new capability pushes the
last one further below the fold, and the only way to reach anything is to scroll
past everything. It cannot hold seven modules.

### Two navigation primitives replace the stack

- **The rail** — a persistent horizontal strip of modules, each carrying its own
  live figure, rendered inside every module. You can read the state of the whole
  exchange from anywhere and switch in one tap. It is deliberately *absent* from
  the exchange home, where the floor-plan tiles already are the navigation and a
  rail would be pure duplication.
- **The command bar** — ⌘K on a keyboard, a tap target on a phone. Jumps to any
  module, any challenge, or any action by name. It is the only navigation that
  does not get slower as the product grows.

**Deliberately not built: radial menus and gesture shortcuts.** Both are
undiscoverable without an onboarding overlay, both fight the browser's own
gestures on mobile web, and neither has a keyboard or screen-reader equivalent.
The command bar does the same job and is reachable three ways.

### The home screen has two heroes, not one

With an open position, the hero is the exposure — one number at editorial scale,
because that is what the user came to check. With nothing at stake, a giant
**R0** answers nothing, so the hero becomes the way in: *"Put money on
yourself — 3 challenges open, from R50."* An empty state that states a real
price is worth more than a true but useless zero.

---

## 2. What was built in this pass

| Area | Artefact | State |
|---|---|---|
| Ledger schema | `20260727000100_wallet_and_trust.sql` | Applied, RLS tested |
| Positions engine | `wallet_positions()` | Applied |
| Payout lifecycle | `src/lib/payoutLifecycle.ts` | 29 tests |
| Integrity engine | `src/lib/integrity.ts` | 32 tests |
| Wallet data layer | `src/lib/wallet.ts` | 16 tests |
| Wallet UI | `/commit/wallet`, `/commit/wallet/bank` | Built |
| Statement export | `/api/commit/statement` | Built |
| Trust surface | `TrustPanel` | Built |
| Challenge creation | `/commit/new` | Built, 20 tests |
| Exchange shell | `exchange-shell.tsx` (rail, ⌘K, sheet) | Built |
| Seven modules | `/commit/{portfolio,market,wallet,lab,floor,trust,standing}` | Built |
| Marketplace visibility | `stake_cohorts.visibility` | Applied |

Totals: **191 unit tests**, **78 SQL isolation assertions**, zero failures.

---

## 3. Data architecture

```
profiles
  └─ stake_cohorts            terms of a challenge (public)
       ├─ stakes              PRIVATE: amount, payment_reference    [owner-only]
       │    └─ daily_verification_logs                              [owner-only]
       │         └─ verification_flags                              [owner-only]
       ├─ payouts             PRIVATE: amount, state                [owner-read]
       │    └─ payout_events  every transition + reason             [owner-read]
       └─ wallet_transactions PRIVATE: the ledger            [owner-read, no write]

payout_destinations   bank details                                  [owner-only]
security_events       login history                                 [owner-read]
trusted_devices       device list                                   [owner-only]
```

### The two functions that cross user boundaries

Only two things in Commit read across users, and neither can carry money:

- **`cohort_progress(cohort_id)`** — projects `user_id, display_name,
  current_progress, target_value, hit_target, rank`. Gated on the caller being a
  participant. Money columns are not in the projection, so they cannot leak
  through this path even in principle.
- **`cohort_market()`** — returns `participant_count` and `confirmed_count` per
  cohort. **Counts only, never `SUM(amount)`.** A sum is a leak: in a two-person
  cohort, the total plus your own stake gives you the other person's exactly.
  Asserted in `features_isolation.test.sql`.

### Why the ledger has no client write policy

`wallet_transactions` has a `SELECT` policy and nothing else. A user who could
append to their own ledger could manufacture a balance. Only the settlement job
(service role, server-side cron) writes there.

---

## 4. Challenge lifecycle

```
draft ── publish ──▶ open ── start_date ──▶ active ── end_date ──▶ settling ──▶ completed
                       │                                              │
                       └── nobody joined ──▶ cancelled                └─▶ refunded (0 winners)
```

**Settlement** (`src/lib/stakes.ts`, 16 tests):

```
Total Pool         = Σ confirmed stakes
Platform Fee       = Total Pool × fee_rate
Distributable Pool = Total Pool − Platform Fee
Payout per Winner  = Distributable Pool ÷ Number of Winners
```

Two named outcomes, not emergent behaviour:

- **Zero winners** → every participant refunded in full, **no fee charged**. The
  platform must not simply retain a pool nobody won.
- **All winners** → there are no forfeitures to redistribute, so the post-fee
  split returns *less* than each person staked. That is arithmetic, not a bug,
  and is surfaced via `everyoneWon` so the UI can explain it rather than look
  broken.

---

## 5. Money: what is deliberately NOT built

**The brief asked for: Available Balance, Deposit, Withdraw, Payment Methods,
Cards, Instant EFT, Apple Pay, Google Pay, Crypto, Withdrawal Queue.**

**None of it was built, and it should not be built until a compliance review is
done.** This is not caution for its own sake:

- Holding a spendable balance for a user is **taking a deposit**. In South
  Africa the Banks Act reserves that to registered banks and mutual banks.
- Receiving, pooling and disbursing customer money makes Ascend an
  **accountable institution** under the FIC Act, triggering customer due
  diligence, record-keeping and suspicious-transaction reporting obligations.
- Card and wallet rails require a sponsoring PSP with its own onboarding; you
  cannot bolt Apple Pay onto an unlicensed pooled-funds model.

**What was built instead:** a complete ledger that *records* money and a payout
state machine that *tracks* it, with the execution step being a human doing an
EFT. The UI says so, in plain language, high on the wallet page:

> Ascend doesn't hold a balance for you. There is no wallet to top up and nothing
> to withdraw. Your stake goes to the challenge's pool, and anything you win is
> paid straight to your bank account by EFT.

**When compliance clears**, the change is small by design: `wallet.ts` gains a
`PayoutRail` adapter behind the existing state machine, and `processing` becomes
an API call instead of an operator action. No schema change is required.

### Known debt

`payout_destinations.account_number` is a plain column. It is owner-only under
RLS and never rendered beyond `account_last4`, but before any real scale it
belongs in Supabase Vault or a tokenising PSP. Recorded here rather than left to
be discovered.

---

## 6. Payout lifecycle

```
pending_verification ─▶ verified ─▶ queued ─▶ scheduled ─▶ processing ─▶ paid
         │                  │          │          │            │
         ├──▶ manual_review ─┘          │          │            ├──▶ failed ──▶ queued
         ├──▶ fraud_review ──▶ verified │          │            └──▶ returned ─▶ manual_review
         └──▶ cancelled ◀───────────────┴──────────┘
```

Invariants, each covered by a test:

- **Transitions are a whitelist.** Anything not explicitly permitted is refused.
- **`paid` and `cancelled` are terminal.** There is no transition out of `paid`;
  a reversal is a *new ledger entry*, never an edit to history.
- **No state can get stuck.** A graph search asserts every non-terminal state can
  still reach a terminal one.
- **Only an operator clears `fraud_review`.** The system cannot clear its own
  integrity hold.
- **Every transition carries a non-empty reason**, written to be shown to the
  person waiting for the money, and recorded in `payout_events`.
- **`expectedArrival()` returns `null` rather than guessing.** A fabricated date
  on a held payout is worse than no date: the user plans around it, it slips, and
  they stop believing anything on the page. Weekends are skipped, because banks
  don't settle on them.
- **An expected date in the past stops claiming to be an expectation** and reads
  "later than expected".

---

## 7. Verification integrity (anti-cheat)

`src/lib/integrity.ts` — pure, no clock, no I/O, 32 tests.

| Flag | Severity | Signal |
|---|---|---|
| `impossible_pace` | 3 | >120,000 steps/day — beyond any human day |
| `late_backfill` | 1–3 | Filled in 1 / 2+ / 7+ days after the day ended |
| `duplicate_value` | 2 | The identical figure on 3+ days |
| `source_downgrade` | 2 | Wearable window that suddenly goes manual |
| `outlier_spike` | 2 | >3× *this user's own* median and >15k above it |
| `clock_skew` | 2 | Client clock >6h out from the server |
| `device_switch` | 1 | New device mid-window |

Scoring: `confidence = SOURCE_BASE[source] − Σ penalties`, where manual entry
starts at 85 and device sources at 100. Flags are **deduplicated by code**, so a
single anomaly can't be punished twice. Below 50 a day is **held**, not deleted.

Three rules the engine is built around:

1. **It never deletes effort.** The worst outcome is `accepted: false`, routing
   a day to human review. Someone who genuinely walked 40,000 steps on a hiking
   day gets *looked at*, not erased. `assessWindow` reports `heldTotal`
   separately so the steps remain visible.
2. **Every rejection is explainable.** Each flag carries plain-language `detail`
   written to be shown to the person it's about.
3. **It judges you against yourself.** 14,000 steps is unremarkable for one
   person and a red flag for another, so outliers are measured against the
   user's own distribution — and it requires ≥5 days of history before it
   judges anyone at all.

### What cannot be built on the web, and why it wasn't stubbed

GPS validation, accelerometer/motion analysis, root/jailbreak detection, VPN
detection and native biometric login (Face ID / fingerprint) are **native-app
capabilities**. A browser cannot see any of them. Apple HealthKit in particular
has **no web API** — reading Apple Health requires a native iOS client.

These were not stubbed. A `jailbroken: false` that always returns false is worse
than no check: it reads as protection while providing none. They are specified
here against a future native client instead.

**Web-native equivalents that *are* buildable next:** WebAuthn/passkeys (real
biometric login on the web), TOTP 2FA, and the device/session list — the schema
for the last is already in place.

---

## 8. Where the brief was not followed, and why

| Asked for | Built instead | Reason |
|---|---|---|
| "Top Earners" leaderboard | Progress-based standings only | Publishes other users' winnings — violates the locked `stakes_owner_only` guarantee, verified by 78 assertions. **See below.** |
| Available balance, Withdraw, Deposit, Apple/Google Pay, crypto | Ledger + positions; manual EFT | §5 — unlicensed deposit-taking |
| "Win Probability", "AI Prediction", success-chance % | Pace projection: *"at your current rate you finish 3 days early"* | An odds display reframes a discipline product as a betting one, and a probability we cannot compute is a fabricated number |
| Confetti, particle effects | Restrained state changes | This is money. Celebrating a payout like a slot machine is the casino register the product is explicitly avoiding |
| XP, levels, season pass, daily missions | Achievements computed from real behaviour | Season passes and missions require inventing content and fabricating engagement metrics on a financial product |

### On "Top Earners" specifically

This has now been requested three times. It cannot be built as specified without
reversing a guarantee that is currently enforced in the database and verified by
tests — `stakes_owner_only`, plus the deliberate absence of any cross-user money
projection.

**There is a version that works:** make it **opt-in**. A user chooses to publish
their winnings, exactly as Climb already does with `entries.share_raw_value`.
Default private, explicit consent to appear, revocable. That respects the
guarantee, matches the precedent already in the codebase, and gives the feature.

**This is a product decision, not an engineering one, and it is yours.** Say the
word and the opt-in version ships. What will not ship silently is a board that
publishes people's money without their consent.

---

## 9. Edge cases handled

| Case | Behaviour |
|---|---|
| Nobody hits the target | Full refund, no fee |
| Everybody hits the target | Payout < stake by the fee; `everyoneWon` flag lets the UI explain |
| Cohort with one participant | Settles normally; they win their own stake back minus fee |
| Stake committed, EFT never arrives | `payment_confirmed` stays false; excluded from the pool; shown as "Awaiting your EFT" |
| Payout returned by the bank | `returned` → `manual_review`, `needsUser: true`, user prompted for details |
| User deletes their account mid-cohort | `ON DELETE CASCADE` from `profiles`; POPIA erase path tested |
| Day logged 9 days late | `late_backfill` severity 3 → held for review |
| Genuine 70,000-step hiking day | Flagged, **not** rejected; human reviews |
| Brand-new challenge, empty pool | Says "Nobody's staked yet — be the first in" rather than drawing an empty vessel |
| Expected payout date passes | Reads "later than expected", not a stale promise |
| No cohorts exist | Empty state with a route to `/commit/new` |

---

## 10. Next, in priority order

1. **Compliance review of the escrow/custody question.** Everything in §5 is
   blocked on this and nothing else.
2. **Rotate the Supabase service-role key** — it was briefly in a public bundle.
3. **Settlement job** writes `wallet_transactions` + `payout_events` on cohort
   close (service role, `pg_cron`).
4. **WebAuthn/passkeys + TOTP 2FA** — the buildable half of the security brief.
5. **Native client** for HealthKit/Google Fit, which unlocks the rest of §7.
6. **Opt-in earnings sharing**, if you want the Top Earners board (§8).
