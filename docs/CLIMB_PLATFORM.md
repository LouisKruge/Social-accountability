# Climb — the social accountability experience

Commit is money. Elevate is the mirror. **Climb is other people**, and it is the
only one of the three where the thing that changes your behaviour is not in the
app at all — it is the person in the group chat who will notice you did not log.

This document is the third of the mode-level design documents, alongside
`COMMIT_PLATFORM.md` and `ELEVATE_PLATFORM.md`. It exists because Climb shipped
first, as the original MVP, and then sat untouched while the other two modes
were rebuilt — so by the time the design language was written down, Climb was
the one section that did not follow it.

---

## 1. What Climb actually competes on

**Rate of improvement from your own baseline.** Not absolute standing.

```
pct_change = ((current − baseline) ÷ |baseline|) × 100
```

That single decision is the product. A person with R400 saved competes on level
terms with someone holding R40 000, because both are measured against where
*they* started. It is the reason someone furthest behind will still open the app
in week three, and every screen in this section has to keep saying it.

Two consequences the maths forces, both handled in `src/lib/ranking.ts`:

- **`direction: "decrease"`** — for debt paydown and weight, bringing the number
  *down* is progress, so the delta is flipped to keep "higher score is better"
  true everywhere.
- **A baseline of zero has no percentage.** Saving from R0 cannot be expressed
  as a percentage of anything. Those entries report the **absolute** change and
  are flagged `isAbsolute`, and the UI labels them "from zero · ZAR" rather than
  quietly showing a number that looks like a percentage. There is no honest
  percentage of nothing.

---

## 2. The structure: a face, routes, pitches

Commit's information architecture is a grid of module tiles. Elevate's is a
column of studios. Copying either into Climb would have produced three modes
that look identical and mean different things, so Climb took the terrain the
product is named after:

| Surface | Route | What it is |
|---|---|---|
| **The face** | `/groups` | Every route you are on, and your strongest move this week |
| **A route** | `/groups/[id]` | One group — its pitches, its roster, its invite |
| **A pitch** | `/groups/[id]/categories/[categoryId]/leaderboard` | One category's leaderboard. The actual product |

**The URLs did not change.** Invite links of the form `/join/[code]` are already
in people's WhatsApp history, and renaming a route to match a metaphor is not
worth breaking a link somebody sent their mother.

### The face is a banded index

Each route is a full-width band with its own masthead at `text-title`, and its
pitches are hairline rows beneath it. Nothing is a card. This is a third
structure, distinct from Commit's tiles and Elevate's studio column, and it is
the right one here because routes are heterogeneous containers rather than
peers — a group with four pitches and a group with one are not two equal
rectangles.

### The route page shows standings in place

The old version was a table of contents: a card per category with a "Log" button
and a "Climb" button, and no indication of whether anything had moved. You had
to open a leaderboard to discover the answer to the only question you had.

Each pitch now carries its own podium — top three, in place, with the tap
targets underneath. **The standings are the product; a screen that hides them
behind a tap is a menu pretending to be a page.**

---

## 3. The figures, and why each one is honest

Every number on a Climb screen is read from the database or derived
arithmetically from numbers that were. The interesting cases are the ones where
the obvious implementation would have lied.

### The hero is one move, not a score

`bestMove()` returns the viewer's **strongest single move this week** — one
pitch, one figure, attributable.

It would have been easy to average everything into an "Ascend score". That
number would be invented: a 12% savings gain and a 14-day streak are different
units, and any single value combining them is one no user could reproduce from
their own data. So percentage pitches are ranked against percentage pitches, and
a streak is only ever reported when there is no percentage pitch at all.

A negative move is still reported. Going backwards is information, and
suppressing it would make the hero a highlight reel — the opposite of an
accountability product.

### Momentum is measured against yourself

`momentum()` compares this week to the viewer's **own** average over the
previous four periods, not to the group's.

Someone moving +4% a week is not slow. They are steady, and the only useful
thing to tell them is whether this week beat their own average. A move inside
one unit — one percentage point, or one day on a streak — reads as *steady*
rather than as a trend, because calling noise a trend is a fake insight and
people can tell.

### The streak has a Monday rule

`logStreak()` counts consecutive periods with an entry. If the current week has
nothing in it yet, the count is measured to last week instead.

Without that, every streak in the product collapses to zero at 00:01 on Monday
and rebuilds itself when the user logs — which is not what a streak means, and
punishes people for the passage of time rather than for stopping. Two empty
weeks in a row is still a genuine break, and reads as one.

### The gap returns null, not zero

`gapToNext()` is null at rank 1 and null for an unranked viewer. "You are 0
away from the person above you" is false in both cases, and a falsy-checked zero
would have rendered as no gap at all — the same bug wearing a disguise.

---

## 4. Privacy: rate is public, the number is not

