# Ascend — product audit

Phase 1 of the Evolution brief: critique everything, and keep asking "what else
is missing?" until nothing meaningful remains.

This is an audit of the **actual repository**, not of an imagined product. Every
finding below is a file and a line you can open. Where something was fixed in
the course of writing this, it says so and names the commit; where it is still
broken, it says that instead. An audit that only lists solved problems is a
press release.

---

## 0. Method

Three passes, in this order, because the order changes what you find:

1. **Read every screen against the design language.** Not "is this nice" —
   *does this obey a rule we already wrote down.* Rules that are written down
   and then violated are worse than no rules, because they make the violations
   invisible: everyone assumes the document is true.
2. **Render it and look at it.** `/design-preview` renders the real components
   against fixtures with no database, at 390 × 844, ×2 DPR. Two of the four most
   serious findings below were invisible in the source and obvious in the
   screenshot.
3. **Follow every figure back to a row.** For each number on screen, find the
   query that produced it. Anything that cannot be traced to a row the user owns
   is either a bug or a lie.

---

## 1. Findings by severity

### S1 — Wrong information shown to the user

| # | Finding | Where | State |
|---|---|---|---|
| 1.1 | **The group list showed an arbitrary leader.** Every rank-1 row for the current period was fetched and keyed into a `Map` by `group_id`. A group with two categories has two rank-1 rows, so the map kept whichever arrived last — the displayed leader changed between page loads for no reason a user could perceive. | `src/app/groups/page.tsx` (old) | **Fixed** — standings computed per `(group, category)`, the grain the unique constraint on `leaderboard_rankings` already uses. `5f820ab` |
| 1.2 | **Ordinals were wrong from 21 upward** on the share card — the most public artifact the product has. `ORDINAL[n] ?? \`${n}th\`` gave "21th", "22th", "23th". `ORDINAL[0]` was `""`, which is not nullish, so a rank of 0 would have rendered an empty string. | `src/app/api/share-card/[rankingId]/route.tsx` | **Fixed** — one tested `ordinal()` in `src/lib/format.ts`, with the teens case as its own test. |
| 1.3 | **`toLocaleString("en-ZA")` on the money screen.** Node and Chromium ship different CLDR data for en-ZA: the same figure rendered "12,400" server-side and "12 400" in the browser. `src/lib/format.ts` was written to eliminate exactly this call and `/you` still had it. | `src/app/you/page.tsx` | **Fixed** — uses `zar()`. |
| 1.4 | **Absolute values had no unit.** A savings row reading `+500` with "FROM ZERO" underneath could be read as 500%. | `src/components/leaderboard-row.tsx` | **Fixed** — the unit moved into the caption, where it fits without wrapping the column. |

### S2 — The design language contradicted by the code that claims to implement it

`docs/DESIGN_LANGUAGE.md` §2 states gold means money confirmed as yours and
nothing else, and red is for genuine errors and destructive actions only. Both
were false across large parts of the app.

