# Ascend — feature catalogue

Phase 8 of the Evolution brief asked for **over 200 meaningful features**.

Here they are, numbered, with a status on every line. The status is the point:
a catalogue where everything says "✅" is a wish list wearing a tick, and it
stops being useful the first time somebody plans against it.

| Status | Meaning |
|---|---|
| **Live** | Built, tested, running. You can open the file. |
| **Spec** | Designed and documented, not built. The decisions are made. |
| **Blocked** | Cannot ship yet, and the blocker is named. Nearly all are legal or hardware, not effort. |
| **Declined** | Deliberately not built. The reason is given, and it is never "too hard". |

Counts, honestly: **169 Live · 48 Spec · 14 Blocked · 19 Declined = 250.**

> **Corrected.** Items 156, 157 and 158 were previously listed as Declined. They
> are now Live — see `LIFE_OS.md` §1. The objection was to a score nobody could
> reproduce; the version that displays every contribution and every missing
> signal is a different thing. Corrected in place rather than quietly edited.

---

## A. Climb — social accountability (1–46)

| # | Feature | Status |
|---|---|---|
| 1 | Private groups ("routes") | Live |
| 2 | Group creation | Live |
| 3 | Unique 8-character invite codes | Live |
| 4 | Join by code | Live |
| 5 | Join by link (`/join/[code]`) | Live |
| 6 | One-tap WhatsApp invite with pre-written message | Live |
| 7 | Copy-link fallback with confirmation state | Live |
| 8 | Owner and member roles | Live |
| 9 | Group roster with owner marking | Live |
| 10 | Categories ("pitches") per group | Live |
| 11 | Four category presets — steps, savings, debt paydown, daily habit | Live |
| 12 | Custom category name and unit | Live |
| 13 | `percentage_change` metric type | Live |
| 14 | `streak` metric type | Live |
| 15 | `increase` direction (savings, steps) | Live |
| 16 | `decrease` direction (debt, weight) — delta flipped so higher always wins | Live |
| 17 | Per-user, per-category baselines | Live |
| 18 | Weekly entry logging | Live |
| 19 | Entry editing within the period | Live |
| 20 | Opt-in raw-value sharing, per entry | Live |
| 21 | Rate-of-improvement scoring from own baseline | Live |
| 22 | Absolute-change fallback when the baseline is zero | Live |
| 23 | `isAbsolute` flagged and labelled in the UI, with its unit | Live |
| 24 | Tie-break by earliest submission | Live |
| 25 | Weekly ranking computation | Live |
| 26 | Owner-triggered manual recompute | Live |
| 27 | ISO Monday–Sunday periods, UTC-stable | Live |
| 28 | Leaderboard per pitch | Live |
| 29 | Podium shown in place on the route page | Live |
| 30 | Viewer's own rung marked by hairline | Live |
| 31 | Per-row trajectory sparkline | Live |
| 32 | Full ascent line for the viewer | Live |
| 33 | Gap to the rung above | Live |
| 34 | Momentum against the climber's own 4-week average | Live |
| 35 | Consecutive-weeks streak with the Monday grace rule | Live |
| 36 | "Strongest move this week" hero across all routes | Live |
| 37 | Best rank per route | Live |
| 38 | Unlogged-pitch detection and prompt | Live |
| 39 | Empty, one-week, and no-position states each written separately | Live |
| 40 | Rank cards (1200×630 OG image) | Live |
| 41 | Public share page | Live |
| 42 | Premium trend chart | Live |
| 43 | Free-plan limits (one owned group, one pitch) | Live |
| 44 | Weekly WhatsApp nudge workflow | Spec |
| 45 | Private leagues across multiple groups | Spec |
| 46 | Corporate / team challenges | Spec |

## B. Commit — the discipline exchange (47–108)

