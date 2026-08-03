# Ascend — engineering specification

Document 6 of 6. How the app is actually built: component library, data layer,
state, APIs, motion, performance, testing, and the rules for adding to any of
them.

---

## 1. Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 14.2 App Router | Server Components by default |
| Language | TypeScript, strict | `@/` → `src/`, mirrored in `vitest.config.ts` |
| UI | React 18.3 | `cache()` comes from Next's vendored canary, not stable 18.3 — see §4.2 |
| Styling | Tailwind, tokens only | `tailwind.config.ts` is the scale; arbitrary values must justify themselves |
| Motion | Framer Motion 12 | Four named springs, `src/lib/motion.ts` |
| Data | Supabase (Postgres 17, Auth, Storage, RLS) | `eu-west-3` |
| Hosting | Vercel, `cdg1` | Pinned to match the database — §7.1 |
| Tests | Vitest + a SQL harness | 307 unit tests, 89 SQL assertions |

---

## 2. Layout of the repository

```
src/
  app/                    routes; pages are loaders, not implementations
    <route>/page.tsx      auth + load + render. Usually under 25 lines
    <route>/loading.tsx   skeleton, every primary route
    <route>/actions.ts    "use server" mutations, colocated with their route
    api/                  route handlers
  components/             24 presentational components; no data fetching
  lib/                    domain logic. Server modules import "server-only"
supabase/
  migrations/             9 migrations; RLS in the same file as the table
  tests/                  isolation and audit assertions
docs/                     the six design documents
```

**The rule that keeps this honest: a page fetches and renders, a component
renders, a lib module decides.** A component that queries is a component you
cannot screenshot in the design harness, and the harness is how the design is
actually reviewed (§8.3).

---

## 3. Component library

### 3.1 Frame and primitives (`src/components/ui.tsx`)

`AppShell` owns the gutter, max width and the bottom inset that clears the dock,
so no screen restates them and they cannot drift apart.

`Button` has five variants. The important one is what changed:

```
primary    bg-snow    the brightest thing on screen — emphasis in a monochrome system
money      bg-summit  gold. ONE button in the product uses it: "Stake R{amount}"
secondary  bg-ridge   ring-1 ring-scree
ghost      transparent
danger     fall/15    genuine errors and destructive actions only
```

Primary used to be gold, which made the single accent mean "the button you
should press" — how an accent stops meaning anything. See `PRODUCT_AUDIT.md`
§2.1.

### 3.2 The three mode shells

| Mode | Shell | Structure |
|---|---|---|
| Commit | `exchange-shell.tsx`, `module-shell.tsx` | Module rail + command bar + sheets |
| Elevate | `elevate-shell.tsx` | Studio column |
| Climb | `climb-face/route/pitch.tsx` | Banded index |

Three different structures on purpose. Three modes wearing one layout would look
like one product with three tabs, which is not what Ascend is.

### 3.3 Data visualisation

| Component | What it draws |
|---|---|
| `ascent.tsx` | The signature. Every line starts at a shared origin (your baseline = 0) and climbs. `AscentDefs` is a single gradient sprite rendered once in the layout, so these stay server components with zero client JS |
| `pool.tsx` | Stake pools, all on one real scale |
| `dash.tsx` | `Counter`, `ProgressRing`, `DayBars`, `PaceChart`, `StatTile` |
| `leaderboard-row.tsx` | One rung; rank by brightness |
| `wallet-ui.tsx` | Positions, ROI bar, payout tracker, ledger |

Two bugs worth carrying forward as rules:

- **`DayBars` rendered nothing** because percentage heights inside a flex item
  with indefinite content height resolve to zero. Bars are sized in pixels.
- **The pool vessels were scaled against an invented constant** (`stakeAmount *
  20`), so a R2,000 pool drew emptier than a R1,050 one. Anything comparative
  shares one real scale.

### 3.4 Client-component boundary

27 files carry `"use client"` — forms, the dock, the command bar, `Counter`,
the theme toggle. Everything else is a Server Component.

Server-only modules (`queries.ts`, `timing.ts`, `exchange.ts`, `elevate.ts`,
`wallet.ts`, `commitDashboard.ts`, `climb.ts`, `briefing.ts`) begin with
`import "server-only"`.

