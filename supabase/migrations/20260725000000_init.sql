-- ═════════════════════════════════════════════════════════════════════════════
-- Ascend — initial schema
--
-- Every table that holds user/tenant data has Row Level Security ENABLED in the
-- SAME statement block that creates it (per the project's non-negotiable rule),
-- and every policy is scoped by auth.uid() and group membership. No policy in
-- this file uses `USING (true)` on a data table.
--
-- NOTE ON RECURSION: the naive policies from the spec (e.g. a group_members
-- SELECT policy that sub-selects group_members) cause Postgres RLS infinite
-- recursion. We route all membership checks through SECURITY DEFINER helper
-- functions, which run with the definer's rights and therefore do NOT re-trigger
-- RLS on the table being checked. See DECISIONS.md for the full rationale.
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- gen_random_uuid(), md5()

-- Allow the SECURITY DEFINER helper functions below to be created before the
-- tables they reference (forward references). Postgres validates `language sql`
-- function bodies at CREATE time unless this is off.
set check_function_bodies = off;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER helpers (defined before policies that use them)
-- ─────────────────────────────────────────────────────────────────────────────

-- Is the current user a member of the given group?
create or replace function public.is_group_member(_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = _group_id
      and user_id = auth.uid()
  );
$$;

-- Does the current user share at least one group with another user?
create or replace function public.shares_group_with(_other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = auth.uid()
      and them.user_id = _other_user
  );
$$;

-- Is the current user a member of the group that owns the given category?
create or replace function public.is_member_of_category_group(_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.categories c
    join public.group_members gm on gm.group_id = c.group_id
    where c.id = _category_id
      and gm.user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — extends auth.users
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  phone_number text,
  -- notification preferences (Phase 2 WhatsApp fan-out); opt-in by default off
  notify_whatsapp boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- readable by self and by co-members of any shared group; writable by self only
create policy "profiles_select_self_or_group_member" on public.profiles
  for select using (
    id = auth.uid()
    or public.shares_group_with(profiles.id)
  );
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- groups
-- ─────────────────────────────────────────────────────────────────────────────
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- deleting the owner's account deletes their groups (POPIA erasure); the
  -- group's members/categories/entries then cascade from here.
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at  timestamptz not null default now()
);
alter table public.groups enable row level security;

-- readable only by members; creatable only with yourself as owner
create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(groups.id));
create policy "groups_insert_owner" on public.groups
  for insert with check (owner_id = auth.uid());
-- owner may rename / rotate invite code
create policy "groups_update_owner" on public.groups
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "groups_delete_owner" on public.groups
  for delete using (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- group_members
-- ─────────────────────────────────────────────────────────────────────────────
create table public.group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
alter table public.group_members enable row level security;

-- readable by fellow members (via SECURITY DEFINER helper — no recursion)
create policy "group_members_select_member" on public.group_members
  for select using (public.is_group_member(group_members.group_id));
-- a user may insert only their own membership row (join). The invite-code flow
-- runs through join_group_by_code() (SECURITY DEFINER); this policy is the
-- belt-and-braces guard for any direct insert.
create policy "group_members_insert_self" on public.group_members
  for insert with check (user_id = auth.uid());
-- a user may leave a group (delete their own membership); owner row is protected
-- by a trigger below.
create policy "group_members_delete_self" on public.group_members
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- categories — the metric type being tracked
-- ─────────────────────────────────────────────────────────────────────────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  name        text not null,
  metric_type text not null check (metric_type in ('percentage_change','streak')),
  -- for percentage_change categories, does a HIGHER raw value mean improvement
  -- (savings, steps) or a LOWER one (debt paydown, weight loss)? drives ranking.
  direction   text not null default 'increase' check (direction in ('increase','decrease')),
  unit        text,  -- e.g. 'ZAR', 'steps', 'kg', 'days'
  -- keep the category if its creator deletes their account (others may use it);
  -- just drop the attribution.
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.categories enable row level security;

create policy "categories_select_member" on public.categories
  for select using (public.is_group_member(categories.group_id));
create policy "categories_insert_member" on public.categories
  for insert with check (
    public.is_group_member(categories.group_id)
    and created_by = auth.uid()
  );
create policy "categories_update_creator" on public.categories
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "categories_delete_creator" on public.categories
  for delete using (created_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- category_baselines — each user's starting reference point per category
-- (strictly owner-only; never visible to other group members)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.category_baselines (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  category_id    uuid not null references public.categories(id) on delete cascade,
  baseline_value numeric not null,
  baseline_date  date not null default current_date,
  unique (user_id, category_id)
);
alter table public.category_baselines enable row level security;

create policy "baselines_owner_only" on public.category_baselines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- entries — raw self-reported values per period
-- ─────────────────────────────────────────────────────────────────────────────
create table public.entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  category_id      uuid not null references public.categories(id) on delete cascade,
  period_start     date not null,
  period_end       date not null,
  raw_value        numeric not null,
  share_raw_value  boolean not null default false,  -- opt-in: reveal the number
  created_at       timestamptz not null default now(),
  unique (user_id, category_id, period_start)
);
alter table public.entries enable row level security;

-- owner may always read their own entries (even after leaving the group)
create policy "entries_select_own" on public.entries
  for select using (user_id = auth.uid());
-- group members may SELECT entries only where the owner opted to share the value
create policy "entries_group_shared_only" on public.entries
  for select using (
    share_raw_value = true
    and public.is_member_of_category_group(entries.category_id)
  );
-- owner may only INSERT an entry for a category in a group they belong to
create policy "entries_insert_own" on public.entries
  for insert with check (
    user_id = auth.uid()
    and public.is_member_of_category_group(entries.category_id)
  );
create policy "entries_update_own" on public.entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "entries_delete_own" on public.entries
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- leaderboard_rankings — COMPUTED, derived data (the safe view members see).
-- Populated ONLY by the trusted server-side job using the service role key.
-- Clients can SELECT (if group member) but never INSERT/UPDATE/DELETE.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.leaderboard_rankings (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  pct_change   numeric not null,
  -- true when baseline_value was 0 and we fell back to ABSOLUTE change instead
  -- of a percentage (avoids divide-by-zero); the UI flags these distinctly.
  is_absolute  boolean not null default false,
  rank         int not null,
  computed_at  timestamptz not null default now(),
  unique (group_id, category_id, period_start, user_id)
);
alter table public.leaderboard_rankings enable row level security;

create policy "rankings_select_group_member" on public.leaderboard_rankings
  for select using (public.is_group_member(leaderboard_rankings.group_id));
-- No insert/update/delete policy: writes happen only via the service role,
-- which bypasses RLS. Client-side mutation is therefore impossible.

-- ─────────────────────────────────────────────────────────────────────────────
-- share_cards
-- ─────────────────────────────────────────────────────────────────────────────
create table public.share_cards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  ranking_id uuid references public.leaderboard_rankings(id) on delete set null,
  image_url  text,
  is_public  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.share_cards enable row level security;

-- public cards readable by anyone (incl. the anon role, for the /share link);
-- private cards readable by owner only
create policy "share_cards_select" on public.share_cards
  for select using (is_public = true or user_id = auth.uid());
create policy "share_cards_owner_write" on public.share_cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- subscriptions — strictly owner-only. Tier changes are written by the Paystack
-- webhook using the service role (bypasses RLS); clients may only read.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  tier                text not null default 'free' check (tier in ('free','premium')),
  status              text not null default 'active',
  paystack_customer_id text,
  paystack_subscription_code text,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now(),
  unique (user_id)
);
alter table public.subscriptions enable row level security;

