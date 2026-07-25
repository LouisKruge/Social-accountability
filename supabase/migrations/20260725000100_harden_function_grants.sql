-- ═════════════════════════════════════════════════════════════════════════════
-- Follow-up hardening (addresses Supabase security advisor WARNs)
--
-- 1. Pin search_path on the one trigger fn that was missing it.
-- 2. Trigger functions never need caller EXECUTE (they fire as the table owner),
--    so revoke the default PUBLIC execute to keep them off the REST RPC surface.
-- 3. delete_my_account is destructive — only signed-in users may call it.
--
-- The RLS helper fns (is_group_member, shares_group_with,
-- is_member_of_category_group) and the invite RPCs (join_group_by_code,
-- preview_group_by_code) remain callable by design: they're either used by RLS
-- policy evaluation or are intentional endpoints, and they're safe by
-- construction (every one scopes to auth.uid() / a single invite code).
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. search_path
create or replace function public.protect_owner_membership()
returns trigger
language plpgsql
set search_path = public
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

-- 2. trigger functions off the RPC surface. Supabase grants EXECUTE to
--    anon/authenticated explicitly (not only via PUBLIC), so revoke all three.
--    Triggers still fire — trigger execution doesn't check the DML user's
--    EXECUTE privilege on the trigger function.
revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.handle_new_group()         from public, anon, authenticated;
revoke execute on function public.protect_owner_membership() from public, anon, authenticated;

-- 3. destructive account deletion: signed-in only. Revoke from anon; the app
--    calls it as `authenticated`, which keeps its grant.
revoke execute on function public.delete_my_account() from public, anon;
