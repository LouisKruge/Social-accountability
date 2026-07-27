-- ═════════════════════════════════════════════════════════════════════════════
-- COHORT MARKET COUNTS — how full is each challenge?
--
-- WHY THIS EXISTS
-- `cohort_progress()` is gated on membership, so a user browsing challenges they
-- have NOT joined can see nothing about them. The Commit dashboard needs the
-- trust signal every marketplace needs — "11 people are already in" — for
-- exactly those challenges. Without it every joinable challenge renders as an
-- empty pool, which is not merely unhelpful, it is wrong.
--
-- WHAT IT DELIBERATELY DOES NOT DO
-- It never selects, sums or otherwise touches stakes.amount or
-- stakes.payment_reference. It returns COUNTS ONLY.
--
--   • No SUM(amount). A sum is a leak: in a two-person cohort, knowing the total
--     and your own stake gives you the other person's to the cent. This is
--     asserted against in supabase/tests/features_isolation.test.sql and must
--     stay that way.
--   • No user_id, no display_name. The counts name nobody, so nothing here can
--     be attributed to an individual.
--
-- Callers derive a pool total as count × stake_cohorts.stake_amount. That figure
-- comes from the challenge's own PUBLIC terms (the amount every participant
-- agrees to stake on joining — see joinCohort, which sets it server-side), not
-- from reading anybody's row.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.cohort_market()
returns table (
  cohort_id        uuid,
  participant_count bigint,
  confirmed_count   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.cohort_id,
    count(*)::bigint                                       as participant_count,
    count(*) filter (where s.payment_confirmed)::bigint    as confirmed_count
  from public.stakes s
  where auth.uid() is not null
  group by s.cohort_id;
$$;

revoke execute on function public.cohort_market() from public, anon;
grant  execute on function public.cohort_market() to authenticated;