| # | Feature | Status |
|---|---|---|
| 47 | Stake cohorts with target, window and stake amount | Live |
| 48 | Cohort creation flow | Live |
| 49 | Open / running / settled lifecycle | Live |
| 50 | Challenge market | Live |
| 51 | `cohort_market()` returning participant and confirmed counts | Live |
| 52 | Deliberate omission of a pool `SUM` (a two-person total leaks the other stake) | Live |
| 53 | Join with stake, with explicit consent copy | Live |
| 54 | Unique payment reference per stake | Live |
| 55 | Manual EFT confirmation | Live |
| 56 | Daily verification logs | Live |
| 57 | `cohort_progress()` per-cohort board | Live |
| 58 | Pool vessel visualisation on one shared scale | Live |
| 59 | Day bars | Live |
| 60 | Pace chart (actual vs required) | Live |
| 61 | Progress ring | Live |
| 62 | Rolling counters with a reduced-motion equivalent | Live |
| 63 | Cross-cohort standings | Live |
| 64 | Achievements / milestones | Live |
| 65 | Challenge history | Live |
| 66 | Consistency analytics | Live |
| 67 | Best day, best streak, total logged | Live |
| 68 | Integrity engine — 7 signals | Live |
| 69 | Impossible-value ceiling (120k steps) | Live |
| 70 | Implausible-value flag (60k steps) | Live |
| 71 | Source trust weighting per provenance | Live |
| 72 | Outlier detection against the user's own distribution | Live |
| 73 | Duplicate-value detection | Live |
| 74 | Backdated-entry detection | Live |
| 75 | Device-change detection | Live |
| 76 | Integrity score and label | Live |
| 77 | Held-for-review as the worst outcome (effort is never deleted) | Live |
| 78 | Wallet positions — locked, awaiting EFT, coming to you, paid out | Live |
| 79 | Lifetime staked / won / lost | Live |
| 80 | ROI, null before anything settles | Live |
| 81 | Full transaction ledger | Live |
| 82 | Stakes without ledger rows folded in without double-counting | Live |
| 83 | CSV statement export | Live |
| 84 | Payout lifecycle — 11 states, whitelisted transitions | Live |
| 85 | Terminal states (`paid`, `cancelled`) enforced | Live |
| 86 | `fraud_review` clearable only by an operator | Live |
| 87 | Payout tracker with every state transition and its stated reason | Live |
| 88 | `expectedArrival()` returning null rather than guessing | Live |
| 89 | Payout event history | Live |
| 90 | Bank destination capture, last-4 only | Live |
| 91 | Verification flags surfaced to the user | Live |
| 92 | Security event log | Live |
| 93 | Trusted device list | Live |
| 94 | Module rail — every module's state legible from inside any one | Live |
| 95 | Command bar (⌘K-style, touch-first) | Live |
| 96 | Bottom sheets | Live |
| 97 | Seven modules: portfolio, market, treasury, lab, floor, trust, standing | Live |
| 98 | Headline banner ordered by what it costs you not to know | Live |
| 99 | Wearable / health-platform ingestion | Blocked — needs provider credentials |
| 100 | Automated settlement trigger | Spec |
| 101 | Deposits | Blocked — escrow/custody compliance review |
| 102 | Withdrawals | Blocked — escrow/custody compliance review |
| 103 | Instant payouts | Blocked — escrow/custody compliance review |
| 104 | Scheduled payouts | Blocked — escrow/custody compliance review |
| 105 | Multi-bank support | Blocked — depends on 101–104 |
| 106 | Dispute resolution flow | Spec |
| 107 | Tax reports | Spec |
| 108 | Referral and affiliate payouts | Blocked — depends on 101–104 |

## C. Elevate — private styling and confidence (109–152)

| # | Feature | Status |
|---|---|---|
| 109 | Age gate on the entire feature | Live |
| 110 | Style profile — direction, goal mode, budget tier | Live |
| 111 | Goal modes: dating profile, job interview, general confidence | Live |
| 112 | Budget tiers with per-tier guidance in the prompt | Live |
| 113 | "Avoid" list respected by the coach | Live |
| 114 | Photo upload, single-subject by construction | Live |
| 115 | Private storage bucket | Live |
| 116 | Signed URLs only, never public paths | Live |
| 117 | Report generation | Live |
| 118 | Structured-output validation before anything is shown | Live |
| 119 | Prohibited-content scan on every generated report | Live |
| 120 | Body-shape / weight / size commentary forbidden in the system prompt | Live |
| 121 | Stricter-retry instruction on a failed guard | Live |
| 122 | Report rejected outright if the retry also fails | Live |
| 123 | Wardrobe items with category, colour, season, occasion | Live |
| 124 | Cost per wear | Live |
| 125 | Never-worn detection | Live |
| 126 | Capsule gap analysis per occasion | Live |
| 127 | Outfit builder | Live |
| 128 | Colour-compatibility rules | Live |
| 129 | Garment-only vision prompt ("the subject is a garment, not a person") | Live |
| 130 | Garment response validation through the same content scan | Live |
| 131 | Looks — saved outfits | Live |
| 132 | Photo coach shot checklist, rule-based | Live |
| 133 | Best-time-to-shoot by setting | Live |
| 134 | Coach actions with impact / effort / cost | Live |
| 135 | Action states: open, doing, done, dismissed | Live |
| 136 | Transformation timeline | Live |
| 137 | Five studios: style, look, photo, confidence, timeline | Live |
| 138 | "Delete my Elevate data" — photos, reports and every derived row | Live |
| 139 | POPIA-aligned deletion from day one | Live |
| 140 | Quieter register than Commit, deliberately | Live |
| 141 | Garment photo upload wiring to vision | Spec |
| 142 | Virtual try-on | Declined — see §D |
| 143 | Public glow-up gallery | Declined — see §D |
| 144 | "Rate this person" | Declined — see §D |
| 145 | Best-glow-up leaderboard | Declined — see §D |
| 146 | Voice coach | Spec |
| 147 | Multi-person photo analysis | Declined — structurally prevented |
| 148 | Skin / dermatological assessment | Declined — medical advice |
| 149 | Weight tracking inside Elevate | Declined — §D |
| 150 | Before/after comparison shots | Spec |
| 151 | Grooming schedule reminders | Spec |
| 152 | Seasonal wardrobe rotation prompts | Spec |

