-- ═════════════════════════════════════════════════════════════════════════════
-- COMMIT PLATFORM — wallet ledger, payout lifecycle, verification integrity,
-- and the security/trust surface.
--
-- ── ON "WALLET" ──────────────────────────────────────────────────────────────
-- This is a LEDGER, not a custodial wallet. There is deliberately no
-- "available balance" and no withdraw primitive, because Ascend does not hold
-- customer funds and is not licensed to. Holding a spendable balance for a user
-- is deposit-taking; in South Africa that engages the Banks Act, and paying it
-- out engages the FIC Act's CDD obligations. Until that review is done, money
-- moves by manual EFT and this schema RECORDS money rather than MOVING it.
--
-- Concretely: every row here is an accounting fact about money that moved (or
-- is due to move) in the real world. Nothing in this migration can initiate a
-- payment. The positions a user sees are:
--
--   locked      confirmed stakes on challenges still running — their money, at
--               risk, held by nobody: it is a claim, not a deposit
--   pending_in  settled winnings not yet paid out by EFT
--   paid_out    winnings that actually landed
--   lifetime_*  the historical totals behind ROI
--
-- ── ON PRIVACY ───────────────────────────────────────────────────────────────
-- Every table here is owner-only. There is no cross-user projection of any
-- financial column anywhere in this file, and no aggregate that could be
-- differenced back to an individual's amount. This is the same guarantee
-- stakes_owner_only carries, extended to the ledger.
-- ═════════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ─────────────────────────────────────────────────────────────────────────────
-- wallet_transactions — the append-only ledger
--
-- Append-only is enforced, not just intended: there is no UPDATE or DELETE
-- policy for clients, and there is no INSERT policy either. Only the settlement
-- job (service role) writes here. A user's ledger must not be writable by the
-- user, or the numbers it produces mean nothing.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.wallet_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in (
                 'stake_locked',      -- you committed a stake (money out)
                 'stake_refunded',    -- no-winner cohort refund (money back)
                 'winnings_credited', -- you won a share of the pool
                 'fee_charged',       -- the platform fee on a settled cohort
                 'adjustment'         -- an operator correction, always explained
               )),
  -- Signed from the USER'S point of view: negative is money they parted with.
  amount       numeric(12,2) not null,
  currency     char(3) not null default 'ZAR' check (currency = 'ZAR'),
  status       text not null default 'pending'
                 check (status in ('pending','cleared','failed','reversed')),
  cohort_id    uuid references public.stake_cohorts(id) on delete set null,
  stake_id     uuid references public.stakes(id) on delete set null,
  payout_id    uuid references public.payouts(id) on delete set null,
  -- Human-readable reason. Shown verbatim in the ledger, so it must read as an
  -- explanation to the person whose money it is, not as an internal code.
  memo         text not null,
  -- Ties the row to the real-world bank movement an operator performed.
  bank_reference text,
  created_at   timestamptz not null default now(),
  effective_at timestamptz not null default now()
);
alter table public.wallet_transactions enable row level security;

create policy "wallet_tx_owner_select" on public.wallet_transactions
  for select using (user_id = auth.uid());
-- No insert/update/delete policy at all: the ledger is written by the trusted
-- settlement job only. A client that could append to its own ledger could
-- manufacture a balance.

create index idx_wallet_tx_user_time on public.wallet_transactions(user_id, effective_at desc);
create index idx_wallet_tx_cohort    on public.wallet_transactions(cohort_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- payout_events — the audit trail behind every state change
--
-- The payout state machine lives in src/lib/payoutLifecycle.ts; this is its
-- write-ahead log. Every transition is recorded with who caused it and why, so
-- "where is my money" has a truthful answer at any moment, and so a disputed
-- payout can be reconstructed rather than argued about.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.payout_events (
  id         uuid primary key default gen_random_uuid(),
  payout_id  uuid not null references public.payouts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  from_state text,
  to_state   text not null,
  reason     text not null,
  -- 'system' for automated transitions, 'operator' for a human, 'user' for a
  -- user-initiated action such as supplying bank details.
  actor      text not null default 'system' check (actor in ('system','operator','user')),
  created_at timestamptz not null default now()
);
alter table public.payout_events enable row level security;

create policy "payout_events_owner_select" on public.payout_events
  for select using (user_id = auth.uid());

create index idx_payout_events_payout on public.payout_events(payout_id, created_at);

-- Widen payouts to carry the full lifecycle rather than three states.
alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check check (status in (
  'pending_verification', -- cohort settled, effort still being checked
  'verified',             -- effort confirmed, amount final
  'manual_review',        -- an operator must look before it moves
  'fraud_review',         -- an integrity flag is blocking it
  'queued',               -- cleared to pay, waiting for the next run
  'scheduled',            -- in a specific payment run
  'processing',           -- the EFT has been submitted
  'paid',                 -- money confirmed received
  'failed',               -- the transfer did not complete
  'returned',             -- the bank sent it back
  'cancelled',            -- withdrawn before payment
  -- retained so existing rows and older code keep working
  'pending'
));
alter table public.payouts add column if not exists expected_by date;
alter table public.payouts add column if not exists failure_reason text;

-- ─────────────────────────────────────────────────────────────────────────────
-- payout_destinations — where a payout is actually sent
--
-- SENSITIVE PERSONAL INFORMATION under POPIA. Owner-only, and the account
-- number is never rendered in full anywhere in the UI — the app reads
-- account_last4 and nothing else. The full number exists because a human
-- operator must type it into a banking portal to pay someone.
--
-- BEFORE SCALE: this belongs in Supabase Vault or a tokenising PSP, not in a
-- plain column. It is documented in docs/COMMIT_PLATFORM.md as a known debt
-- rather than left to be discovered.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.payout_destinations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  account_holder text not null,
  bank_name      text not null,
  account_number text not null,
  account_last4  text generated always as (right(account_number, 4)) stored,
  branch_code    text,
  -- An operator confirms the account belongs to the user before the first payout.
  verified       boolean not null default false,
  is_default     boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (user_id, account_number)
);
alter table public.payout_destinations enable row level security;

