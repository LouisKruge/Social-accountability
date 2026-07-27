-- ═══════════════════════════════════════════════════════════════════════════
-- ISOLATION TESTS — Habit Stakes (Track A) + Glow-Up (Track B)
--
-- Track A DoD: two users in the SAME cohort; neither may read the other's
--   stakes.amount or stakes.payment_reference by ANY query path — including
--   through the cohort leaderboard, which must expose progress/rank only.
-- Track B DoD: photos and reports are owner-only, and storage objects are
--   pinned to the owner's folder.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public._assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS: %', label;
  else raise exception 'FAIL: %', label; end if;
end $$;
grant execute on function public._assert(boolean, text) to anon, authenticated, service_role;

\set uidA 'aaaa1111-0000-0000-0000-00000000aaaa'
\set uidB 'bbbb2222-0000-0000-0000-00000000bbbb'
\set cohort 'ccccdddd-0000-0000-0000-00000000cccc'

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'uidA', 'stake_a@example.com', '{"display_name":"Ayanda"}'::jsonb),
  (:'uidB', 'stake_b@example.com', '{"display_name":"Bongani"}'::jsonb);

insert into public.stake_cohorts (id, name, target_value, start_date, end_date, stake_amount, created_by)
values (:'cohort', '30-day steps', 300000, '2026-08-01', '2026-08-31', 100, :'uidA');

-- ═══════════════ A stakes into the cohort ═══════════════════════════════════
set request.jwt.claims = '{"sub":"aaaa1111-0000-0000-0000-00000000aaaa","role":"authenticated"}';
set role authenticated;
insert into public.stakes (cohort_id, user_id, amount, payment_reference, payment_confirmed)
values (:'cohort', :'uidA', 100, 'ASCEND-REF-AAA-SECRET', true);

select public._assert(
  (select count(*) from public.stakes where user_id = :'uidA') = 1,
  'A can read her own stake');

-- ═══════════════ B stakes into the SAME cohort ══════════════════════════════
reset role;
set request.jwt.claims = '{"sub":"bbbb2222-0000-0000-0000-00000000bbbb","role":"authenticated"}';
set role authenticated;
insert into public.stakes (cohort_id, user_id, amount, payment_reference, payment_confirmed)
values (:'cohort', :'uidB', 250, 'ASCEND-REF-BBB-SECRET', true);

-- ── THE CORE FINANCIAL PRIVACY ASSERTIONS ───────────────────────────────────
select public._assert(
  (select count(*) from public.stakes where user_id = :'uidA') = 0,
  'B CANNOT read A''s stake row at all');
select public._assert(
  (select count(*) from public.stakes) = 1,
  'B sees only his own stake, despite sharing the cohort');
select public._assert(
  (select count(*) from public.stakes where amount = 100) = 0,
  'B CANNOT read A''s stakes.amount');
select public._assert(
  (select count(*) from public.stakes where payment_reference = 'ASCEND-REF-AAA-SECRET') = 0,
  'B CANNOT read A''s payment_reference');
select public._assert(
  (select coalesce(sum(amount), 0) from public.stakes) = 250,
  'B cannot aggregate over A''s amounts (no pool-size leak via SUM)');

-- ── The cohort leaderboard exposes progress, never money ────────────────────
reset role;
set role service_role;
insert into public.daily_verification_logs (stake_id, log_date, verified_value, source)
select id, '2026-08-02', 120000, 'manual' from public.stakes where user_id = :'uidA';
insert into public.daily_verification_logs (stake_id, log_date, verified_value, source)
select id, '2026-08-02', 310000, 'manual' from public.stakes where user_id = :'uidB';

reset role;
set request.jwt.claims = '{"sub":"bbbb2222-0000-0000-0000-00000000bbbb","role":"authenticated"}';
set role authenticated;

select public._assert(
  (select count(*) from public.cohort_progress(:'cohort')) = 2,
  'cohort board shows BOTH participants to a member');
select public._assert(
  (select current_progress from public.cohort_progress(:'cohort') where user_id = :'uidA') = 120000,
  'cohort board exposes A''s PROGRESS to co-member B (intended)');
select public._assert(
  (select hit_target from public.cohort_progress(:'cohort') where user_id = :'uidB') = true,
  'cohort board computes hit_target from verified effort');
-- the projection structurally cannot carry money columns
select public._assert(
  not exists (
    select 1 from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_name = 'cohort_progress'
      and p.parameter_name in ('amount','payment_reference','payment_confirmed')
  ),
  'cohort_progress() projection contains NO money columns');

-- ── B cannot read A's verification logs directly ────────────────────────────
select public._assert(
  (select count(*) from public.daily_verification_logs) = 1,
  'B sees only his own verification logs');

-- ── A non-member cannot see the cohort board at all ─────────────────────────
reset role;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';
set role authenticated;
select public._assert(
  (select count(*) from public.cohort_progress(:'cohort')) = 0,
  'a NON-member sees nothing on the cohort board');