## D. The declines, with reasons (153–174)

Every one of these was either in the brief or an obvious next step. None was
declined for difficulty.

| # | Feature | Why not |
|---|---|---|
| 153 | Randomised bonus / multiplier | Changes the legal classification under the National Gambling Act. Outcome must come from verified effort, never chance. Non-negotiable. |
| 154 | Lottery or prize-draw element | Same. |
| 155 | Odds, spreads, or betting against others | Same. Ascend is a stake on **your own** verified effort. |
| 156 | ~~"Discipline Credit Score"~~ | **Now Live.** Built with every contribution shown in points and every unmeasured signal listed with its weight. See §G. |
| 157 | "Confidence Index" | **Still declined.** A number on how a person feels about their appearance, derived largely from self-report, presented with the authority of a measurement. The Discipline Score works because every input is an observed action; confidence has no such inputs. |
| 158 | ~~Composite "Ascend Score"~~ | **Now Live as the Discipline Score.** It does not average a percentage against a streak — every signal is normalised to a 0–1 rate first, and the ones that cannot be normalised are excluded rather than coerced. |
| 159 | Public glow-up gallery | Elevate is private by construction. A gallery is the feature that makes people stop uploading. |
| 160 | "Rate this person" of any kind | Same. |
| 161 | Best-glow-up leaderboard | Same. |
| 162 | Weight or body-shape commentary | Forbidden in the system prompt and asserted in tests. |
| 163 | Multi-person photo analysis | The upload UI makes analysing anyone but the account holder structurally impossible. This is a design constraint, not a setting. |
| 164 | Virtual try-on | Requires body-shape modelling — see 162. |
| 165 | Global cross-group leaderboard | A stranger's number is not accountability, and rate-of-improvement is meaningless at internet scale. |
| 166 | Public "who didn't log" broadcasts | The nudge belongs in WhatsApp, from a person. An app that publishes a list of who failed is one people leave. |
| 167 | Sounds | Asked for twice. There is no reliable web equivalent of the OS silent switch; a sound you cannot suppress is worse than none. |
| 168 | Confetti / particle celebrations | The casino register three passes were spent avoiding. |
| 169 | Haptics | `navigator.vibrate` does not exist on iOS Safari — the majority of this audience. |
| 170 | A second accent colour | The amber only reads as expensive because it is alone. |
| 171 | Radial menus / gesture shortcuts | Undiscoverable, fight the browser's own gestures, no accessible equivalent. |
| 172 | Live activity ticker of other users | Would need fabricated events to look alive. Ships when there is real activity, driven by Supabase realtime, and shows nothing when nothing is happening. |
| 173 | JS overscroll rubber-banding | An imitation always feels like an imitation. |
| 174 | Cross-feature database joins or shared views | One RLS mistake would breach Elevate's photographs and Commit's money at once. `profiles.id` is the only shared key. |

## G. Layer 1 — the Life OS (226–250)

Detail in `LIFE_OS.md`.

| # | Feature | Status |
|---|---|---|
| 226 | Momentum Score — EWMA + consecutive-miss penalty | Live |
| 227 | One missed day barely moves it (asserted) | Live |
| 228 | Seven consecutive misses crash it (asserted) | Live |
| 229 | Scattered misses cost far less than consecutive ones | Live |
| 230 | A huge day is capped at full credit, never banked | Live |
| 231 | Discipline Score, 300–1000, nine weighted signals | Live |
| 232 | Per-signal contribution shown in points | Live |
| 233 | Unmeasured signals listed with their weight, excluded from the maths | Live |
| 234 | Coverage percentage displayed beside the score | Live |
| 235 | Score bands (Just started → Exceptional) | Live |
| 236 | Status tiers: Explorer → Builder → Performer → Elite → Titan → Legend | Live |
| 237 | Points-to-next-tier | Live |
| 238 | Daily score snapshots, upserted so reopening cannot inflate an index | Live |
| 239 | Personal Performance Index, rebased to 1000 | Live |
| 240 | Index change percentage | Live |
| 241 | Volatility, computed from the unrounded index | Live |
| 242 | Percentile with a 20-user minimum cohort | Live |
| 243 | Goal Simulator across candidate daily rates | Live |
| 244 | Simulation conditioned on the person's own variance, both directions | Live |
| 245 | Eight-day minimum before any probability is shown | Live |
| 246 | Pace projection: probability, required rate, expected completion day, risk band | Live |
| 247 | Life Portfolio with percentage/points units per area | Live |
| 248 | "no comparison yet" / "not measured" / "from zero" instead of a fake 0% | Live |
| 249 | Legacy record — lifetime totals since the first logged day | Live |
| 250 | Morning brief built only from rows that exist | Live |
| — | Sleep, HRV, resting heart rate, recovery, mood, calendar, spending | Blocked — no integration; reported as missing, never generated |
| — | AI Twin / behavioural prediction | Declined — see `LIFE_OS.md` §4 |
| — | Seasons, Prestige, Achievement Vault, Corporate, Marketplace, Life Replay, Board of Directors | Spec — `LIFE_OS.md` §6 |

