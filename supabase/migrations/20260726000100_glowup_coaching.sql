-- ═════════════════════════════════════════════════════════════════════════════
-- FEATURE TRACK B — Glow-up / confidence coaching
--
-- Additive only. Reuses `profiles` for identity. Deliberately shares NO view,
-- join or policy with the leaderboard or stakes schemas beyond referencing
-- profiles.id, so a bug in one feature's policies cannot expose another's data.
--
-- Photos are sensitive personal data under POPIA:
--   • stored in a PRIVATE Supabase Storage bucket (never public)
--   • served back to the owner only via short-lived signed URLs
--   • deletable by the user, storage objects included, from day one
-- ═════════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

create table public.glowup_reports (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  goal              text not null
                      check (goal in ('dating_profile','job_interview','general_confidence')),
  budget_tier       text not null check (budget_tier in ('low','mid','high')),
  style_preference  text,
  report_json       jsonb,
  status            text not null default 'pending'
                      check (status in ('pending','ready','failed')),
  payment_reference text,
  payment_status    text not null default 'pending'
                      check (payment_status in ('pending','paid','refunded')),
  created_at        timestamptz not null default now()
);
alter table public.glowup_reports enable row level security;

create policy "glowup_reports_owner_only" on public.glowup_reports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.glowup_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  report_id    uuid references public.glowup_reports(id) on delete cascade,
  -- path inside the PRIVATE 'glowup' bucket; never a public URL
  storage_path text not null,
  photo_type   text not null check (photo_type in ('face','outfit')),
  created_at   timestamptz not null default now()
);
alter table public.glowup_photos enable row level security;

create policy "glowup_photos_owner_only" on public.glowup_photos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index idx_glowup_reports_user on public.glowup_reports(user_id);
create index idx_glowup_photos_user  on public.glowup_photos(user_id);
create index idx_glowup_photos_report on public.glowup_photos(report_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- Age gate + upload consent.
--
-- The dating-profile use case means this feature is 18+. Consent is recorded
-- per account and re-affirmed at each upload in the UI. Stored on profiles
-- because it is an attribute of the person, not of a single report.
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.profiles
  add column if not exists glowup_age_confirmed_at timestamptz,
  add column if not exists glowup_consent_at       timestamptz;

-- ═════════════════════════════════════════════════════════════════════════════
-- PRIVATE storage bucket + owner-only object policies.
--
-- Objects are namespaced by user id: '<auth.uid()>/<report>/<file>'. The
-- policies below pin the first path segment to the caller, so a user can never
-- read or write another person's photo objects.
-- ═════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('glowup', 'glowup', false)
on conflict (id) do update set public = false;

drop policy if exists "glowup_objects_owner_select" on storage.objects;
create policy "glowup_objects_owner_select" on storage.objects
  for select using (
    bucket_id = 'glowup'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "glowup_objects_owner_insert" on storage.objects;
create policy "glowup_objects_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'glowup'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "glowup_objects_owner_delete" on storage.objects;
create policy "glowup_objects_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'glowup'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- POPIA: erase everything for this feature.
--
-- Returns the storage paths the caller must also remove from the bucket, so the
-- server action can delete the objects themselves rather than only the rows.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.delete_my_glowup_data()
returns table (deleted_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  return query
  with paths as (
    select storage_path from public.glowup_photos where user_id = auth.uid()
  ),
  del_photos as (
    delete from public.glowup_photos where user_id = auth.uid() returning 1
  ),
  del_reports as (
    delete from public.glowup_reports where user_id = auth.uid() returning 1
  )
  select p.storage_path from paths p;
end;
$$;

grant execute on function public.delete_my_glowup_data() to authenticated;
