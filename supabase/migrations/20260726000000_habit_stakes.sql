-- ═════════════════════════════════════════════════════════════════════════════
-- FEATURE TRACK A — Bet-on-yourself habit stakes
--
-- Additive only: touches no existing table or policy. Reuses `profiles` for
-- identity and follows the established pattern already used by
-- entries/leaderboard_rankings — raw rows are owner-only, and other members see
-- a SAFE DERIVED VIEW that structurally cannot carry the private columns.
--
-- The private columns here are financial: stakes.amount, stakes.payment_reference
-- and stakes.payment_confirmed must never be reachable by anyone but the owner.
-- Cohort members see progress and rank ONLY, via cohort_progress().
--
-- Outcome is determined solely by the participant's own verified effort. There
-- is deliberately no randomness, bonus multiplier or lottery element anywhere in
-- this schema or its functions.
-- ═════════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ─────────────────────────────────────────────────────────────────────────────
-- stake_cohorts — a challenge window people can join
-- ─────────────────────────────────────────────────────────────────────────────
create table public.stake_cohorts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Steps challenge',
  habit_type   text not null default 'steps' check (habit_type in ('steps')),
  -- cumulative steps over the whole window that a participant must reach.
  -- (Documented choice: a single cumulative target, not a per-day target — see
  -- DECISIONS.md. "Hit the target" == SUM(verified_value) >= target_value.)
  target_value numeric not null check (target_value > 0),
  start_date   date not null,
  end_date     date not null,
  stake_amount numeric not null check (stake_amount between 50 and 500),
  fee_rate     numeric not null default 0.10 check (fee_rate >= 0 and fee_rate < 1),
  status       text not null default 'open'
                 check (status in ('open','active','completed','cancelled')),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  check (end_date > start_date)
);
alter table public.stake_cohorts enable row level security;

-- Discovery list: any signed-in user may browse challenges to join. This table
-- holds no personal or financial data — only the challenge's public terms.
create policy "cohorts_select_authenticated" on public.stake_cohorts
  for select using (auth.uid() is not null);
create policy "cohorts_insert_own" on public.stake_cohorts
  for insert with check (created_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- stakes — PRIVATE FINANCIAL DATA. Owner-only, no exceptions.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.stakes (
  id                uuid primary key default gen_random_uuid(),
  cohort_id         uuid not null references public.stake_cohorts(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  amount            numeric not null check (amount between 50 and 500),
  payment_reference text,
  payment_confirmed boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (cohort_id, user_id)
);
alter table public.stakes enable row level security;

-- The only policy on this table. Other cohort members read progress through
-- cohort_progress(), which never selects amount/payment_reference.
create policy "stakes_owner_only" on public.stakes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- daily_verification_logs — the evidence trail behind progress
-- ─────────────────────────────────────────────────────────────────────────────
create table public.daily_verification_logs (
  id             uuid primary key default gen_random_uuid(),
  stake_id       uuid not null references public.stakes(id) on delete cascade,
  log_date       date not null,
  verified_value numeric,
  source         text not null default 'manual'
                   check (source in ('manual','google_fit','apple_health','fitbit')),
  created_at     timestamptz not null default now(),
  unique (stake_id, log_date)
);
alter table public.daily_verification_logs enable row level security;

create policy "verification_logs_owner_only" on public.daily_verification_logs
  for all using (
    exists (
      select 1 from public.stakes s
      where s.id = daily_verification_logs.stake_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stakes s
      where s.id = daily_verification_logs.stake_id and s.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- payouts — PRIVATE FINANCIAL DATA. Written only by the trusted server-side
-- settlement job (service role); clients may read their own row and nothing else.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.payouts (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.stake_cohorts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     numeric not null,
  -- 'refund' is the zero-winner outcome: stakes are returned, no fee charged.
  kind       text not null default 'winnings' check (kind in ('winnings','refund')),
  status     text not null default 'pending' check (status in ('pending','paid','failed')),
  paid_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (cohort_id, user_id)
);
alter table public.payouts enable row level security;

-- Read-only for the owner. No client write policy at all: money movement is
-- manual (EFT) and status is updated by the operator via the service role.
create policy "payouts_owner_select" on public.payouts
  for select using (user_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- SAFE DERIVED VIEW — the in-cohort mini leaderboard
--
-- SECURITY DEFINER so it can read across participants' rows, but it selects ONLY
-- user_id, display_name, progress and rank. amount / payment_reference /
-- payment_confirmed are not in the projection, so no caller can obtain them
-- through this path even in principle. Access is gated on the caller being a
-- participant in the cohort.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.is_cohort_member(_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stakes
    where cohort_id = _cohort_id and user_id = auth.uid()
  );
$$;

create or replace function public.cohort_progress(_cohort_id uuid)
returns table (
  user_id          uuid,
  display_name     text,
  current_progress numeric,
  target_value     numeric,
  hit_target       boolean,
  rank             bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select c.target_value from public.stake_cohorts c where c.id = _cohort_id
  ),
  progress as (
    select
      s.user_id,
      coalesce(sum(l.verified_value), 0) as total
    from public.stakes s
    left join public.daily_verification_logs l on l.stake_id = s.id
    where s.cohort_id = _cohort_id
    group by s.user_id
  )
  select
    pr.user_id,
    p.display_name,
    pr.total as current_progress,
    t.target_value,
    pr.total >= t.target_value as hit_target,
    rank() over (order by pr.total desc) as rank
  from progress pr
  join public.profiles p on p.id = pr.user_id
  cross join target t
  -- gate: only participants of this cohort can see its board
  where public.is_cohort_member(_cohort_id);
$$;

grant execute on function public.is_cohort_member(uuid) to authenticated;
grant execute on function public.cohort_progress(uuid)  to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═════════════════════════════════════════════════════════════════════════════
create index idx_stakes_cohort           on public.stakes(cohort_id);
create index idx_stakes_user             on public.stakes(user_id);
create index idx_verification_stake_date on public.daily_verification_logs(stake_id, log_date);
create index idx_payouts_cohort          on public.payouts(cohort_id);
create index idx_payouts_user            on public.payouts(user_id);
create index idx_cohorts_status_dates    on public.stake_cohorts(status, end_date);