## E. AI (175–190) — detail in `AI_OPERATING_SYSTEM.md`

| # | Feature | Status |
|---|---|---|
| 175 | Vision report on the user's own photos | Live |
| 176 | Structured JSON output with schema validation | Live |
| 177 | Two-stage content guard (scan + prohibited-content check) | Live |
| 178 | Stricter retry, then hard rejection | Live |
| 179 | Goal-conditioned system prompts | Live |
| 180 | Budget-conditioned recommendations | Live |
| 181 | Garment-only vision path | Live |
| 182 | Rule-based photo coaching (no model in the loop) | Live |
| 183 | Rule-based briefing (no model in the loop) | Live |
| 184 | Rule-based integrity assessment (no model in the loop) | Live |
| 185 | Adversarial guard test against the live model | Blocked — needs `ANTHROPIC_API_KEY` in the deployment |
| 186 | AI weekly report | Spec |
| 187 | AI monthly review | Spec |
| 188 | Habit correlation engine | Spec |
| 189 | Performance forecasting | Spec |
| 190 | Goal simulator | Spec |

## F. Platform, security, performance (191–225)

| # | Feature | Status |
|---|---|---|
| 191 | Email/password auth | Live |
| 192 | Session refresh in middleware | Live |
| 193 | Public-path allow-list | Live |
| 194 | Row-level security on every user table, in the creating migration | Live |
| 195 | `SECURITY DEFINER` helpers to avoid RLS recursion | Live |
| 196 | Two-tenant isolation test as a phase gate | Live |
| 197 | Paystack subscriptions | Live |
| 198 | Payment webhook with signature verification | Live |
| 199 | Entitlements / premium gating | Live |
| 200 | Account deletion | Live |
| 201 | Elevate data deletion, independent of account deletion | Live |
| 202 | Theme toggle with blocking first-paint script | Live |
| 203 | Dark by default, light opt-in | Live |
| 204 | Floating glass dock with a travelling `layoutId` pill | Live |
| 205 | Loading skeletons on every primary route | Live |
| 206 | `Server-Timing` header | Live |
| 207 | `AsyncLocalStorage`-scoped span collection | Live |
| 208 | Authenticated timing endpoint (names and durations only) | Live |
| 209 | Request-scoped query dedupe | Live |
| 210 | Region pinned to match the database | Live |
| 211 | `server-only` build-time guard on server modules | Live |
| 212 | Deterministic number formatting (no CLDR drift) | Live |
| 213 | Design harness rendering the real components | Live |
| 214 | 348 unit tests, 83 SQL assertions | Live |
| 215 | Reduced-motion equivalents on every animation | Live |
| 216 | 48px minimum tap targets | Live |
| 217 | 16px minimum input text (prevents iOS zoom-on-focus) | Live |
| 218 | Focus rings on every interactive element | Live |
| 219 | Biometric auth / passkeys | Spec |
| 220 | 2FA | Spec |
| 221 | Behavioural biometrics | Declined at this stage — cannot be built honestly without far more traffic than the product has |
| 222 | GPS validation of activity | Spec |
| 223 | Audit log surfaced to the user | Spec |
| 224 | Service-role key rotation | **Blocked — action outside the repository** |
| 225 | Live region re-measurement after the `cdg1` pin | Blocked — needs one production request |

---

## How to read the blocked list

Eight of the fourteen blocked items (101–105, 108, and the two dependent
payout features) are one decision away: **the escrow and custody compliance
review**. Until that is done, money movement is manual bank transfer only, with
no exceptions for "just to test it faster". That constraint is the reason the
wallet reports *positions* rather than a spendable balance — rendering a balance
would imply custody Ascend does not have and is not licensed to hold.
