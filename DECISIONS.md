# DECISIONS.md

Running log of architectural decisions and deviations from the build spec, with
reasoning. Newest entries are appended per phase.

---

## Environment / scope (read first)

- **This build produces the complete application codebase + migrations + tests**,
  committed to the repo. It does **not** silently provision the user's live cloud
  accounts (Supabase project, Vercel, n8n, Paystack). Reason: the only existing
  ACTIVE Supabase project in the org (`flwmaqotaxfwgkkgsmth`) is already running a
  **different** application (an ERP-style app with `jobs`, `invoices`, `suppliers`,
  a 798-row `catalog`, payroll, etc.) and has a live `profiles` table with real
  rows. Applying the Ascend schema there would collide with and pollute a running
  app, so it was left untouched. Standing up a dedicated Ascend project is a
  billable, user-owned decision surfaced to the user rather than done unilaterally.
- **RLS is nonetheless verified for real**, not just on paper: the migration is
  applied to a local Postgres 16 with a Supabase-compatible `auth` shim, and a
  two-tenant isolation test (`supabase/tests/`) runs 24 assertions proving one
  tenant cannot read another's data. This satisfies the spec's "actual two-tenant
  isolation test, not inferred from reading the policy SQL" requirement in a way
  that's reproducible on any machine (`bash supabase/tests/run.sh`).

---

## Phase 0 — Scaffold

- **Stack pinned:** Next.js 14.2.x (App Router) + React 18 + TypeScript +
  Tailwind. `@supabase/ssr` for cookie-based auth. Next was bumped to `14.2.35`
  (patched) after the initial `14.2.15` install flagged a security advisory.
- **`@supabase/supabase-js` pinned to `2.45.4`** to match the type contract of
  `@supabase/ssr@0.5.2`. The caret range had floated to `2.110.x`, whose
  `SupabaseClient`/schema generics drifted and made typed `.insert()` resolve to
  `never`. Pinning keeps the generated `Database` types sound.
- **RLS recursion fix (deviation from the spec's literal SQL).** The spec's
  policies self-reference `group_members` (e.g. a `group_members` SELECT policy
  that sub-selects `group_members`), which causes Postgres **RLS infinite
  recursion**. All membership checks are routed through `SECURITY DEFINER` helper
  functions — `is_group_member(group_id)` and `shares_group_with(other_user)` —
  which run with the definer's rights and do **not** re-trigger RLS on the table
  being checked. Same technique for the cross-group `profiles` visibility rule.
- **`join_group_by_code(text)` and `preview_group_by_code(text)` RPCs
  (`SECURITY DEFINER`).** A non-member can't `SELECT` a group (correct — the
  `groups` policy is members-only), so they can't resolve an invite code to a
  group id. These definer RPCs let a user join / preview by code **without**
  exposing or enabling enumeration of other groups. `preview` returns only
  non-sensitive metadata (name + member count).
- **Signup + group triggers.** `handle_new_user` (on `auth.users` insert) creates
  the `profiles` row and a `free` `subscriptions` row. `handle_new_group` adds the
  owner as an `owner` member automatically, so group creation is atomic.
- **Owner-leave guard.** `protect_owner_membership` (BEFORE DELETE) stops a group
  owner from leaving a group they still own, preventing orphaned groups.
- **Indexes added up-front** (spec defers them to Phase 5). They're pure upside and
  belong with the tables; documented here rather than held back artificially.
- **Schema additions (documented deviations):**
  - `leaderboard_rankings.is_absolute boolean` — needed to represent the
    baseline-0 fallback (absolute change instead of %), which the spec's business
    rules require flagging but the spec's table couldn't express.
  - `categories.direction ('increase'|'decrease')` — distinguishes "higher is
    better" (savings, steps) from "lower is better" (debt paydown, weight loss)
    so ranking math is correct for both. Needed for Phase 3 category types; added
    now because it's part of the metric's meaning, not a feature.
  - `profiles.notify_whatsapp boolean` — notification preference for the Phase 2
    WhatsApp fan-out.
  - `subscriptions.paystack_subscription_code` + `unique(user_id)` — needed by the
    Phase 4 webhook to map Paystack events to a single subscription row per user.
- **`set check_function_bodies = off`** at the top of the migration so the
  `language sql` helper functions can be created before the tables they
  reference (forward references). Standard, safe migration practice.

## Business logic

- **Ranking is pure and unit-tested** (`src/lib/ranking.ts` + `ranking.test.ts`,
  10 tests). `computeScore` handles: increase vs decrease direction, the
  baseline-0 absolute fallback, null baselines, and streaks. `rankEntries` sorts
  by score desc with earliest-submission tie-breaking, giving distinct ranks.
- **Absolute vs percentage entries in one ranking.** When some users start from a
  0 baseline (absolute change) and others have a real percentage, the two aren't
  strictly comparable. For the MVP we still rank everyone by score and mark the
  absolute entries distinctly in the UI (the spec's stated intent: "flag it
  distinctly rather than dividing by zero"). Flagged as a known caveat to revisit
  with the Phase 3+ momentum score.

## Entitlements (used from Phase 1, enforced in Phase 4)

- **Free tier = own 1 group + create 1 category.** *Joining* a friend's group via
  invite is always free — gating joins would kill virality. The limit is on
  *owning/creating*. This is the reading of "Free tier: 1 group, 1 category" that
  keeps the growth loop intact.
