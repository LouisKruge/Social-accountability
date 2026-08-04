-- ═══════════════════════════════════════════════════════════════════════════
-- WEARABLES — connections, credentials and sync history.
--
-- ── WHY THIS IS TWO TABLES AND NOT ONE ──────────────────────────────────────
-- The obvious design is one `wearable_connections` row holding the provider,
-- the sync status AND the OAuth tokens, owner-only under RLS. That design is
-- wrong, and the reason is worth stating rather than discovering:
--
-- "Owner-only" means the row is readable with the OWNER'S ANON KEY, from the
-- browser. A single XSS anywhere in the app then exfiltrates a live Fitbit
-- access token and a refresh token that survives the session. The blast radius
-- of a UI bug becomes a third-party account.
--
-- So credentials live in their own table with a DENY-ALL policy. No client, not
-- even the owner's, can read or write it — only the trusted server-side sync
-- job, which runs with the service role and bypasses RLS. The user-facing table
-- carries what a person actually needs to see: which providers are connected,
-- when they last synced, and what went wrong if anything did.
--
-- ── KNOWN DEBT ──────────────────────────────────────────────────────────────
-- The tokens are stored in plain columns. Before scale they belong in Supabase
-- Vault or pgsodium, exactly like payout_destinations.account_number. Recorded
-- here and in docs/WEARABLES.md rather than left to be found.
--
-- ── ON APPLE HEALTH ─────────────────────────────────────────────────────────
-- HealthKit has no server API, so `apple_health` never has tokens. Its rows
-- exist so a device push can be attributed and rate-limited like any other
-- source. See the header of src/lib/wearables.ts.
-- ═══════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ─────────────────────────────────────────────────────────────────────────────
-- wearable_connections — what the person can see about their own integrations
-- ─────────────────────────────────────────────────────────────────────────────
create table public.wearable_connections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  provider       text not null check (provider in ('google_fit','apple_health','fitbit')),
  status         text not null default 'active'
                   check (status in ('active','needs_reauth','revoked','error')),
  -- What the user agreed to share, stored verbatim so the consent screen and
  -- the settings screen can never drift from what was actually granted.
  scope          text,
  connected_at   timestamptz not null default now(),
  last_synced_on date,
  last_synced_at timestamptz,
  -- Written to be shown to the person, not to an operator.
  last_error     text,
  unique (user_id, provider)
);
alter table public.wearable_connections enable row level security;

create policy wearable_connections_select_own on public.wearable_connections
  for select using (user_id = auth.uid());
-- Disconnecting is a delete, and it is the one write a client needs. Creating a
-- connection happens in the OAuth callback, which is trusted server-side code.
create policy wearable_connections_delete_own on public.wearable_connections
  for delete using (user_id = auth.uid());

create index wearable_connections_user_idx on public.wearable_connections (user_id);
create index wearable_connections_sync_idx on public.wearable_connections (status, last_synced_on)
  where status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- wearable_credentials — tokens. NO CLIENT MAY TOUCH THIS TABLE.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.wearable_credentials (
  connection_id uuid primary key
                  references public.wearable_connections(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  -- The provider's own id for this user, needed by some endpoints.
  provider_user_id text,
  updated_at    timestamptz not null default now()
);
alter table public.wearable_credentials enable row level security;

-- Deliberately DENY-ALL rather than no policy at all.
--
-- A table with zero policies is already closed to clients, but it reads as an
-- omission — the kind of thing a later migration "fixes" by adding an
-- owner-select policy that looks consistent with every other table here. This
-- says the quiet part in SQL: nobody gets in, and it was not forgotten.
--
-- The service role bypasses RLS entirely, which is how the sync job reads it.
create policy wearable_credentials_no_client_access on public.wearable_credentials
  for all using (false) with check (false);

comment on table public.wearable_credentials is
  'OAuth tokens. Deny-all to every client including the owner: an owner-readable token turns any XSS into a third-party account compromise. Read only by the service-role sync job. Belongs in Vault before scale.';

-- ─────────────────────────────────────────────────────────────────────────────
-- wearable_sync_runs — what happened, so a bad sync is explainable
-- ─────────────────────────────────────────────────────────────────────────────
create table public.wearable_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid references public.wearable_connections(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  provider      text not null check (provider in ('google_fit','apple_health','fitbit')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean not null default false,
  days_fetched  int not null default 0,
  days_written  int not null default 0,
  days_skipped  int not null default 0,
  days_rejected int not null default 0,
  -- Shown to the person. "Fitbit says the connection was revoked" is an
  -- answer; "sync failed" is not.
  message       text
);
alter table public.wearable_sync_runs enable row level security;

create policy wearable_sync_runs_select_own on public.wearable_sync_runs
  for select using (user_id = auth.uid());

create index wearable_sync_runs_user_idx
  on public.wearable_sync_runs (user_id, started_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Provenance on the log itself
--
-- daily_verification_logs already carries `source` and `device_id`. This adds
-- the connection that produced a row, so a day can be traced to the specific
-- integration that wrote it — and so revoking a connection can show exactly
-- which days came from it.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.daily_verification_logs
  add column if not exists connection_id uuid
    references public.wearable_connections(id) on delete set null;

create index if not exists dvl_connection_idx
  on public.daily_verification_logs (connection_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- my_wearables() — connection state for the caller, without the tokens.
--
-- A plain select on wearable_connections would do the same job; this exists so
-- there is one obvious call the UI makes, and so the token table can never be
-- joined into the shape the UI reads by a future well-meaning change.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.my_wearables()
returns table (
  id             uuid,
  provider       text,
  status         text,
  scope          text,
  connected_at   timestamptz,
  last_synced_on date,
  last_error     text,
  days_from_this_source bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.provider, c.status, c.scope, c.connected_at, c.last_synced_on, c.last_error,
         (select count(*) from public.daily_verification_logs l where l.connection_id = c.id)
  from public.wearable_connections c
  where c.user_id = auth.uid()
  order by c.connected_at;
$$;

revoke execute on function public.my_wearables() from public, anon;
grant  execute on function public.my_wearables() to authenticated;
