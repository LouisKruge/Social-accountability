-- ═══════════════════════════════════════════════════════════════════════════
-- LAYER 1 — INTELLIGENCE
--
-- Storage for the Discipline Score over time, which is what turns a number into
-- an index: trend, volatility and "up 7.3% this month" all need yesterday's
-- value to exist. Computing the score is pure (src/lib/intelligence.ts); this
-- table is only the record of what it said, and when.
--
-- RLS is enabled in this same file, as everywhere else in this schema.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.discipline_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  -- One row per user per day. Recomputing the same day overwrites rather than
  -- appending, so an index cannot be inflated by opening the app repeatedly.
  taken_on     date not null default current_date,
  score        int  not null check (score between 300 and 1000),
  momentum     int  not null check (momentum between 0 and 100),
  -- Fraction of signal weight that actually had data behind it, 0..1. Stored
  -- because a score of 820 at 40% coverage and one at 92% coverage are not the
  -- same claim, and a trend line across a change in coverage would otherwise
  -- silently compare two different measurements.
  coverage     numeric(4,3) not null check (coverage >= 0 and coverage <= 1),
  created_at   timestamptz not null default now(),
  unique (user_id, taken_on)
);

create index discipline_snapshots_user_date_idx
  on public.discipline_snapshots (user_id, taken_on desc);

alter table public.discipline_snapshots enable row level security;

-- The owner reads their own history. Nobody reads anybody else's: a discipline
-- score is a statement about how reliable a person is, and this product does
-- not publish that about anyone.
create policy discipline_snapshots_select_own on public.discipline_snapshots
  for select using (user_id = auth.uid());

create policy discipline_snapshots_insert_own on public.discipline_snapshots
  for insert with check (user_id = auth.uid());

create policy discipline_snapshots_update_own on public.discipline_snapshots
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy discipline_snapshots_delete_own on public.discipline_snapshots
  for delete using (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────
-- PERCENTILE
--
-- "Top 4%" is the single most requested number in a scoring product and the
-- easiest one to turn into a leak. Three defences, all structural:
--
--   1. It returns ONE integer. There is no shape of call that yields another
--      user's score, id, or rank.
--   2. It refuses below MIN_COHORT participants. With three users, "top 33%"
--      is arithmetic on a sample that identifies people — and with one user it
--      is simply false, since everybody is top 100% of themselves.
--   3. It compares only the most recent snapshot per user, so somebody cannot
--      inflate their standing by having logged for longer.
--
-- SECURITY DEFINER because it must read across users; it takes no arguments,
-- so there is no user id to substitute.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.discipline_percentile()
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  min_cohort constant int := 20;
  me         int;
  cohort     int;
  below      int;
begin
  select s.score into me
  from public.discipline_snapshots s
  where s.user_id = auth.uid()
  order by s.taken_on desc
  limit 1;

  if me is null then
    return null;
  end if;

  with latest as (
    select distinct on (s.user_id) s.user_id, s.score
    from public.discipline_snapshots s
    order by s.user_id, s.taken_on desc
  )
  select count(*), count(*) filter (where l.score < me)
  into cohort, below
  from latest l;

  if cohort < min_cohort then
    return null;
  end if;

  -- Percentile from the top: 1 means best in the cohort.
  return greatest(1, 100 - floor((below::numeric / cohort) * 100)::int);
end;
$$;

revoke all on function public.discipline_percentile() from public;
grant execute on function public.discipline_percentile() to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Account deletion already cascades from profiles(id), so a POPIA deletion
-- removes these rows with everything else. Asserted in audit.test.sql.
-- ───────────────────────────────────────────────────────────────────────────
