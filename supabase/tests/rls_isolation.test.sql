-- ═══════════════════════════════════════════════════════════════════════════
-- TWO-TENANT RLS ISOLATION TEST
-- User A (Group 1) and User B (Group 2) must not be able to read each other's
-- entries, baselines, groups, members, categories, or rankings.
-- Any violated assertion raises and (under ON_ERROR_STOP) fails the run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Assertion helpers (created as superuser, callable by all) ────────────────
create or replace function public._assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then
    raise notice 'PASS: %', label;
  else
    raise exception 'FAIL: %', label;
  end if;
end $$;
grant execute on function public._assert(boolean, text) to anon, authenticated, service_role;

-- Fixed UUIDs so we can reference them across role switches.
\set uidA '11111111-1111-1111-1111-111111111111'
\set uidB '22222222-2222-2222-2222-222222222222'

-- ── Seed two auth users (fires handle_new_user → profiles + subscriptions) ───
reset role;
insert into auth.users (id, email, raw_user_meta_data)
values (:'uidA', 'alice@example.com', '{"display_name":"Alice"}'::jsonb),
       (:'uidB', 'bob@example.com',   '{"display_name":"Bob"}'::jsonb);

select public._assert((select count(*) from public.profiles) = 2, 'signup trigger created 2 profiles');
select public._assert((select count(*) from public.subscriptions where tier='free') = 2, 'signup trigger created 2 free subscriptions');

-- ═══════════════ ACT AS ALICE — build Group 1 ═══════════════════════════════
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set role authenticated;

insert into public.groups (id, name, owner_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alice Fitness Crew', :'uidA');

-- owner auto-added as member by trigger
select public._assert(
  (select count(*) from public.group_members where group_id='aaaaaaaa-0000-0000-0000-000000000001') = 1,
  'group trigger auto-added Alice as owner-member');

insert into public.categories (id, group_id, name, metric_type, direction, unit, created_by)
values ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Steps','percentage_change','increase','steps', :'uidA');

insert into public.category_baselines (user_id, category_id, baseline_value)
values (:'uidA','cccccccc-0000-0000-0000-000000000001', 5000);

insert into public.entries (user_id, category_id, period_start, period_end, raw_value, share_raw_value)
values (:'uidA','cccccccc-0000-0000-0000-000000000001','2026-07-13','2026-07-19', 6000, false);

select public._assert((select count(*) from public.groups) = 1, 'Alice sees exactly her 1 group');
select public._assert((select count(*) from public.entries) = 1, 'Alice sees her own entry');
select public._assert((select count(*) from public.category_baselines) = 1, 'Alice sees her own baseline');

-- ═══════════════ ACT AS BOB — build Group 2 ═════════════════════════════════
reset role;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set role authenticated;

insert into public.groups (id, name, owner_id)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'Bob Savings Squad', :'uidB');

insert into public.categories (id, group_id, name, metric_type, direction, unit, created_by)
values ('dddddddd-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','Savings','percentage_change','increase','ZAR', :'uidB');

insert into public.category_baselines (user_id, category_id, baseline_value)
values (:'uidB','dddddddd-0000-0000-0000-000000000002', 2000);

insert into public.entries (user_id, category_id, period_start, period_end, raw_value, share_raw_value)
values (:'uidB','dddddddd-0000-0000-0000-000000000002','2026-07-13','2026-07-19', 2500, true);