| # | Finding | State |
|---|---|---|
| 2.1 | `Button variant="primary"` was **gold for every submit button in the app** — "Create group", "Sign in", "Add pitch", "Join". The accent therefore meant "the button you should press", which is how an accent stops meaning anything. | **Fixed** — primary is white; gold survives as an explicit `money` variant used on exactly one button: `Stake R{amount}`. |
| 2.2 | The **leaderboard leader** sat in a gold ring with a crest glow. A rank is not money. | **Fixed** — rank reads by brightness. |
| 2.3 | A **negative move rendered in red**, on both the leaderboard row and the ascent line's descending gradient. Someone whose savings dipped has not made an error, and they are the person most likely to close the app if the screen shouts. | **Fixed** — grey, with a `↓` glyph carrying the direction. |
| 2.4 | The **share card was entirely the pre-monochrome green palette** — `#0E1712` ground, `#4FB196`/`#7FDCC0` line, `#F3F1EA` type. This is the image people post to WhatsApp status: the single most public surface in the product was the last place still wearing the palette that was removed everywhere else. | **Fixed** — monochrome, one gold tip. |
| 2.5 | **`viewport.themeColor` was `#0E1712`** — a dark green from the old palette. On Android the browser chrome sat in a colour that exists nowhere in the app. | **Fixed** — `#000000`. |
| 2.6 | **Light mode was chosen for the user.** `globals.css` opened the inversion on `@media (prefers-color-scheme: light)`, so a first-time visitor on a phone set to light never saw Ascend's identity at all. Black is the brand; the inversion is a courtesy. | **Fixed** — opt-in through the toggle, inversion otherwise unchanged. |
| 2.7 | The hub carried hardcoded `rgba(127,220,192,…)` mint glows behind each card. | **Fixed** — the hub was replaced entirely (§2 of this document's Phase 2 section). |

### S3 — Structural

| # | Finding | State |
|---|---|---|
| 3.1 | **Climb never got the reinvention.** Commit became an exchange of modules, Elevate became five studios, and `/groups` stayed the Phase-1 MVP: a vertical stack of rounded rectangles. Two thirds of the app followed the design language. | **Fixed** — `docs/CLIMB_PLATFORM.md`, `5f820ab`. |
| 3.2 | **The home screen was a launcher.** Three equal cards asking "which of our three products would you like to open" — a question about the org chart, not about the person holding the phone. | **Fixed** — replaced by the briefing (§2). |
| 3.3 | **The route page was a table of contents.** A card per category with a "Log" button and a "Climb" button, and no indication of whether anything had moved. | **Fixed** — each pitch carries its podium in place. |
| 3.4 | **Eleven queries across three Climb screens**, several in a waterfall behind a category lookup. | **Fixed** — five, in parallel, via `loadClimb()`. |
| 3.5 | **`/billing`, `/join/[code]`, `/share/[cardId]`, `/commit/[id]`, `/commit/market` and four Elevate forms are still card-based.** They are secondary or single-purpose screens and none of them contradicts the palette, but they have not had the structural pass the primary surfaces have. | **Open.** Listed here rather than quietly omitted. |

### S4 — Trust and honesty

| # | Finding | State |
|---|---|---|
| 4.1 | Steps are **self-reported** and there is no device integration. The integrity engine is the only thing between a typed number and a payout. The old `/you` said "Device sync is coming" in small grey text and nothing said what stands in for it meanwhile. | **Fixed** — `/you` now states it plainly. |
| 4.2 | `expectedArrival()` returns **null** rather than guessing a payout date. Correct, and worth recording as a deliberate decision rather than an omission. | Correct as built |
| 4.3 | `cohort_market()` deliberately never returns a `SUM(amount)`. In a two-person cohort, a total plus your own stake gives you the other person's exactly. | Correct as built |
| 4.4 | **The service-role key was briefly present in a public bundle.** Code no longer references it client-side, but the credential itself is still valid until rotated. Code changes do not un-leak a key. | **Open — action outside the repo.** Rotate in the Supabase dashboard. |

### S5 — Not yet verifiable

| # | Finding |
|---|---|
| 5.1 | The Elevate content guard has **never been run against the live model.** `scanText()` and `findProhibitedContent()` are unit-tested against fixtures, and the adversarial test needs `ANTHROPIC_API_KEY` set in the deployment. Until then "the model will not comment on bodies" is a claim about a prompt, not a measured property. |
| 5.2 | No **two-tenant isolation test has been run against the new Climb loader.** The policies are unchanged and the loader only reads through them, but the project's own standard is that isolation is verified with two real users, not inferred from reading policy SQL. |
| 5.3 | The **region fix has not been re-measured.** `vercel.json` pins `cdg1` to match Supabase's `eu-west-3`; the before figure was `wall_ms: 681.9`. There is no after figure yet. |

---

## 2. What else is missing — the questions that produced the rest

The brief says keep asking. These are the ones that produced something.

**"What does a person see the moment they open the app?"** → A launcher asking
them to choose a product. Replaced with the briefing: the one thing it costs the
most to not know, at editorial scale, then everything else that needs them, then
the three modes as an index rather than as a choice. When nothing needs them it
says so — a briefing that always has five things on it is a to-do list nobody
reads by week three.

**"Which figures on screen cannot be traced to a row?"** → All of them can, and
that is now an invariant with a line of copy on the home screen committing to
it. The temptation the brief creates — an "Ascend Score", a "Discipline Credit
Score", a "Confidence Index" — is a number nobody can reproduce from their own
data. See `FEATURE_CATALOGUE.md` for why each was declined rather than built.

**"What happens on the worst day?"** → The week someone goes backwards. Every
red on that path became grey, the ascent line stops reaching gold rather than
turning to alarm, and `momentum()` compares people to their own average rather
than to the group. This is the highest-churn moment in an accountability
product and it was being handled with error styling.

**"What breaks at 00:01 on Monday?"** → Every streak in the product reset to
zero, because the new period was empty. `logStreak()` now measures to last week
when the current one has nothing in it yet. Two empty weeks is still a break.

**"What does the outside world see?"** → The share card. It was the old palette
and had an ordinal bug. It is the only artifact in Ascend a non-user ever sees,
and it had received the least attention of any surface in the product.

**"What is claimed in a document but not true in the code?"** → §S2 above. This
question found more real defects than any other in the audit, and it is the one
most worth repeating on a schedule.

---

## 3. What this audit deliberately does not claim

- It is **not** a claim that the app is now consistent everywhere. §3.5 lists
  six screens that still carry the old card structure.
- It is **not** a security audit. RLS policies were read, not re-tested; §5.2
  says so.
- It contains **no findings about screens that do not exist.** Several items in
  the brief (3D activity maps, voice coach, corporate challenges) have nothing
  to audit, and inventing a critique of unbuilt software would be padding.
