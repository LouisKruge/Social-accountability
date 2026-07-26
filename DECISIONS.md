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

## Phase 2 — Social virality

- **Share cards via `next/og` `ImageResponse`** (the `@vercel/og` engine, native
  to Next). Verified end-to-end in this environment: `/api/share-card/[rankingId]`
  returns a real 1200×630 PNG. No emoji in the PNG (satori needs an emoji font);
  rank is rendered as `1st/2nd/3rd`.
- **Public share access uses the service role, gated by `is_public`.** The public
  `/share/[cardId]` page and the OG image are unauthenticated, but the anon role
  can't read `leaderboard_rankings` (members-only, correctly). So the server
  loads the card via the service-role admin client **only when a `share_cards`
  row is public**, and exposes only the safe derived fields (name, rank, %). This
  respects the opt-in without weakening RLS. (`src/lib/shareData.ts`.)
- **Route kept as `/api/share-card/[rankingId]`** per the spec, but it renders
  only rankings that have a public share card — so a bare/guessed ranking id
  won't produce an image.
- **Middleware exempts `/api/*`** from the login redirect. API routes
  authenticate themselves (bearer secret / webhook signature); redirecting them
  to `/login` (307) would break the cron trigger. Verified: compute endpoint now
  returns 401 for missing/bad tokens and proceeds with a valid one.
- **n8n receives only a safe derived payload**, never the service-role key or DB
  access (`docs/n8n-whatsapp-workflow.md`). The app posts name/rank/%/phone; n8n
  owns WhatsApp send + top-3 share-card requests.
- **Scheduling documented, not hard-coded** (`docs/scheduling.md`): canonical path
  is Supabase `pg_cron` + `pg_net` POSTing to the compute endpoint (keeps the
  schedule next to the data), with Edge-Function-cron and Vercel-Cron
  alternatives. Not auto-applied in the migration because it needs project
  settings (endpoint URL + secret) and optional extensions.
- **Invite link `/join/[code]`** previews the group via the anon-safe
  `preview_group_by_code` RPC and routes signup/login back to the invite with
  `redirectTo`, so the WhatsApp-shared link is a one-tap join.

## Phase 3 — Expand categories

- **The data model + ranking logic already carried all three category types** —
  the migration's `metric_type` ('percentage_change' | 'streak') and `direction`
  ('increase' | 'decrease'), plus `computeScore`, cover savings %, debt paydown %,
  steps %, and streaks from day one. Phase 3 was therefore mostly correctness
  proof + presentation, not new plumbing.
- **Streak rendering** is metric-aware everywhere (leaderboard, OG image, public
  share page): a streak shows as "12 days" with a 🔥 badge, no +/− sign and no
  "abs" tag (which is reserved for the baseline-0 percentage fallback). Added
  `formatMetric()` and threaded `metric_type` through `shareData`.
- **All three types proven to rank correctly** via new unit tests: an increase %
  worked example, a decrease/debt worked example, and a streak-length ranking.
- **Multi-group isolation proven**: the isolation test now gives Alice a *second*
  group with a streak category and asserts a member of only her first group can't
  see any of it — 29 assertions total, still green. A user belonging to 2+ groups
  is native (the `/groups` list and RLS are per-membership); no bleed.

## Phase 4 — Monetization (Paystack)

- **Subscription checkout** via Paystack `transaction/initialize` with the premium
  `plan` code; the user is redirected to Paystack's hosted checkout. We pass
  `metadata.user_id` so the webhook can map the resulting charge back to our user.
- **Webhook maps events without storing emails.** Resolution order:
  `metadata.user_id` (present on the first charge) → else look up the
  `subscriptions` row by `paystack_customer_id` (stored on that first charge). So
  renewals, which may lack metadata, still resolve. This is why we *didn't* add an
  `email` column to `profiles` — co-members can read profiles, and emails
  shouldn't leak; the customer-code mapping avoids it entirely.
- **Webhook signature verification is unit-tested** (`paystack.test.ts`, 5 tests):
  HMAC-SHA512 of the raw body keyed by the secret, timing-safe compare. Accepts a
  valid signature; rejects tampered body, wrong secret, short, and missing
  signatures. The route reads the raw text body (not parsed JSON) so the HMAC
  matches byte-for-byte.
- **Subscription writes are service-role only.** `subscriptions` has a
  select-own RLS policy and **no** client write policy — only the webhook (service
  role) sets `tier`/`status`, so a user can never self-upgrade.
- **Paywall** is enforced server-side in the create actions via
  `canCreateGroup` / `canCreateCategory` (free = own 1 group + 1 category); the UI
  surfaces upgrade links at each limit and a `/billing` page drives checkout.
- **Premium value shipped**: a dependency-free historical **trend chart**
  (`TrendBars`) on the leaderboard, gated to premium with a locked teaser for free
  users — the second premium benefit alongside unlimited groups/categories.
- **`server-only` in the Paystack + admin modules** keeps the secret key out of
  any client bundle (the build fails if imported client-side); the signature test
  mocks `server-only` to exercise the pure crypto.

## Phase 5 — Hardening & polish