create policy "payout_dest_owner_all" on public.payout_destinations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification integrity — provenance on every logged day
--
-- The scoring engine is pure TypeScript (src/lib/integrity.ts) so it can be
-- tested exhaustively; these columns are where its verdict is persisted.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.daily_verification_logs
  add column if not exists recorded_at timestamptz not null default now(),
  add column if not exists device_id   text,
  -- 0–100. Below the acceptance threshold a day does not count toward a target.
  add column if not exists confidence  smallint
    check (confidence is null or (confidence between 0 and 100));

create table public.verification_flags (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid not null references public.daily_verification_logs(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  code       text not null check (code in (
               'impossible_pace',      -- more steps than a human can take in a day
               'duplicate_value',      -- the identical figure repeated across days
               'late_backfill',        -- a day filled in long after it ended
               'device_switch',        -- the source device changed mid-window
               'source_downgrade',     -- moved from a wearable to manual entry
               'outlier_spike',        -- far outside this user's own distribution
               'clock_skew'            -- the client's clock disagreed with ours
             )),
  severity   smallint not null check (severity between 1 and 3),
  detail     text not null,
  created_at timestamptz not null default now()
);
alter table public.verification_flags enable row level security;

-- A user can see what was flagged on their own activity. Being told why a day
-- was rejected is the difference between a review process and a black box.
create policy "verification_flags_owner_select" on public.verification_flags
  for select using (user_id = auth.uid());

create index idx_verification_flags_user on public.verification_flags(user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Security surface — login history and known devices
-- ─────────────────────────────────────────────────────────────────────────────
create table public.security_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in (
               'sign_in','sign_out','password_change','email_change',
               'new_device','payout_destination_added','payout_destination_changed',
               'suspicious_sign_in'
             )),
  -- Coarse only. A city is enough for "was this you?"; storing a precise
  -- location would be collecting more than the question needs.
  city       text,
  country    text,
  user_agent text,
  device_id  text,
  created_at timestamptz not null default now()
);
alter table public.security_events enable row level security;

create policy "security_events_owner_select" on public.security_events
  for select using (user_id = auth.uid());

create index idx_security_events_user on public.security_events(user_id, created_at desc);

create table public.trusted_devices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  device_id  text not null,
  label      text not null,
  last_seen  timestamptz not null default now(),
  trusted    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);
alter table public.trusted_devices enable row level security;

-- A user may see and revoke their own devices. Revoking is a delete.
create policy "trusted_devices_owner_all" on public.trusted_devices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Marketplace visibility
--
-- Until now every challenge was visible to every signed-in user. A private
-- challenge between four friends should not appear in a public list.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.stake_cohorts
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public','link','private'));

drop policy if exists "cohorts_select_authenticated" on public.stake_cohorts;

-- Public challenges are browsable; link and private ones are reachable only by
-- their creator or by someone already staked in them (who has the id anyway).
create policy "cohorts_select_visible" on public.stake_cohorts
  for select using (
    auth.uid() is not null
    and (
      visibility = 'public'
      or created_by = auth.uid()
      or public.is_cohort_member(id)
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- wallet_positions() — the caller's own money, and only ever their own.
--
-- SECURITY DEFINER because it reads across stakes/payouts/wallet_transactions,
-- but every branch is filtered to auth.uid(). It takes no arguments, so there
-- is no user id a caller could substitute.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.wallet_positions()
returns table (
  locked          numeric,
  awaiting_eft    numeric,
  pending_in      numeric,
  paid_out        numeric,
  lifetime_staked numeric,
  lifetime_won    numeric,
  lifetime_lost   numeric,
  net             numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as uid),
  -- Money committed to challenges that have not finished.
  live as (
    select coalesce(sum(s.amount) filter (where s.payment_confirmed), 0)  as locked,
           coalesce(sum(s.amount) filter (where not s.payment_confirmed), 0) as awaiting
    from public.stakes s
    join public.stake_cohorts c on c.id = s.cohort_id
    cross join me
    where s.user_id = me.uid and c.status in ('open','active')
  ),
  settled as (
    select coalesce(sum(p.amount) filter (where p.status = 'paid'), 0) as paid,
           coalesce(sum(p.amount) filter (
             where p.status in ('pending_verification','verified','queued',
                                'scheduled','processing','manual_review','pending')
           ), 0) as pending
    from public.payouts p cross join me
    where p.user_id = me.uid
  ),
  history as (
    select coalesce(sum(s.amount), 0) as staked
    from public.stakes s cross join me
    where s.user_id = me.uid
  )
  select
    live.locked,
    live.awaiting,
    settled.pending,
    settled.paid,
    history.staked,
    settled.paid,
    -- What was staked on finished challenges and did not come back.
    greatest(history.staked - live.locked - live.awaiting - settled.paid - settled.pending, 0),
    settled.paid - (history.staked - live.locked - live.awaiting)
  from live, settled, history;
$$;

revoke execute on function public.wallet_positions() from public, anon;
grant  execute on function public.wallet_positions() to authenticated;