-- ── CROSS-TENANT ISOLATION ASSERTIONS (Bob must see NONE of Alice's data) ────
select public._assert((select count(*) from public.groups) = 1, 'Bob sees only his own group (not Alice''s)');
select public._assert(
  (select count(*) from public.groups where id='aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'Bob CANNOT read Alice''s group row');
select public._assert(
  (select count(*) from public.entries where user_id='11111111-1111-1111-1111-111111111111') = 0,
  'Bob CANNOT read Alice''s entries');
select public._assert(
  (select count(*) from public.category_baselines where user_id='11111111-1111-1111-1111-111111111111') = 0,
  'Bob CANNOT read Alice''s baselines');
select public._assert(
  (select count(*) from public.categories where group_id='aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'Bob CANNOT read Alice''s categories');
select public._assert(
  (select count(*) from public.group_members where group_id='aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'Bob CANNOT read Alice''s group membership');
select public._assert(
  (select count(*) from public.profiles where id='11111111-1111-1111-1111-111111111111') = 0,
  'Bob CANNOT read Alice''s profile (no shared group)');

-- Bob can only see his own baseline (never even his co-members', but here solo)
select public._assert((select count(*) from public.category_baselines) = 1, 'Bob sees only his own baseline');

-- ── SERVICE ROLE computes rankings for BOTH groups (simulates the cron) ──────
reset role;
set role service_role;
insert into public.leaderboard_rankings (group_id, category_id, period_start, period_end, user_id, pct_change, is_absolute, rank)
values
 ('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','2026-07-13','2026-07-19',:'uidA', 20.0, false, 1),
 ('bbbbbbbb-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000002','2026-07-13','2026-07-19',:'uidB', 25.0, false, 1);

-- ── Bob sees only his group's rankings ───────────────────────────────────────
reset role;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set role authenticated;
select public._assert(
  (select count(*) from public.leaderboard_rankings where group_id='aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'Bob CANNOT read Alice''s leaderboard rankings');
select public._assert(
  (select count(*) from public.leaderboard_rankings) = 1,
  'Bob sees only his own group''s rankings');

-- ── Client cannot write rankings (RLS: no insert policy) ─────────────────────
do $$
begin
  begin
    insert into public.leaderboard_rankings (group_id, category_id, period_start, period_end, user_id, pct_change, rank)
    values ('bbbbbbbb-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000002','2026-07-06','2026-07-12','22222222-2222-2222-2222-222222222222', 999, 1);
    raise exception 'FAIL: authenticated user was able to INSERT a ranking (should be blocked)';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: authenticated user blocked from inserting rankings';
  end;
end $$;

-- ── Bob (non-member) cannot INSERT an entry into Alice's category ────────────
reset role;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set role authenticated;
do $$
begin
  begin
    insert into public.entries (user_id, category_id, period_start, period_end, raw_value)
    values ('22222222-2222-2222-2222-222222222222','cccccccc-0000-0000-0000-000000000001','2026-07-13','2026-07-19', 123);
    raise exception 'FAIL: non-member Bob inserted an entry into Alice''s category';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: non-member Bob blocked from inserting into Alice''s category';
  end;
end $$;

-- ── join_group_by_code: Bob joins Alice's group, then the sharing rule ───────
reset role;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set role authenticated;

-- Grab Alice's invite code via service role (Bob can't read her group yet)
reset role;
set role service_role;
select invite_code as alice_code from public.groups where id='aaaaaaaa-0000-0000-0000-000000000001';
\gset

reset role;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set role authenticated;
select public.join_group_by_code(:'alice_code');

select public._assert(
  (select count(*) from public.groups where id='aaaaaaaa-0000-0000-0000-000000000001') = 1,
  'After joining, Bob CAN read Alice''s group');
-- Alice's entry has share_raw_value=false → still hidden even as co-member
select public._assert(
  (select count(*) from public.entries where user_id='11111111-1111-1111-1111-111111111111') = 0,
  'Co-member Bob still CANNOT see Alice''s private (unshared) entry');
-- Alice's baseline is owner-only → hidden even to co-members
select public._assert(
  (select count(*) from public.category_baselines where user_id='11111111-1111-1111-1111-111111111111') = 0,
  'Co-member Bob still CANNOT see Alice''s baseline (owner-only)');
-- Now Alice opts to share the entry → co-member Bob can see it
reset role;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set role authenticated;
update public.entries set share_raw_value = true where user_id=:'uidA';
reset role;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set role authenticated;
select public._assert(
  (select count(*) from public.entries where user_id='11111111-1111-1111-1111-111111111111' and share_raw_value) = 1,
  'After Alice opts in, co-member Bob CAN see the shared entry value');

-- ── Multi-group isolation (Phase 3): Alice's SECOND group + streak category ──
-- Bob is a member of group 1 only; none of group 2 may bleed to him.
reset role;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set role authenticated;
insert into public.groups (id, name, owner_id)
values ('aaaaaaaa-0000-0000-0000-000000000009', 'Alice Habit Group', :'uidA');
insert into public.categories (id, group_id, name, metric_type, direction, unit, created_by)
values ('cccccccc-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000009','Meditation','streak','increase','days', :'uidA');
select public._assert((select count(*) from public.groups) = 2, 'Alice is a member of exactly her 2 own groups');

reset role;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set role authenticated;
select public._assert(
  (select count(*) from public.groups where id='aaaaaaaa-0000-0000-0000-000000000009') = 0,
  'Bob CANNOT see Alice''s second group');
select public._assert(
  (select count(*) from public.categories where group_id='aaaaaaaa-0000-0000-0000-000000000009') = 0,
  'Bob CANNOT see Alice''s second group''s streak category');
select public._assert(
  (select count(*) from public.group_members where group_id='aaaaaaaa-0000-0000-0000-000000000009') = 0,
  'Bob CANNOT see Alice''s second group''s membership');

-- ── anon preview by code works; anon cannot read tables ──────────────────────
reset role;
set request.jwt.claims = '';
set role anon;
select public._assert(
  (select count(*) from public.preview_group_by_code(:'alice_code')) = 1,
  'anon can preview a group by invite code (RPC)');
select public._assert(
  (select count(*) from public.entries) = 0, 'anon sees no entries');
select public._assert(
  (select count(*) from public.groups) = 0, 'anon sees no groups directly');

reset role;
select '════════ ALL ISOLATION ASSERTIONS PASSED ════════' as result;