create policy "subscriptions_owner_select" on public.subscriptions
  for select using (user_id = auth.uid());
-- No client write policy: only the service-role webhook mutates tier/status.

-- ═════════════════════════════════════════════════════════════════════════════
-- TRIGGERS & RPCs
-- ═════════════════════════════════════════════════════════════════════════════

-- On new auth user → create a profile row + a free subscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, phone_number)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    new.phone
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, tier, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- On new group → add the owner as an 'owner' member automatically.
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- Protect the owner's membership row from being deleted while they own the group.
create or replace function public.protect_owner_membership()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'owner' and exists (
    select 1 from public.groups g where g.id = old.group_id and g.owner_id = old.user_id
  ) then
    raise exception 'The group owner cannot leave the group. Transfer ownership or delete the group first.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_owner_membership_trg on public.group_members;
create trigger protect_owner_membership_trg
  before delete on public.group_members
  for each row execute function public.protect_owner_membership();

-- Join a group by invite code. SECURITY DEFINER so a non-member can resolve the
-- code without being able to read/enumerate other groups. Returns the group id.
create or replace function public.join_group_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a group.';
  end if;

  select id into _group_id
  from public.groups
  where invite_code = lower(trim(_code));

  if _group_id is null then
    raise exception 'invalid_invite_code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return _group_id;
end;
$$;

-- Preview a group (name + member count) from an invite code WITHOUT joining, so
-- the join screen can show "Join <Group Name>?". Exposes only non-sensitive
-- group metadata, never entries/baselines.
create or replace function public.preview_group_by_code(_code text)
returns table (id uuid, name text, member_count bigint)
language sql
security definer
set search_path = public
as $$
  select g.id, g.name, count(gm.id) as member_count
  from public.groups g
  left join public.group_members gm on gm.group_id = g.id
  where g.invite_code = lower(trim(_code))
  group by g.id, g.name;
$$;

-- POPIA-aligned self-service account deletion (Phase 5). Deletes the auth user;
-- every data table cascades from auth.users / profiles via ON DELETE CASCADE.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Grants: authenticated users may call the RPCs; anon may preview by code.
grant execute on function public.join_group_by_code(text)   to authenticated;
grant execute on function public.preview_group_by_code(text) to authenticated, anon;
grant execute on function public.delete_my_account()         to authenticated;
grant execute on function public.is_group_member(uuid)       to authenticated;
grant execute on function public.shares_group_with(uuid)     to authenticated;
grant execute on function public.is_member_of_category_group(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- INDEXES — on foreign keys and hot query paths (Phase 5 rule, applied up-front)
-- ═════════════════════════════════════════════════════════════════════════════
create index idx_group_members_user       on public.group_members(user_id);
create index idx_group_members_group       on public.group_members(group_id);
create index idx_groups_owner              on public.groups(owner_id);
create index idx_categories_group          on public.categories(group_id);
create index idx_categories_created_by     on public.categories(created_by);
create index idx_baselines_user_category   on public.category_baselines(user_id, category_id);
create index idx_entries_category_period   on public.entries(category_id, period_start);
create index idx_entries_user              on public.entries(user_id);
create index idx_rankings_group_cat_period on public.leaderboard_rankings(group_id, category_id, period_start);
create index idx_rankings_user             on public.leaderboard_rankings(user_id);
create index idx_share_cards_user          on public.share_cards(user_id);
create index idx_share_cards_ranking       on public.share_cards(ranking_id);
create index idx_subscriptions_user        on public.subscriptions(user_id);
