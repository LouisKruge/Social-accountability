-- Minimal Supabase-compatible shim so the Ascend migration can be applied and
-- RLS-tested against a vanilla Postgres. Mirrors the pieces of the real
-- Supabase platform that the migration depends on.

-- Roles that Supabase provides out of the box.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- auth schema + a minimal users table matching the columns our trigger reads.
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  phone              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  -- mirrors the real Supabase column; the auto-confirm trigger sets it
  email_confirmed_at timestamptz,
  created_at         timestamptz not null default now()
);

-- Supabase's auth.uid(): reads the 'sub' claim from the request JWT GUC.
-- Tolerates the GUC being unset OR empty string (anon requests).
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select case
    when coalesce(current_setting('request.jwt.claims', true), '') = '' then null
    else nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  end;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase's auth.role(), used by some policies.
create or replace function auth.role()
returns text
language sql
stable
as $$
  select case
    when coalesce(current_setting('request.jwt.claims', true), '') = '' then 'anon'
    else coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', 'anon')
  end;
$$;
grant execute on function auth.role() to anon, authenticated, service_role;

-- ── Minimal storage shim (private-bucket policy testing) ────────────────────
create schema if not exists storage;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name      text not null,
  owner     uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

-- Mirrors Supabase's helper: splits an object path into folder segments.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
grant all on storage.objects, storage.buckets to service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
