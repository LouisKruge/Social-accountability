-- Mirror Supabase's default privileges: anon/authenticated get table DML
-- (RLS still restricts which rows). service_role bypasses RLS entirely.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