That import exists because of a real failure: `exchange-shell.tsx` imported
`MODULES` and `profile-form.tsx` imported `GOAL_LABEL` from server-loader
modules, quietly dragging the database client into the browser bundle. It only
surfaced as a build error once `node:async_hooks` appeared in the graph. Now the
same mistake fails the build immediately and names the file. Client-safe
constants live in `modules.ts` / `studios.ts`; vitest aliases `server-only` to a
stub.

---

## 4. Data layer

### 4.1 One loader per mode

```
loadClimb()      5 queries, parallel   → every Climb screen
loadExchange()   dashboard + wallet    → every Commit screen
loadElevate()    7 queries, parallel   → every Elevate screen
loadBriefing()   all three, parallel   → /home
```

Screens filter the loaded result in memory. A round trip to Paris costs more
than any amount of local filtering.

Bounds are deliberate: Climb fetches twelve periods, **ordered newest-first**
under the limit. Ordering ascending under a limit takes the *oldest* rows and
cuts off the current week — the one week every screen needs.

### 4.2 Request-scoped dedupe (`src/lib/queries.ts`)

Three Commit loaders each needed stakes, cohorts and payouts: seventeen round
trips to render one screen, partly in a waterfall. `queries.ts` gives every
shared table exactly one query site, deduped per request by React `cache()`.

`cache()` ships in the React canary Next vendors, not in stable 18.3, so it is
absent under vitest. The fallback is identity — the dedupe simply does not
happen in a unit test, which is correct: a test never renders a request and must
not fail on a runtime the app never uses.

**The rule for anything added later: if two loaders need the same rows, the
query belongs in `queries.ts`.**

### 4.3 Cross-mode composition

`loadBriefing()` runs all three mode loaders concurrently and composes the
result **in the application layer**. There is no cross-feature join, no shared
view, and no table that reads another mode's rows.

This is a hard constraint. Elevate holds photographs of a person's face; Commit
holds what they staked and what they were paid. A view spanning them turns one
RLS mistake into a breach of both at once. `profiles.id` is the only shared key.

### 4.4 RLS

- Enabled in **the same migration that creates the table**, never in a later
  "security pass".
- No policy on user or tenant data uses `USING (true)`.
- Recursion avoided with `SECURITY DEFINER` helpers: `is_group_member()`,
  `shares_group_with()`, `is_member_of_category_group()`.
- `INSERT ... RETURNING` requires the SELECT policy to pass — a gap that bites
  every time it is forgotten.
- The service-role key is confined to the trusted server-side path
  (`glowupRunner`, the cron job). It is never in client code and never in an
  n8n workflow reachable by untrusted input.
