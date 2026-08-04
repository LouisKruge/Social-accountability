-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 5 AUDIT: RLS coverage + POPIA account-deletion cascade
-- Run after the migration (and after the shim/grants). Uses the same _assert
-- helper style; any failure raises under ON_ERROR_STOP.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public._assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS: %', label;
  else raise exception 'FAIL: %', label; end if;
end $$;

-- ── 1. RLS enabled on every public table ─────────────────────────────────────
select public._assert(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
   where c.relkind='r' and not c.relrowsecurity) = 0,
  'RLS is enabled on every public table');

-- ── 2. No data-table policy uses USING (true) ───────────────────────────────
select public._assert(
  (select count(*) from pg_policies
   where schemaname='public' and (qual = 'true' or with_check = 'true')) = 0,
  'No policy uses USING (true) / WITH CHECK (true) on a data table');

-- ── 3. Every public table has at least one policy ───────────────────────────
select public._assert(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
   where c.relkind='r'
     and not exists (select 1 from pg_policy p where p.polrelid=c.oid)) = 0,
  'Every public table has at least one RLS policy');

-- ── 4. POPIA deletion cascade: a user's rows vanish across EVERY table ───────
-- Seed a fully-populated user (owns a group, category, baseline, entry, ranking,
-- share card, subscription) then delete the account and assert zero rows remain.
\set uid 'deadbeef-0000-0000-0000-0000000000aa'

insert into auth.users (id, email, raw_user_meta_data)
values (:'uid', 'erase@example.com', '{"display_name":"Erase Me"}'::jsonb);

insert into public.groups (id, name, owner_id)
values ('deadbeef-0000-0000-0000-0000000000b1', 'Erasable Group', :'uid');
insert into public.categories (id, group_id, name, metric_type, direction, unit, created_by)
values ('deadbeef-0000-0000-0000-0000000000c1','deadbeef-0000-0000-0000-0000000000b1','Steps','percentage_change','increase','steps', :'uid');
insert into public.category_baselines (user_id, category_id, baseline_value)
values (:'uid','deadbeef-0000-0000-0000-0000000000c1', 4000);
insert into public.entries (user_id, category_id, period_start, period_end, raw_value)
values (:'uid','deadbeef-0000-0000-0000-0000000000c1','2026-07-13','2026-07-19', 5000);
insert into public.leaderboard_rankings (id, group_id, category_id, period_start, period_end, user_id, pct_change, rank)
values ('deadbeef-0000-0000-0000-0000000000d1','deadbeef-0000-0000-0000-0000000000b1','deadbeef-0000-0000-0000-0000000000c1','2026-07-13','2026-07-19',:'uid', 25, 1);
insert into public.share_cards (user_id, ranking_id)
values (:'uid','deadbeef-0000-0000-0000-0000000000d1');
insert into public.discipline_snapshots (user_id, taken_on, score, momentum, coverage)
values (:'uid','2026-07-19', 780, 84, 0.920);
insert into public.trophies (user_id, trophy_key, evidence, season)
values (:'uid','ten_weeks','10 ranked weeks', 3);
-- (subscription row was auto-created by the signup trigger)

select public._assert((select count(*) from public.subscriptions where user_id=:'uid') = 1, 'seed: subscription exists');

-- Delete the auth user (what delete_my_account() does under the hood).
delete from auth.users where id = :'uid';

select public._assert((select count(*) from public.profiles             where id=:'uid') = 0, 'cascade: profile removed');
select public._assert((select count(*) from public.groups               where owner_id=:'uid') = 0, 'cascade: owned group removed');
select public._assert((select count(*) from public.group_members        where user_id=:'uid') = 0, 'cascade: memberships removed');
select public._assert((select count(*) from public.categories           where group_id='deadbeef-0000-0000-0000-0000000000b1') = 0, 'cascade: categories removed with group');
select public._assert((select count(*) from public.category_baselines   where user_id=:'uid') = 0, 'cascade: baselines removed');
select public._assert((select count(*) from public.entries              where user_id=:'uid') = 0, 'cascade: entries removed');
select public._assert((select count(*) from public.leaderboard_rankings where user_id=:'uid') = 0, 'cascade: rankings removed');
select public._assert((select count(*) from public.share_cards          where user_id=:'uid') = 0, 'cascade: share cards removed');
select public._assert((select count(*) from public.subscriptions        where user_id=:'uid') = 0, 'cascade: subscription removed');
select public._assert((select count(*) from public.discipline_snapshots where user_id=:'uid') = 0, 'cascade: discipline snapshots removed');
select public._assert((select count(*) from public.trophies              where user_id=:'uid') = 0, 'cascade: trophies removed');

-- ── 5. SET NULL path: a member deletes their account, but a category they
--       created in someone ELSE's group survives (attribution dropped), and the
--       deletion is NOT blocked by the FK. ─────────────────────────────────────
\set oscar 'deadbeef-0000-0000-0000-0000000000e1'
\set mia   'deadbeef-0000-0000-0000-0000000000e2'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'oscar', 'oscar@example.com', '{"display_name":"Oscar"}'::jsonb),
  (:'mia',   'mia@example.com',   '{"display_name":"Mia"}'::jsonb);

insert into public.groups (id, name, owner_id)
values ('deadbeef-0000-0000-0000-0000000000f1', 'Oscar Group', :'oscar');
insert into public.group_members (group_id, user_id, role)
values ('deadbeef-0000-0000-0000-0000000000f1', :'mia', 'member');
insert into public.categories (id, group_id, name, metric_type, direction, unit, created_by)
values ('deadbeef-0000-0000-0000-0000000000f2','deadbeef-0000-0000-0000-0000000000f1','Mia Cat','percentage_change','increase','ZAR', :'mia');

delete from auth.users where id = :'mia';

select public._assert(
  (select count(*) from public.categories where id='deadbeef-0000-0000-0000-0000000000f2') = 1,
  'set null: category survives its creator''s account deletion');
select public._assert(
  (select created_by is null from public.categories where id='deadbeef-0000-0000-0000-0000000000f2'),
  'set null: category.created_by is NULL after creator deleted');
select public._assert(
  (select count(*) from public.groups where id='deadbeef-0000-0000-0000-0000000000f1') = 1,
  'set null: someone else''s group is untouched');

select '════════ AUDIT + DELETION CASCADE PASSED ════════' as result;
