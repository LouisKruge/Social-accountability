# Ascend — the Life OS

The five-layer architecture, and what is actually built underneath it.

| Layer | What it is | State |
|---|---|---|
| **1 — Intelligence** | Momentum, Discipline Score, Performance Index, Goal Simulator, projections, Life Portfolio, Legacy | **Built** |
| **2 — Accountability** | Climb: groups, ranking on rate of improvement, weekly periods | **Built** |
| **3 — Financial rewards** | Commit: stakes, pools, integrity, payout lifecycle, wallet | **Built**, money movement manual pending compliance |
| **4 — Identity & transformation** | Elevate: five studios, status tiers, transformation timeline | **Built**, tiers new in this pass |
| **5 — Community & status** | Seasons, prestige, elite challenges, corporate, marketplace | **Specified** — §6 |

---

## 1. A correction to the record

`FEATURE_CATALOGUE.md` previously declined three of the things in this
document — the Discipline Credit Score (#156), the Confidence Index (#157) and
a composite score across modes (#158) — on the grounds that a single number
combining several measurements is one no user could reproduce from their own
data.

**That objection was to a specific implementation, and it turned out to be
solvable.** The Discipline Score is now built, and the reason it is defensible
is the same reason the original objection stood:

- Every input is a rate a person can see, between 0 and 1.
- Every input's **contribution in points is displayed**, so the score
  reconstructs itself on screen.
- Every input Ascend **cannot** measure is displayed too, with its weight, and
  is excluded from the arithmetic rather than assumed.

A score that shows its working is not the thing the catalogue objected to. The
catalogue entries have been corrected rather than quietly edited.

---

## 2. Momentum — the one that replaces streaks

```
momentum = 100 × EWMA(daily completion, half-life 10 days) × missPenalty
missPenalty = 1                    for fewer than 3 consecutive misses
            = 0.85^(misses − 2)    from the third onward
```

The brief's requirement was exact: *"You fail one day. Momentum barely drops.
You fail seven days. Momentum crashes."*

A streak cannot do that, because a streak is a boolean with a counter attached.
One missed Tuesday destroys thirty days of work — which is a product choosing to
punish somebody at the precise moment they most need to be kept.

Measured off a perfect run:

| What happened | Momentum |
|---|---|
| 30 clean days | 100 |
| one missed day | 93 |
| seven missed days, scattered across the month | ~78 |
| seven missed days, consecutive | 27 |
| two days back after that collapse | ~50 and climbing |

The scattered-versus-consecutive gap is the whole point, and it is asserted in
the tests: seven bad days spread over a month is a person having a hard month;
seven in a row is a person who has stopped. Those are different facts and the
number says so.

A 40,000-step Sunday is capped at full credit for that day — it cannot bank
against Monday. Otherwise the metric rewards bingeing, which is the opposite of
what it exists to measure.

---

## 3. The Discipline Score — 300 to 1000

Credit-score shaped on purpose: a portable, slow-moving summary of whether you
do what you said you would. It gates access to challenges, which is exactly why
it may only be built from signals a person can see and dispute.

| Signal | Weight | Source |
|---|---|---|
| Completion rate | 22 | daily logs vs that day's required rate |
| Consistency | 18 | days logged / days elapsed, across Commit and Climb |
| Momentum | 15 | §2 |
| Verification confidence | 15 | the existing integrity engine |
| Challenge history | 10 | settled challenges hit / settled |
| Goal completion | 8 | Climb pitches with a ranked position |
| Financial accountability | 4 | stakes whose EFT was confirmed |
| **Recovery** | **5** | **no data — needs a wearable** |
| **Sleep** | **3** | **no data — needs a wearable** |

### The coverage rule

The brief asks the OS to know sleep, HRV, resting heart rate, mood, calendar,
spending and workload. **Ascend has none of them.**

So the two it cannot measure stay in the model, carrying real weight, reported
as missing. Three consequences, all deliberate:

1. The score is computed over **available weight and rescaled** — nobody is
   penalised for an integration the product has not shipped.
2. `coverage` is displayed: "92% measured". A score of 820 at 40% coverage and
   one at 92% are not the same claim.
3. A person deciding whether to connect a tracker can see exactly what it buys
   them.

The alternative was to generate the missing values. That produces the single
most damaging sentence this product could say: *"Your recovery is down 14%"* to
somebody whose recovery has never been measured. The morning brief in the
original spec contains that exact line, and it is the one thing from the brief
that was not built.

**The floor is 300, not 0.** Somebody one week in is not a 40/1000 person.

---

## 4. Prediction, without fortune-telling

### The Goal Simulator

For each candidate daily rate: the user's own logged days are the sample, their
mean and standard deviation describe how they actually behave, and the total
over the remaining days is approximated as a normal sum.

Two properties worth stating:

- **Conditioned on the person, not a population.** Someone who walks 12,000 on
  a good day and 3,000 on a bad one gets a wider distribution — and a lower
  probability — than someone who walks 9,000 every day, at the same average.
  Variance cuts both ways: below the target, erratic is the only person with a
  chance, because the upside days are what carry them over. Both directions are
  tested.
- **Below eight logged days it returns nothing.** A standard deviation over
  three points is not a description of anybody's behaviour, and a
  confident-looking "91%" built on it is worse than no answer, because somebody
  might stake money on it.

The method is stated on screen, in one sentence, next to the numbers.

### Deliberately not built: the AI Twin

The brief asks for a digital twin predicting burnout, motivation, injury risk
and "you perform 24% better when starting on Mondays".

That last claim is the problem. With one user's history, a day-of-week effect
is noise with a decimal place on it — you would need dozens of Mondays before
the number meant anything, and by then the product has said it fifty times. The
simulator is the honest version of the same idea: it predicts one thing, from
one clearly-stated method, and refuses when the sample is too small.

---

## 5. The Personal Performance Index

The discipline score, **rebased to 1000 at the first recorded point**.

An index is a rebasing, not a new measurement. It says nothing the score does
not, and it is useful precisely because of that: it makes "up 7.3% this month"
expressible without inventing a second underlying quantity. Building it out of
anything else would give a user two numbers that disagree, and no way to tell
which one is lying.

This needs history, which is why `discipline_snapshots` exists: one row per user
per day, upserted so opening the app twice cannot add a second point.

**Volatility is computed from the unrounded index**, because rounding a
perfectly linear climb of +14.28/day to 14, 15, 14 manufactures a spread out of
nothing — and volatility reading non-zero for the steadiest possible person is
precisely backwards.

### The percentile

`discipline_percentile()` is `SECURITY DEFINER`, takes no arguments, returns one
integer, and **refuses below 20 participants**. With three users "top 33%" is
arithmetic on a sample that identifies people; with one user it is simply false.
Until the cohort exists the screen says so rather than showing a flattering
number.

---

## 6. Layer 5 — specified, not built

| Feature | Why it is not in this pass |
|---|---|
| Seasons (90-day resets, season leaderboards) | Needs a season table, reward inventory and a settlement job. A real system, not a screen. |
| Prestige | Depends on Seasons. |
| Achievement Vault (animated, 3D, rare/legendary) | Achievements exist as data. The vault is a rendering project, and a 3D trophy room on a 390px South African mobile connection needs a weight budget before a design. |
| Elite invite-only challenges | The gate is ready — `statusTier()` and the score exist. What is missing is a product decision about which tiers unlock what, and it interacts with fees. |
| Lower platform fees by tier | A pricing decision, not an engineering one. |
| Corporate Ascend | Genuine B2B revenue and a genuinely separate product: org accounts, seat billing, admin roles, department hierarchies. |
| Partner marketplace | Needs partners before it needs code. |
| Emergency / recovery protocol | Buildable now — momentum already detects the collapse. Held back only because "friends notified" needs an explicit consent flow, and notifying somebody's friends that they are failing is the highest-risk feature in the entire brief. |
| Life Replay video | Needs a rendering pipeline; the data behind it exists in Legacy. |
| Personal Board of Directors (AI personas) | Eight advisors generating opinions about somebody's money and appearance, eight times the surface for a confident wrong answer. Would need the same guard architecture Elevate has, per persona. |
| Voice confidence training | Real, and a separate product surface. |

---

## 7. What Layer 1 refuses to do

- **Never invent an input.** Sleep and recovery report as missing, forever, until
  a wearable connection exists.
- **Never publish a score.** A discipline score is a statement about how reliable
  a person is. RLS restricts it to its owner, asserted with two real users.
- **Never show a percentile that identifies people.**
- **Never predict without a stated method** and a minimum sample.
- **Never let two screens compute the same number two ways.** The briefing and
  the OS call one shared derivation; a product that shows a person two different
  values for their own score has destroyed the thing it was selling.

---

## 8. Where the code is

| Concern | File |
|---|---|
| Scoring engines (pure, 41 tests) | `src/lib/intelligence.ts` |
| Signal derivation and loader | `src/lib/lifeOs.ts` |
| The screen | `src/components/life-os.tsx`, `/os` |
| Score in the briefing masthead | `src/lib/briefing.ts`, `src/components/briefing-home.tsx` |
| Snapshots, percentile, RLS | `supabase/migrations/20260728000000_intelligence.sql` |
| Isolation assertions | `supabase/tests/features_isolation.test.sql` |

Review it without a database: `ALLOW_DESIGN_PREVIEW=1 npm run dev`, then
`/design-preview?view=os` and `?view=os-empty`.
