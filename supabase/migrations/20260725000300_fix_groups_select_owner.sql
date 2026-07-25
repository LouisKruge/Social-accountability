-- ═════════════════════════════════════════════════════════════════════════════
-- FIX: `INSERT ... RETURNING` on groups was rejected by RLS.
--
-- The app creates a group with `.insert({...}).select("id")`, which compiles to
-- INSERT ... RETURNING. Under RLS, RETURNING additionally requires the SELECT
-- policy to pass for the new row. The SELECT policy was `is_group_member(id)`,
-- but the AFTER INSERT trigger that adds the owner to group_members has not
-- taken effect at that point — so the creator could not see their own new group
-- and Postgres raised:
--   "new row violates row-level security policy for table \"groups\""
--
-- Fix: an owner can always see their own group, independent of membership. This
-- does not weaken isolation — the owner is added as a member anyway, and
-- non-members still cannot see the group (both branches are scoped to
-- auth.uid()).
--
-- NOTE: the original isolation tests inserted WITHOUT a RETURNING clause, so
-- they never exercised this path. supabase/tests/rls_isolation.test.sql now
-- covers INSERT ... RETURNING to prevent a regression.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "groups_select_member" on public.groups;

create policy "groups_select_owner_or_member" on public.groups
  for select using (
    owner_id = auth.uid()
    or public.is_group_member(id)
  );
