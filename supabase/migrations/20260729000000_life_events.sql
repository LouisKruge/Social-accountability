-- ═══════════════════════════════════════════════════════════════════════════
-- THE LIFE EVENTS ENGINE
--
-- The inversion: instead of "what do you want to improve?", Ascend works
-- backwards from a date a person already has in their life.
--
-- The PLAN is not stored. It is derived from (kind, date) by a pure function in
-- src/lib/events.ts, so a change to the domain knowledge — the haircut window,
-- the skincare lead time — applies to every existing event immediately instead
-- of leaving a trail of plans built by an older version of the rules.
--
-- What IS stored is only what the user did: the event, and which tasks they
-- ticked.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.life_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in (
    'interview','wedding','first_date','presentation','conference',
    'business_meeting','holiday','photoshoot','networking','graduation'
  )),
  -- The user's own words for it: "Standard Bank, 2nd round". Never generated.
  title      text not null check (length(trim(title)) between 1 and 120),
  event_date date not null,
  notes      text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index life_events_user_date_idx on public.life_events (user_id, event_date);

alter table public.life_events enable row level security;

-- A life event is among the most sensitive rows in this product: it says a
-- person is job-hunting, or going on a first date, or away from home on a given
-- week. Owner-only, in every direction, with no sharing mechanism at all.
create policy life_events_select_own on public.life_events
  for select using (user_id = auth.uid());
create policy life_events_insert_own on public.life_events
  for insert with check (user_id = auth.uid());
create policy life_events_update_own on public.life_events
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy life_events_delete_own on public.life_events
  for delete using (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────
-- Ticked tasks. A row exists only once the user has done the thing, so the
-- absence of a row is "not done" and there is no state to keep in sync with a
-- plan that is recomputed on every render.
-- ───────────────────────────────────────────────────────────────────────────
create table public.event_tasks (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.life_events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  task_key   text not null check (length(task_key) between 1 and 40),
  done_at    timestamptz not null default now(),
  unique (event_id, task_key)
);

create index event_tasks_user_idx on public.event_tasks (user_id);

alter table public.event_tasks enable row level security;

create policy event_tasks_select_own on public.event_tasks
  for select using (user_id = auth.uid());
-- The event must also belong to the caller: without this an authenticated user
-- could attach a task row to somebody else's event id.
create policy event_tasks_insert_own on public.event_tasks
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.life_events e where e.id = event_id and e.user_id = auth.uid())
  );
create policy event_tasks_delete_own on public.event_tasks
  for delete using (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────
-- Events are Elevate data, so "delete my Elevate data" must take them with it.
-- Extending the existing function rather than adding a second one: two deletion
-- paths is how a table gets forgotten, and the forgotten one is always the
-- newest.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.delete_my_glowup_data()
returns table (deleted_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select p.storage_path from public.glowup_photos p where p.user_id = auth.uid()
    union all
    select w.storage_path from public.wardrobe_items w
      where w.user_id = auth.uid() and w.storage_path is not null
    union all
    select t.storage_path from public.timeline_entries t
      where t.user_id = auth.uid() and t.storage_path is not null;

  delete from public.event_tasks     where user_id = auth.uid();
  delete from public.life_events     where user_id = auth.uid();
  delete from public.timeline_entries where user_id = auth.uid();
  delete from public.looks           where user_id = auth.uid();
  delete from public.wardrobe_items  where user_id = auth.uid();
  delete from public.coach_actions   where user_id = auth.uid();
  delete from public.glowup_photos   where user_id = auth.uid();
  delete from public.glowup_reports  where user_id = auth.uid();
  delete from public.style_profiles  where user_id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_glowup_data() from public, anon;
grant  execute on function public.delete_my_glowup_data() to authenticated;