- Two functions are shaped by leak analysis rather than convenience:
  `cohort_market()` returns counts and **never a `SUM(amount)`** (in a
  two-person cohort, total minus your own stake is the other person's exactly);
  `wallet_positions()` takes **no arguments**, so there is no user id to
  substitute.
- `wallet_transactions` has a SELECT policy and **no client write policy** — a
  user who could append to their own ledger could manufacture a balance.

### 4.5 Mutations

Server Actions, colocated as `actions.ts` beside the route that uses them (13
files). They validate, write through RLS with the anon key, and redirect with a
query flag the page turns into one sentence (`pitchNotice()`).

---

## 5. State

There is no client state library, and that is a decision rather than an
omission.

| Kind of state | Where it lives |
|---|---|
| Server data | Fetched per request in a Server Component. `dynamic = "force-dynamic"` — this is money and a leaderboard; both must be fresh |
| Form state | `useFormState` / `useFormStatus` |
| Ephemeral UI | `useState` in the one client component that owns it |
| Theme | `localStorage` + `data-theme`, painted by a blocking script in `<head>` |
| Navigation | The URL |

A store would be a cache of data that must not be cached.

**Theme is the one place a blocking inline script is correct.** Doing it in an
effect flashes the wrong theme on every cold load.

---

## 6. APIs

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/rankings/compute` | Cron secret | Weekly ranking job |
| `POST /api/paystack/webhook` | Signature verification | Subscription lifecycle |
| `GET /api/share-card/[rankingId]` | Public by design | 1200×630 OG image |
| `GET /api/commit/statement` | Session | CSV statement |
| `GET /api/debug/timing` | Session, RLS-bound | Span names, durations, row counts. **No values, no user id, no row contents** |
| `GET /api/debug/session` | Session | Auth diagnostics |

The share card is the only public route that renders user data, and it renders
only what the user chose to publish by creating the card.

---

## 7. Performance

### 7.1 The region

`vercel.json` pins `cdg1`. Supabase is `eu-west-3` (Paris); Vercel's default is
`iad1` (Washington DC). Every query was crossing the Atlantic twice — `wall_ms:
681.9` for an account holding one stake and two open challenges.

**If the database ever moves, move this file.**

### 7.2 Instrumentation (`src/lib/timing.ts`)

`AsyncLocalStorage`-scoped spans. `withTiming()` runs work in a fresh scope and
returns both the result and the report, so a report cannot inherit spans from a
previous request on a warm container.

It was originally scoped with React `cache()`, passed its tests, and then
reported **zero spans in production** on a request that had demonstrably hit the
database — because `cache()` only establishes a scope inside a Server Component
render, and a Route Handler is not a render.

**An instrumentation module that silently reports nothing is worse than none,
because an empty report looks like a fast request.**

The unscoped fallback is a module-level singleton, not a fresh array per call —
a fresh array means every `record()` is discarded, which is the same bug wearing
a different hat, and it was caught the second time while writing the tests.

### 7.3 The rest

- **Skeletons on every primary route.** Next renders them the instant a link is
  tapped. Without them the browser sits on the old page with no feedback, which
  is most of what "slow" actually means.
- **`getSession()` rather than `getUser()` in middleware** — `getUser()` is a
  network round trip to the auth server on every navigation. Pages that act on
  identity still call `getUser()`.
- **Deterministic formatting** (`src/lib/format.ts`). `toLocaleString("en-ZA")`
  is banned: Node and Chromium ship different CLDR data and rendered the same
  figure as "268,400" server-side and "268 400" in the browser — a hydration
  mismatch, on a screen showing somebody's money.

---

## 8. Testing

### 8.1 Unit — 307 tests, 17 files

Pure logic only: ranking, integrity, payout lifecycle, wallet, cohort, stakes,
wardrobe, photo coach, glow-up guards, climb, briefing, format, timing,
queries, paystack.

### 8.2 SQL — 89 assertions

`rls_isolation.test.sql` (34), `features_isolation.test.sql` (35),
`audit.test.sql` (20). **Isolation is verified with two real users and two real
groups, never inferred from reading policy SQL.** `stakes.amount` and
`payment_reference` are asserted unreachable by anyone but the owner, explicitly
rather than via the policy definition.

### 8.3 Visual — `/design-preview`

Renders the **real** components against fixtures with no database
(`ALLOW_DESIGN_PREVIEW=1`). Screenshotted at 390×844 ×2 with the preinstalled
Chromium.

It renders the real components rather than copies. A harness holding a second
implementation drifts within a week and then lies about what the app looks like
— which is worse than having no harness, because people trust it.

This is not decoration: two of the four most serious findings in
`PRODUCT_AUDIT.md` — the app defaulting to light mode, and gold on every submit
button — were invisible in the source and obvious in the first screenshot.

### 8.4 A lesson worth keeping

`vitest.config.ts` was missing the `@/` alias, so a suite silently stopped
*loading* — vitest reports that as a failed **suite**, not failed tests, which
is easy to skim past in a green-looking summary. **88 passing tests were reported
while a suite was not running.** The alias is now pinned, and the config carries
a comment saying why.

---

## 9. Adding to this codebase

1. **A page is a loader.** Auth, load, render. If it exceeds ~25 lines, the
   logic belongs in `lib/`.
2. **Shared rows go in `queries.ts`.** Two loaders needing the same table is the
   signal.
3. **Server modules import `server-only`.** Client-safe constants get their own
   module.
4. **RLS in the creating migration.** Never `USING (true)`. Verify with two real
   users.
5. **Pick from the scales.** If nothing fits, the scale is wrong — fix the
   scale.
6. **One elevation per component.**
7. **Motion from `src/lib/motion.ts`.** If the movement does not say what
   changed, make it a static state.
8. **Gold only for money confirmed as yours. Red only for errors.**
9. **Every figure traces to a row.** If it cannot, it does not ship.
10. **Wrap queries in `timed()`** so the endpoint keeps telling the truth.
