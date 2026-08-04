-- ═══════════════════════════════════════════════════════════════════════════
-- LAYER 5 — SEASONS, PRESTIGE, ELITE CHALLENGES
--
-- Two things only, because almost everything in this layer is DERIVED:
--
--   1. Entry requirements on a challenge, so an invite-only pool can exist.
--   2. Trophies awarded, so a record survives a change to the award rules.
--
-- The season itself is not a table. A season is a 90-day window from a fixed
-- epoch — arithmetic every client agrees on forever, with nothing to keep in
-- sync and no row that can disagree with the calendar. Prestige is derived
-- from discipline_snapshots the same way. See src/lib/season.ts.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Elite entry requirements ────────────────────────────────────────────────
-- Null means open to anybody, which is what every existing cohort stays.
alter table public.stake_cohorts
  add column if not exists min_discipline_score int
    check (min_discipline_score is null or min_discipline_score between 300 and 1000),
  add column if not exists min_integrity_score int
    check (min_integrity_score is null or min_integrity_score between 0 and 100);

comment on column public.stake_cohorts.min_discipline_score is
  'Minimum Discipline Score to join. NULL = open to anybody. Enforced in the join path, and the UI shows every check with its numbers so a refusal is never opaque.';

-- ── Trophies ────────────────────────────────────────────────────────────────
-- Awarded trophies are recorded rather than recomputed, so tightening a rule
-- later never takes something off somebody's shelf. A record you can lose
-- because the product changed its mind is not a record.
create table public.trophies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  trophy_key  text not null check (length(trophy_key) between 1 and 40),
  -- The figure that earned it, frozen at the moment of award.
  evidence    text not null check (length(evidence) <= 200),
  awarded_at  timestamptz not null default now(),
  -- Which season it happened in, for the season history.
  season      int not null check (season >= 1),
  unique (user_id, trophy_key)
);

create index trophies_user_idx on public.trophies (user_id, awarded_at desc);

alter table public.trophies enable row level security;

-- A trophy is a statement about a person's record. Owner-only, like the
-- discipline score it is often derived from.
create policy trophies_select_own on public.trophies
  for select using (user_id = auth.uid());
create policy trophies_insert_own on public.trophies
  for insert with check (user_id = auth.uid());
create policy trophies_delete_own on public.trophies
  for delete using (user_id = auth.uid());

-- Deliberately NO update policy. A trophy's evidence is the figure at the
-- moment it was earned; editing it afterwards would make the shelf a claim
-- rather than a record.

-- Account deletion cascades from profiles(id), covered by audit.test.sql.