- **Found and fixed a deletion-blocking FK bug.** `groups.owner_id` and
  `categories.created_by` referenced `profiles` with **NO ACTION**, so deleting an
  account that owned a group or created a category would have been *blocked* by the
  FK — POPIA erasure would silently fail. Fixes: `groups.owner_id ON DELETE
  CASCADE` (erase your groups when you erase your account) and
  `categories.created_by ON DELETE SET NULL` + nullable (a category you created in
  *someone else's* group survives, losing only attribution). Both paths are now
  proven by query in `supabase/tests/audit.test.sql`.
- **Deletion cascade verified across every table** (10 assertions): after deleting
  the auth user, zero rows remain in profiles, groups, group_members, categories,
  baselines, entries, rankings, share_cards, and subscriptions.
- **RLS audit is automated, not eyeballed** (`audit.test.sql`): asserts RLS is on
  for every public table, that **no** policy uses `USING (true)`/`WITH CHECK
  (true)`, and that every table has at least one policy. Runs on every
  `supabase/tests/run.sh` (45 assertions total across the suite).
- **Indexes** cover every foreign key and hot query path, including the two added
  in this phase (`groups(owner_id)`, `categories(created_by)`), plus the
  spec-named `group_members(user_id)`, `entries(category_id, period_start)`, and
  `leaderboard_rankings(group_id, category_id, period_start)`.
- **Mobile-first + error states.** Layout uses a single `max-w-lg` column, relative
  units, and comfortable tap targets. Every form surfaces failures via `ErrorNote`
  (auth, group create/join, category, entry, profile) and friendly messages for
  invalid/expired invite codes; leaderboard and billing render query-param error
  states. Small JS bundles (first-load ≈ 96–98 kB) keep it fast on mobile data.

## Known follow-ups (flagged, not built — out of current scope)

- **Momentum score** (spec's optional v2): exponential-decay weighting so
  acceleration beats a single early jump. Deferred as specified.
- **Mixed absolute/percentage ranking** within one category (some users baseline-0)
  is ranked by raw score with the absolute entries flagged; a fairer normalization
  is a future refinement.
- **Phone OTP auth** (spec's fast-follow) — email/password ships now.
- **Live provisioning** (Vercel, n8n, Paystack keys) is a user-owned step; see
  the top-of-file environment note.

## Live Supabase provisioning (post-build, at the user's request)

- Provisioned a **dedicated** Supabase project `ascend`
  (ref `zpjjjcblgeoznofyfdha`, region eu-west-3, $0/mo) — separate from the
  org's existing active project (which runs a different app), which was left
  untouched.
- Applied both migrations via MCP `apply_migration`. `list_tables` confirms RLS
  on all 9 tables; the security advisor reports **no ERROR-level** findings.
- **RLS verified against the live project** (not just local): created two real
  auth users in different groups and confirmed via direct SQL (impersonating each
  with `set role authenticated` + JWT claims) that neither can read the other's
  group/entries/baselines/categories/profile; that invite-code join then reveals
  only the group (never private entries/baselines); that opt-in sharing works;
  and that an authenticated client cannot insert into `leaderboard_rankings`.
  Deleting the two users (one a group **owner**) removed every related row —
  POPIA cascade verified live too. All test data was then cleaned up (tables back
  to 0 rows).
- **Advisor follow-up** (`20260725000100_harden_function_grants.sql`): pinned
  `search_path` on the one trigger fn missing it, and revoked EXECUTE on the
  trigger functions + `delete_my_account` from `anon` (and the triggers from
  `authenticated`) so they're off the REST RPC surface. The remaining advisor
  WARNs are the intentional, `auth.uid()`-scoped RLS helpers and invite RPCs.

---

## Visual identity — the ascent line (design pass)

### Where the design came from
The palette and motif are derived from the product's own mechanic, not from a
generic "social/leaderboard app" template. Ascend's distinguishing feature is
that **nobody competes on absolute standing** — everyone shares one starting
line at 0% and only distance travelled from it counts. Two consequences:

1. **The ascent line is the data model drawn literally**, not decoration. Every
   line — hero, row sparkline, share card — starts at a shared left-hand origin
   and climbs. A faint origin rule appears on each row so a column of them
   visibly climbs from one common baseline.
2. **Colour encodes altitude.** A cold dark valley floor (`valley #0E1712`)
   warming to summit light (`summit #E8B84B`), with `ice #7FDCC0` as the cold
   start. Line strokes run ice → gold along their length, so gold only ever
   appears at the point you have climbed to.

### Self-critique that changed the plan
- The starting palette (near-black + a green accent) sat one step from the
  generic "dark mode + one acid accent" look. Kept the hex values (all pass AA,
  see below) but changed how they deploy: gold renders as *light* (soft blooms,
  gradient tips), never a flat neon fill; two accents with fixed meanings rather
  than one; a green-tinted rather than neutral base.
- Dropped the generic dashboard hero ("big stat + supporting stats row"). The
  hero **is** the trajectory, with rank as a number beside its leading tip. No
  gridlines, axes or legends — these read as trajectories, not plotted charts.
- Dropped emoji medals (🥇) — carnival, not trophy room. Rank 1 earns summit
  light (warm ring + crest glow) instead.

### Critique after building, from screenshots
- **Gold had degraded into "any positive number"** — every positive % rendered
  gold, which destroys the restraint rule. Fixed: only rank 1 gets gold in the
  list; everyone else's climb reads in plain snow. Verified in `leaderboard3.png`.
- The hero's summit bloom was **clipped by the SVG viewport**, leaving a
  hard-edged patch. Fixed with `overflow-visible` and a smaller radius.
- Row sparklines were too small to differentiate; enlarged to 68×28 with more
  amplitude. Note they are **self-normalised** — they show the shape of a climb,
  not magnitude relative to others; the % column does the comparing.
- At 320px, names truncated to "Tha…". The sparkline now steps aside below
  360px so names stay whole.
- The share card's first composition ran **the ascent line straight through the
  headline number**. Recomposed into split zones (type left, climb right).

### Type
Space Grotesk Variable (display/numbers), Inter Variable (body), IBM Plex Mono
with `tabular-nums` for every columnar figure. Self-hosted via fontsource so the
build never depends on a runtime font fetch. Clash Display / General Sans from
the original brief are Fontshare-only and not reliably installable here; Space
Grotesk was chosen as the closest available geometric display face with real
character.

### Verified, not assumed
- Contrast (computed): gold-on-pine **9.90**, mint-on-pine **11.22**,
  snow-on-pine **16.16**, sage-on-pine **6.18**, and both accent-as-button
  pairings ≥ 9.9 — all pass WCAG AA for normal text.
- 320px viewport: no horizontal overflow; all names render in full.
- `prefers-reduced-motion`: measured `strokeDashoffset: 0px` — the line is fully
  drawn as a static equivalent rather than simply hidden.
- Focus states: 2px `#7FDCC0` outline on interactive elements.
- Satori note: the share card needs `gradientUnits="userSpaceOnUse"`. With the
  default `objectBoundingBox`, satori silently drops the stroked path (browsers
  render it fine, which is why in-app lines were unaffected).

### Design harness
`/design-preview` renders the real leaderboard components with fixed data for
screenshotting, and `/api/share-card/demo` renders a sample card. Both are gated
behind `ALLOW_DESIGN_PREVIEW=1`, which is only ever set locally — neither exists
on the deployed site.

---

## One identity, three modes (Climb / Commit / Elevate)

The three tracks are now named for what they emotionally do, and share one token
system. What differs between them is **usage discipline and pacing**, never the
palette or type.

| | Signature | Gold | Motion | Surface |
| --- | --- | --- | --- | --- |
| Climb | ascent line | rank 1 + your leading tip | fast, orchestrated | slope |
| Commit | the pool | **confirmed money only** | slow, deliberate | slope |
| Elevate | the unlock | never | gentle, ceremonial | ridge (lighter) |

### Design decisions
- **The pool** is derived from the same altitude logic as the ascent line rather
  than being a generic progress bar: staked money POOLS IN THE VALLEY and CLIMBS
  to whoever hit their target. It fills in ice (staked, at rest, not yours yet);
  only a confirmed payout is ever drawn in gold. The vessel always sits beside
  the exact rand figures — it illustrates, it never replaces the number.
- **Gold was pulled out of Commit's chrome entirely**, including the hub card and
  the section header, which previously used it decoratively. Inside Commit the
  only gold is the payout figure itself. This is what keeps gold meaning "real
  money, confirmed" rather than degrading into "this is the money section".
- **The unlock** reveals report sections one at a time, but never withholds:
  "Show everything" is available from the first section, and under
  prefers-reduced-motion every section renders expanded immediately.
- **The payout receipt shows the whole calculation**, fee included, in the order
  it happens. Burying the fee is what makes a mechanic like this feel rigged.
- **`/you` replaces three scattered settings screens** with one hub. Its reason
  to exist is the ledger: every money event across all three modes reconciled
  into one signed column, so "where has my money gone" is answerable at a glance.
- Sections were renamed on disk (`/challenges` → `/commit`, `/glow-up` →
  `/elevate`, `/profile` → `/you`) with redirects kept so existing links survive.

### Self-critique after screenshotting all three side by side
`supabase/../shots/three-modes.png`, via the dev-only `/design-preview/compare`.
- Shared DNA confirmed: identical palette, type, radii, spacing language and nav.
- Registers read correctly: Climb is loudest (gold rank-1, sparklines, ranks);
  Commit is a receipt with one gold figure; Elevate has no numbers, no gold, no
  ranks and sits on the lighter surface.
- **Fixed on review:** the first pool draft read as a flat trapezoid — the empty
  portion wasn't visible, so "11 of 20 staked" didn't land, and the payout state
  became a solid gold block (far too much gold for this section). Redrawn with
  visible walls, a dark unfilled portion and a single bright surface line.
- **Known weakness:** the pool is still the least distinctive of the three
  signatures. The ascent line and the unlock carry more character. Worth another
  pass — possibly showing each staker as a discrete unit rather than a level.