This is the constraint the whole section is built around, and it is why anyone
would put a real figure into an app their friends can see.

- **`entries.share_raw_value` defaults to `false`.** The group sees your rate of
  change. Nobody sees your raw number unless you opted in, per entry.
- Two permissive SELECT policies on `entries` — your own rows, and shared rows
  in groups you belong to — OR together, so one query returns both sets and
  neither can leak past the other.
- `leaderboard_rankings` is readable only via `is_group_member(group_id)`.
- Profiles are visible through `shares_group_with()` and nothing else.

Someone competing on debt paydown is publishing a **rate**, not a balance. If
that distinction ever breaks, the product does.

---

## 5. What the rebuild fixed

### The leader-per-group bug

The old `/groups` fetched every rank-1 row for the current period and keyed a
`Map` by `group_id`. In a group with more than one category that map keeps
whichever row arrived last — so the "leader" shown on the group list was
arbitrary, and changed between page loads for no reason a user could see.

Standings are now computed per `(group, category)`, which is the grain the
unique constraint on `leaderboard_rankings` already uses.

### Gold on a leaderboard

The leader's row sat in a gold ring with a crest glow, and a negative move
rendered in red.

Both broke the palette's only rule. **Gold means money confirmed as yours and
nothing else** — using it for a leaderboard position made the single accent mean
"important", which is how an accent stops meaning anything. **Red is reserved
for genuine errors and destructive actions**, and someone whose savings dipped
has not made an error; they have had a bad week, and they are the person most
likely to close the app if the screen shouts at them.

Rank now reads by **brightness**: the leader is the brightest thing in the list
and every rung below recedes toward grey. A descent reads in grey with a `↓`
glyph. In a monochrome system brightness is a stronger signal than a hue anyway,
and it costs no colour.

The same audit found `Button variant="primary"` painting **every** submit button
in the app gold — "Create group", "Sign in", "Add pitch". Primary is now white;
gold survives as an explicit `money` variant, used on exactly one button in the
product: `Stake R{amount}`.

### Light mode was being chosen for people

`globals.css` opened light mode on `@media (prefers-color-scheme: light)`, so a
first-time visitor on a phone set to light never saw what Ascend looks like.
Black is the identity; the inversion is a courtesy. Light mode is now reached
only through the toggle, and the full inversion is unchanged behind it.

(`viewport.themeColor` was also still `#0E1712`, a dark green from the
pre-monochrome palette — a colour that no longer exists anywhere in the app.)

### Seventeen round trips became five

Every Climb screen used to issue its own queries: three on the group list, three
on a group, five on a leaderboard, several of them in a waterfall behind a
category lookup, each preceded by an auth round trip.

`loadClimb()` issues **five, in parallel**, and every screen filters the result
in memory. A round trip to Paris costs more than any amount of local filtering,
which is the same conclusion the Exchange reached — see `PERFORMANCE.md`.

Bounded deliberately: rankings and entries are fetched for the last twelve
periods only, ordered **newest first** under the limit. Ordering ascending would
have taken the oldest rows and cut off the current week — the one week every
screen actually needs.

---

## 6. Deliberately not built

| Asked for / obvious | Why not |
|---|---|
| A composite "Ascend score" across pitches | §3. It is arithmetic on incompatible units, and no user could reproduce it. |
| A global leaderboard across all groups | Climb is people who know you. A stranger's number is not accountability, it is a scoreboard, and it makes the rate-of-improvement framing meaningless at scale. |
| Streaks as the headline metric | A streak measures showing up, not improving. It is a supported pitch type, never the hero when a rate exists. |
| Public shaming / "who didn't log" broadcasts | The nudge belongs in WhatsApp, from a person. An app that publishes a list of who failed is one people leave. |
| Money anywhere in Climb | Climb has no stakes and no payouts. That is Commit's job, and mixing them would put a gambling-adjacent surface in front of people who never opted into one. |

---

## 7. Where the code is

| Concern | File |
|---|---|
| Ranking maths (pure, tested) | `src/lib/ranking.ts` |
| Section loader + pure logic | `src/lib/climb.ts` |
| Weekly period arithmetic | `src/lib/period.ts` |
| The face | `src/components/climb-face.tsx` |
| A route | `src/components/climb-route.tsx` |
| A pitch | `src/components/climb-pitch.tsx` |
| One rung | `src/components/leaderboard-row.tsx` |
| The signature line | `src/components/ascent.tsx` |
| Schema + RLS | `supabase/migrations/20260725000000_init.sql` |

`/design-preview` renders the **real** components against fixtures, so the
design can be reviewed and screenshotted without a database
(`ALLOW_DESIGN_PREVIEW=1`; views: default, `route`, `pitch`, `empty`). It
renders the real components rather than copies — a harness holding a second
implementation drifts within a week and then lies about what the app looks like.