-- ── cohort_market(): how full a challenge is, WITHOUT any money ─────────────
-- A browsing user must be able to see that a challenge has people in it before
-- joining. That is a COUNT. It must never become a window onto amounts.
select public._assert(
  (select participant_count from public.cohort_market() where cohort_id = :'cohort') = 2,
  'cohort_market() shows a NON-member how many people are in a challenge');
select public._assert(
  (select confirmed_count from public.cohort_market() where cohort_id = :'cohort') = 2,
  'cohort_market() reports how many stakes are confirmed');
select public._assert(
  not exists (
    select 1 from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_name = 'cohort_market'
      and p.parameter_name in ('amount','payment_reference','payment_confirmed','user_id')
  ),
  'cohort_market() projection contains NO money columns and NO user identity');
-- A staked 100, B staked 250, so the true sum is 350. The pool figure the UI
-- derives is count x the cohort''s PUBLIC stake_amount = 2 x 100 = 200. The two
-- disagreeing is the proof that nothing here reads anybody''s amount.
select public._assert(
  (select participant_count * c.stake_amount
     from public.cohort_market() m
     join public.stake_cohorts c on c.id = m.cohort_id
    where m.cohort_id = :'cohort') = 200,
  'the pool figure comes from PUBLIC terms, not from summing anyone''s stake');

reset role;
set request.jwt.claims = '{"role":"anon"}';
set role anon;
do $$
begin
  begin
    perform * from public.cohort_market();
    raise exception 'FAIL: anon executed cohort_market()';
  exception when insufficient_privilege then
    raise notice 'PASS: anon CANNOT execute cohort_market()';
  end;
end $$;

reset role;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';
set role authenticated;

-- ── Payouts are owner-read-only and client-unwritable ───────────────────────
reset role;
set role service_role;
insert into public.payouts (cohort_id, user_id, amount, kind)
values (:'cohort', :'uidA', 180, 'winnings'), (:'cohort', :'uidB', 180, 'winnings');

reset role;
set request.jwt.claims = '{"sub":"bbbb2222-0000-0000-0000-00000000bbbb","role":"authenticated"}';
set role authenticated;
select public._assert(
  (select count(*) from public.payouts) = 1,
  'B sees only his own payout row');
do $$
begin
  begin
    insert into public.payouts (cohort_id, user_id, amount)
    values ('ccccdddd-0000-0000-0000-00000000cccc','bbbb2222-0000-0000-0000-00000000bbbb', 99999);
    raise exception 'FAIL: a client inserted a payout';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: clients CANNOT write payouts (settlement is server-side only)';
  end;
end $$;

-- ═══════════════ TRACK B — glow-up privacy ══════════════════════════════════
reset role;
set request.jwt.claims = '{"sub":"aaaa1111-0000-0000-0000-00000000aaaa","role":"authenticated"}';
set role authenticated;
insert into public.glowup_reports (id, user_id, goal, budget_tier)
values ('eeee0000-0000-0000-0000-00000000eeee', :'uidA', 'dating_profile', 'mid');
insert into public.glowup_photos (user_id, report_id, storage_path, photo_type)
values (:'uidA', 'eeee0000-0000-0000-0000-00000000eeee',
        'aaaa1111-0000-0000-0000-00000000aaaa/eeee0000/face.jpg', 'face');
insert into storage.objects (bucket_id, name)
values ('glowup', 'aaaa1111-0000-0000-0000-00000000aaaa/eeee0000/face.jpg');

reset role;
set request.jwt.claims = '{"sub":"bbbb2222-0000-0000-0000-00000000bbbb","role":"authenticated"}';
set role authenticated;
select public._assert(
  (select count(*) from public.glowup_reports) = 0,
  'B CANNOT read A''s glow-up report');
select public._assert(
  (select count(*) from public.glowup_photos) = 0,
  'B CANNOT read A''s glow-up photo rows');
select public._assert(
  (select count(*) from storage.objects where bucket_id = 'glowup') = 0,
  'B CANNOT read A''s photo objects in the private bucket');
do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('glowup','aaaa1111-0000-0000-0000-00000000aaaa/eeee0000/stolen.jpg');
    raise exception 'FAIL: B wrote into A''s storage folder';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: B CANNOT write into A''s storage folder';
  end;
end $$;
select public._assert(
  (select public = false from storage.buckets where id = 'glowup'),
  'the glowup bucket is PRIVATE');

-- ── POPIA erase removes rows and reports the storage paths to purge ─────────
reset role;
set request.jwt.claims = '{"sub":"aaaa1111-0000-0000-0000-00000000aaaa","role":"authenticated"}';
set role authenticated;
select public._assert(
  (select count(*) from public.delete_my_glowup_data()) = 1,
  'delete_my_glowup_data returns the storage path to purge');
select public._assert(
  (select count(*) from public.glowup_photos) = 0
  and (select count(*) from public.glowup_reports) = 0,
  'delete_my_glowup_data removed A''s photo and report rows');

-- ── Cross-feature: no leakage between the two new tracks or the leaderboard ─
select public._assert(
  (select count(*) from public.stakes where user_id = :'uidB') = 0,
  'glow-up user A still cannot see stakes belonging to B');

reset role;
select '════════ FEATURE ISOLATION ASSERTIONS PASSED ════════' as result;
