-- Frame Marketplace
-- Adds public frame listings, purchase tracking, per-user creator credits,
-- and an atomic transfer RPC.
-- Run after 007_custom_frames.sql

-- ─── Creator credits on user_profiles ────────────────────────────────────────

alter table public.user_profiles
  add column if not exists creator_credits numeric not null default 0
  constraint creator_credits_non_negative check (creator_credits >= 0);

-- ─── frame_listings ───────────────────────────────────────────────────────────

create table if not exists public.frame_listings (
  id             uuid        primary key default gen_random_uuid(),
  frame_id       uuid        not null references public.custom_frames(id) on delete cascade,
  published_by   text        not null,  -- auth.uid()
  workspace_id   uuid        not null references public.workspaces(id) on delete cascade,
  name           text        not null,
  description    text        not null default '',
  price          numeric     not null default 0
                 constraint price_range check (price = 0 or (price >= 20 and price <= 100)),
  is_active      boolean     not null default true,
  purchase_count integer     not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists frame_listings_active_idx
  on public.frame_listings(is_active) where is_active = true;

create index if not exists frame_listings_published_by_idx
  on public.frame_listings(published_by);

alter table public.frame_listings enable row level security;

-- Anyone authenticated can browse active listings
create policy "anyone can read active listings"
  on public.frame_listings for select
  using (is_active = true);

-- Publisher can manage (update/delete) their own listings
create policy "publisher manages own listing"
  on public.frame_listings for all
  using (published_by = auth.uid()::text);

-- ─── frame_purchases ──────────────────────────────────────────────────────────
-- One row per (workspace × listing). Once purchased, the workspace can apply
-- the frame to any number of batches for free.

create table if not exists public.frame_purchases (
  id             uuid        primary key default gen_random_uuid(),
  listing_id     uuid        not null references public.frame_listings(id) on delete restrict,
  workspace_id   uuid        not null references public.workspaces(id) on delete cascade,
  purchased_by   text        not null,  -- auth.uid()
  batch_id       uuid        references public.batches(id) on delete set null,
  amount_paid    numeric     not null,
  creator_uid    text        not null,  -- denormalized from listing at purchase time
  created_at     timestamptz not null default now()
);

-- Workspace pays once per listing
create unique index if not exists frame_purchases_workspace_listing_idx
  on public.frame_purchases(listing_id, workspace_id);

create index if not exists frame_purchases_listing_id_idx
  on public.frame_purchases(listing_id);

alter table public.frame_purchases enable row level security;

create policy "workspace members read own purchases"
  on public.frame_purchases for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

-- ─── transfer_creator_credits RPC ────────────────────────────────────────────
-- Atomically moves credits from user_profiles.creator_credits to
-- workspaces.current_balance. SECURITY DEFINER so the function can write both
-- tables regardless of the caller's RLS context.

create or replace function public.transfer_creator_credits(
  p_user_id      text,
  p_workspace_id uuid,
  p_amount       numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_credits     numeric;
  v_ws_balance  numeric;
begin
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- Lock and read user credits
  select creator_credits into v_credits
    from public.user_profiles
   where id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'User profile not found');
  end if;

  if v_credits < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient credits',
                               'available', v_credits);
  end if;

  -- Verify user is a member of the target workspace
  if not exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace_id
       and user_id = p_user_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Not a member of this workspace');
  end if;

  -- Lock and read workspace balance
  select current_balance into v_ws_balance
    from public.workspaces
   where id = p_workspace_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Workspace not found');
  end if;

  update public.user_profiles
     set creator_credits = creator_credits - p_amount
   where id = p_user_id;

  update public.workspaces
     set current_balance = current_balance + p_amount
   where id = p_workspace_id;

  return jsonb_build_object(
    'success',               true,
    'new_credits',           v_credits - p_amount,
    'new_workspace_balance', v_ws_balance + p_amount
  );
end;
$$;
