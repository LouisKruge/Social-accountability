# Ascend

A social-accountability app for South African, WhatsApp-first groups. Friends,
family and coworkers join private groups and compete on **rate of improvement** —
savings growth %, debt paydown %, fitness/steps change %, or streak habits.
Because ranking is by percentage change from each person's own baseline, someone
starting from a low point competes on equal footing with someone already ahead.

> **Not in scope (by design):** no money staking/wagering, no payments between
> users, no wearable hard-verification. Entries are self-reported for the MVP.

## Stack

| Concern | Choice |
| --- | --- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind |
| Backend / DB / Auth | Supabase (Postgres + Auth + RLS) |
| Share-card images | `next/og` (`ImageResponse`) — server-rendered PNGs |
| Ranking job | Secured route (`/api/rankings/compute`) → schedule via `pg_cron` / Edge cron |
| WhatsApp fan-out | n8n workflow via webhook (data logic stays in the DB/app) |
| Payments (Phase 4) | Paystack (ZAR subscriptions + webhooks) |
| Hosting | Vercel |

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
database and runs 24 assertions proving User A and User B (in different groups)
cannot read each other's entries, baselines, groups, members, categories or
rankings — and that clients cannot write `leaderboard_rankings`.

### Unit tests

```bash
npm test          # ranking math (incl. the worked example) + edge cases
```

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
  app/                     App Router routes (auth, groups, leaderboard, share, billing)
  components/ui.tsx        Shared mobile-first UI primitives
  lib/
    ranking.ts             Pure ranking business logic (unit-tested)
    period.ts              Weekly period (Mon–Sun) helpers
    entitlements.ts        Free/premium tier gating
    supabase/              client / server / admin (service-role) / middleware
    database.types.ts      Typed schema
supabase/
  migrations/              Schema + RLS (single source of truth)
  tests/                   RLS isolation test + runner
```

See [`DECISIONS.md`](./DECISIONS.md) for architectural decisions and every
deviation from the original spec, with reasoning.
