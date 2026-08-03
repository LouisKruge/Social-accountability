# Ascend

A South African, WhatsApp-first, mobile-primary self-improvement platform. Three
modes under one identity:

| Mode | What it is |
| --- | --- |
| **Climb** | Private groups ranked on **rate of improvement** — savings growth, debt paydown, steps, streak habits. Because ranking is by change from each person's own baseline, someone starting from a low point competes on equal footing with someone already ahead. |
| **Commit** | Stake your own money on your own verified effort. Outcome is decided by verified effort only — never by chance, odds, or a multiplier. |
| **Elevate** | Private styling, grooming and photo coaching, organised around real events in your life — an interview, a wedding, a shoot. No gallery, no comparison, no rating — ever. |

> **Deliberately out of scope.** No randomised bonus, lottery or luck-based
> multiplier anywhere in Commit — that would change its legal classification.
> No deposits or withdrawals until the escrow/custody compliance review is
> done: money movement is **manual bank transfer only**, with no exceptions for
> "just to test it faster". Steps are self-reported; the integrity engine is
> what stands between a typed number and a payout.

## The six design documents

The product is specified across six documents. Read them in this order:

1. [`docs/DESIGN_LANGUAGE.md`](./docs/DESIGN_LANGUAGE.md) — colour, type, spacing, motion, materials, accessibility, and why each decision exists
2. [`docs/CLIMB_PLATFORM.md`](./docs/CLIMB_PLATFORM.md) — groups, ranking, social systems
3. [`docs/COMMIT_PLATFORM.md`](./docs/COMMIT_PLATFORM.md) — challenge lifecycle, wallet, payouts, integrity
4. [`docs/ELEVATE_PLATFORM.md`](./docs/ELEVATE_PLATFORM.md) — the five studios, privacy, content safety
5. [`docs/AI_OPERATING_SYSTEM.md`](./docs/AI_OPERATING_SYSTEM.md) — where a model is used, where it deliberately is not, and the guards
6. [`docs/ENGINEERING.md`](./docs/ENGINEERING.md) — component library, data layer, state, APIs, performance, testing

Plus [`docs/LIFE_OS.md`](./docs/LIFE_OS.md) — the five-layer architecture and
Layer 1's scoring engines (Momentum, Discipline Score, Performance Index, Goal
Simulator), including the coverage rule that keeps them honest about the data
Ascend does not have.

Supporting: [`docs/PRODUCT_AUDIT.md`](./docs/PRODUCT_AUDIT.md) (every known
defect, fixed and open), [`docs/FEATURE_CATALOGUE.md`](./docs/FEATURE_CATALOGUE.md)
(225 features with an honest status on each),
[`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md).

## Stack

| Concern | Choice |
| --- | --- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, Framer Motion |
| Backend / DB / Auth | Supabase (Postgres + Auth + RLS) |
| Share-card images | `next/og` (`ImageResponse`) — server-rendered PNGs |
| Ranking job | Secured route (`/api/rankings/compute`) → schedule via `pg_cron` / Edge cron |
| WhatsApp fan-out | n8n workflow via webhook (data logic stays in the DB/app) |
| Payments | Paystack (ZAR subscriptions + webhooks) |
| Coaching vision | Anthropic Messages API, server-side only |
| Hosting | Vercel, region pinned to `cdg1` to match the database |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

### Database

Apply the migration in `supabase/migrations/` to your Supabase project (via the
Supabase CLI `supabase db push`, the dashboard SQL editor, or MCP
`apply_migration`). Every table has **Row Level Security enabled in the same
migration that creates it**.

### Verify RLS isolation (two-tenant test)

The migration's row-level security is verified against a real Postgres with a
Supabase-compatible `auth` shim. With a local Postgres running:

```bash
bash supabase/tests/run.sh
```

This applies the shim + migration + Supabase-equivalent grants to a throwaway
database and runs **87 assertions** across three suites:

- **Isolation** — User A and User B (in different groups) cannot read each other's
  entries, baselines, groups, members, categories or rankings; clients cannot
  write `leaderboard_rankings`; the opt-in raw-value sharing works; multi-group
  membership doesn't bleed.
- **Feature isolation** — `stakes.amount` and `payment_reference` are asserted
  unreachable by anyone but the stake's owner, explicitly rather than via the
  policy definition; Elevate photos and reports are unreachable by any other
  account.
- **Audit + deletion cascade** — RLS is on for every table, no policy uses
  `USING (true)`, and a POPIA account deletion removes the user's rows across
  **every** table (verified by query), while a category created in someone else's
  group survives (attribution set null).

### Unit tests

```bash
npm test          # 494 tests: ranking, integrity, payouts, wallet, wardrobe,
                  # photo coach, content guards, climb, briefing, formatting
```

### Review the design without a database

```bash
ALLOW_DESIGN_PREVIEW=1 npm run dev
# /design-preview            the Climb face
# /design-preview?view=route the route page
# /design-preview?view=pitch a leaderboard
# /design-preview?view=empty a first-run account
# /design-preview?view=hub   the briefing
# /design-preview?view=os    the Life OS
# /design-preview?view=elevate-os  Elevate's command centre
# /design-preview?view=terminal    Commit's exchange terminal
# /design-preview?view=hq          a club's headquarters
# /design-preview?view=event-tight an event whose windows have closed
# /api/share-card/demo       the rank card
```

The harness renders the **real** components against fixtures. It renders the
real components rather than copies, so it cannot drift and start lying about
what the app looks like.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |

## Project layout

```
src/
  app/                     routes. A page is a loader: auth, load, render
    <route>/loading.tsx    skeleton on every primary route
    <route>/actions.ts     "use server" mutations, colocated
  components/              24 presentational components; none of them fetch
  lib/
    climb.ts               Climb loader + pure ranking helpers
    exchange.ts            Commit loader (modules)
    elevate.ts             Elevate loader (studios)
    briefing.ts            composes all three for /home, in the app layer only
    queries.ts             request-scoped dedupe. Shared rows belong here
    ranking.ts             pure ranking business logic
    integrity.ts           7-signal anti-cheat; worst outcome is "held"
    payoutLifecycle.ts     11-state machine, whitelisted transitions
    glowup.ts              prompt, schema validation, content guard
    motion.ts              four named springs
    format.ts              deterministic number formatting
    timing.ts              AsyncLocalStorage-scoped server timing
    supabase/              client / server / admin (service-role) / middleware
supabase/
  migrations/              schema + RLS (single source of truth)
  tests/                   isolation, feature isolation, audit + runner
docs/                      the six design documents
```

See [`DECISIONS.md`](./DECISIONS.md) for architectural decisions and every
deviation from the original spec, with reasoning.
