-- ═════════════════════════════════════════════════════════════════════════════
-- ELEVATE — the five studios
--
-- Style Studio · Look Lab · Photo Coach · Confidence Coach · Timeline
--
-- ── WHAT MAKES THIS DIFFERENT FROM EVERY OTHER TABLE IN THE APP ──────────────
-- Elevate holds photographs of a person's face and body. Under POPIA that is
-- special personal information, and it is the most sensitive data Ascend will
-- ever store. Three rules follow, and they are structural rather than advisory:
--
--   1. OWNER-ONLY, NO EXCEPTIONS. Every table here is `user_id = auth.uid()`
--      for all operations. There is no sharing column, no visibility enum, no
--      "public" flag anywhere in this file. There is deliberately no way to
--      express "show this to someone else", because the moment that column
--      exists somebody will eventually set it.
--
--   2. NO CROSS-USER FUNCTION. Commit has cohort_progress() and
--      cohort_market(). Elevate has NOTHING equivalent and must never get one.
--      There is no leaderboard of anything here, no gallery, no comparison, no
--      "people like you". Not as a default — as an absence.
--
--   3. EVERY DELETION CASCADES TO STORAGE. delete_my_glowup_data() already
--      returns the storage paths to purge; this migration extends it to cover
--      the new photo-bearing tables so "delete my data" stays a complete
--      answer rather than a partial one.
-- ═════════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ─────────────────────────────────────────────────────────────────────────────
-- style_profiles — who this person is dressing as, and what for
--
-- One row per user. Drives every recommendation in every studio, which is why
-- it is a first-class table rather than a blob on a report: a person's style
-- direction outlives any single analysis.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.style_profiles (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  -- The direction they are moving in, chosen BY THEM. Never inferred from a
  -- photo, because telling somebody what their style "is" from a picture is a
  -- judgement, not a service.
  direction      text not null default 'smart_casual'
                   check (direction in (
                     'minimal','classic','streetwear','business','athleisure',
                     'smart_casual','creative','outdoor','formal'
                   )),
  -- What they are getting ready for. Changes what every studio recommends.
  goal_mode      text not null default 'general_confidence'
                   check (goal_mode in (
                     'interview','professional','dating_profile','wedding',
                     'vacation','general_confidence','content_creator',
                     'university','networking'
                   )),
  budget_tier    text not null default 'mid' check (budget_tier in ('low','mid','high')),
  -- Free text in the user's own words. Fed to the coach as context.
  notes          text,
  -- Things the user has asked never to be suggested. An explicit opt-out list
  -- is how a coaching product respects a boundary instead of re-litigating it
  -- every session.
  avoid          text[] not null default '{}',
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
alter table public.style_profiles enable row level security;

create policy "style_profiles_owner_only" on public.style_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- wardrobe_items — clothes the person already owns
--
-- Photographs here are of GARMENTS, not of people. That is a meaningful safety
-- difference: analysing a photo of a shirt on a hanger carries none of the risk
-- of analysing a photo of a body, and it is where most of the genuine styling
-- value lives anyway — you cannot plan outfits you do not know about.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.wardrobe_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  -- path inside the PRIVATE 'glowup' bucket, under the owner's folder
  storage_path  text,
  category      text not null check (category in (
                  'top','bottom','outerwear','footwear','accessory','formal','activewear'
                )),
  name          text not null,
  colour        text,
  material      text,
  -- Filled by the vision pass, correctable by the user. `detected` records what
  -- the model said so a correction is visibly a correction.
  detected      jsonb,
  seasons       text[] not null default '{}',
  occasions     text[] not null default '{}',
  -- For cost-per-wear. Optional: nobody should have to price their wardrobe to
  -- use the product.
  price_zar     numeric(10,2),
  wear_count    integer not null default 0 check (wear_count >= 0),
  last_worn     date,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.wardrobe_items enable row level security;

create policy "wardrobe_items_owner_only" on public.wardrobe_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index idx_wardrobe_user on public.wardrobe_items(user_id, archived);

-- ─────────────────────────────────────────────────────────────────────────────
-- looks — saved outfits, built from items the user owns
-- ─────────────────────────────────────────────────────────────────────────────
create table public.looks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  occasion    text,
  -- The reasoning behind the combination, in plain language. Stored so the user
  -- can see WHY later — a recommendation without a reason is just an order.
  rationale   text,
  item_ids    uuid[] not null default '{}',
  favourite   boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.looks enable row level security;

create policy "looks_owner_only" on public.looks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index idx_looks_user on public.looks(user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- coach_actions — the recommendations, and whether they were acted on
--
-- Every suggestion Elevate makes lands here as a discrete, tickable action with
-- an effort and a cost. That is the difference between coaching and a report:
-- a report is read once, an action can be done.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.coach_actions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  report_id    uuid references public.glowup_reports(id) on delete set null,
  studio       text not null check (studio in ('style','look','photo','confidence')),
  title        text not null,
  detail       text not null,
  -- Ordered so the user can start with what moves the needle most.
  impact       smallint not null default 2 check (impact between 1 and 3),
  effort       smallint not null default 2 check (effort between 1 and 3),
  cost_zar     numeric(10,2),
  status       text not null default 'open'
                 check (status in ('open','doing','done','dismissed')),
  -- Dismissing is first-class: "not for me" is useful information and must not
  -- require pretending to have done something.
  dismissed_reason text,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.coach_actions enable row level security;

create policy "coach_actions_owner_only" on public.coach_actions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index idx_coach_actions_user on public.coach_actions(user_id, status, impact desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- timeline_entries — the record of change over time
-- ─────────────────────────────────────────────────────────────────────────────
create table public.timeline_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in (
                 'photo','action_done','look_saved','goal_changed','report_ready','note'
               )),
  title        text not null,
  detail       text,
  storage_path text,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
alter table public.timeline_entries enable row level security;

create policy "timeline_owner_only" on public.timeline_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index idx_timeline_user on public.timeline_entries(user_id, occurred_at desc);

-- ═════════════════════════════════════════════════════════════════════════════
-- POPIA — "delete my data" must stay a COMPLETE answer.
--
-- Extends the existing erase path to the new photo-bearing tables. It returns
-- every storage path the caller owns so the server can purge the objects, then
-- removes the rows. Adding a table that stores a storage_path without adding it
-- here would silently turn a complete deletion into a partial one.
-- ═════════════════════════════════════════════════════════════════════════════
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
