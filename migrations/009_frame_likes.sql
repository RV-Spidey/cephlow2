-- Frame likes & creator names
-- Run after 008_frame_marketplace.sql

-- ─── Creator name on user_profiles ───────────────────────────────────────────

alter table public.user_profiles
  add column if not exists creator_name text;

-- ─── like_count on frame_listings ────────────────────────────────────────────

alter table public.frame_listings
  add column if not exists like_count integer not null default 0;

-- ─── frame_likes ─────────────────────────────────────────────────────────────

create table if not exists public.frame_likes (
  id          uuid        primary key default gen_random_uuid(),
  listing_id  uuid        not null references public.frame_listings(id) on delete cascade,
  user_id     text        not null,  -- auth.uid()
  created_at  timestamptz not null default now(),
  unique (listing_id, user_id)
);

create index if not exists frame_likes_listing_idx on public.frame_likes(listing_id);
create index if not exists frame_likes_user_idx    on public.frame_likes(user_id);

alter table public.frame_likes enable row level security;

create policy "authenticated can read likes"
  on public.frame_likes for select
  using (auth.role() = 'authenticated');

create policy "user can insert own like"
  on public.frame_likes for insert
  with check (user_id = auth.uid()::text);

create policy "user can delete own like"
  on public.frame_likes for delete
  using (user_id = auth.uid()::text);
