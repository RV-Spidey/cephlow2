-- Fix uuid=text mismatches in two RPCs that were missed by migration 011:
--
-- 1. purchase_marketplace_frame (013): ledgers.user_id is uuid, p_user_id is text.
--    Also adds explicit gen_random_uuid() for ledgers.id (same issue as 016).
--
-- 2. transfer_creator_credits (008): user_profiles.id and workspace_members.user_id
--    are uuid, but p_user_id was compared without casting.

-- ─── 1. purchase_marketplace_frame ───────────────────────────────────────────

create or replace function public.purchase_marketplace_frame(
  p_listing_id   uuid,
  p_workspace_id uuid,
  p_user_id      text,
  p_batch_id     uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_listing    record;
  v_ws_bal     numeric;
  v_new_bal    numeric;
  v_user_uuid  uuid;
begin
  v_user_uuid := p_user_id::uuid;

  -- Lock listing to prevent concurrent purchase races
  select id, name, price, is_active, published_by, purchase_count
    into v_listing
    from public.frame_listings
   where id = p_listing_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Listing not found');
  end if;

  if not v_listing.is_active then
    return jsonb_build_object('success', false, 'error', 'This listing is no longer active');
  end if;

  -- Idempotency check
  if exists (
    select 1 from public.frame_purchases
     where listing_id   = p_listing_id
       and workspace_id = p_workspace_id
  ) then
    return jsonb_build_object(
      'success', true, 'alreadyOwned', true,
      'frameTier', 'marketplace:' || p_listing_id::text
    );
  end if;

  if v_listing.price > 0 then
    select current_balance into v_ws_bal
      from public.workspaces
     where id = p_workspace_id
     for update;

    if not found then
      return jsonb_build_object('success', false, 'error', 'Workspace not found');
    end if;

    if v_ws_bal < v_listing.price then
      return jsonb_build_object(
        'success', false,
        'error', 'Insufficient workspace balance',
        'required', v_listing.price,
        'available', v_ws_bal
      );
    end if;

    v_new_bal := v_ws_bal - v_listing.price;

    update public.workspaces
       set current_balance = v_new_bal
     where id = p_workspace_id;

    -- Explicit id + uuid cast for user_id
    insert into public.ledgers(id, workspace_id, user_id, type, amount, balance_after, description, metadata)
    values (
      gen_random_uuid(),
      p_workspace_id, v_user_uuid, 'deduction',
      -v_listing.price, v_new_bal,
      'Marketplace frame: ' || v_listing.name,
      jsonb_build_object(
        'listingId', p_listing_id,
        'frameTier', 'marketplace:' || p_listing_id::text,
        'batchId',   p_batch_id
      )
    );

    -- Atomic credit increment for the creator
    update public.user_profiles
       set creator_credits = creator_credits + v_listing.price
     where id = v_listing.published_by::uuid;
  end if;

  -- frame_purchases.purchased_by and creator_uid are text — no cast needed
  insert into public.frame_purchases(listing_id, workspace_id, purchased_by, batch_id, amount_paid, creator_uid)
  values (p_listing_id, p_workspace_id, p_user_id, p_batch_id, v_listing.price, v_listing.published_by);

  update public.frame_listings
     set purchase_count = purchase_count + 1,
         updated_at     = now()
   where id = p_listing_id;

  return jsonb_build_object(
    'success', true, 'alreadyOwned', false,
    'frameTier', 'marketplace:' || p_listing_id::text
  );
end;
$$;

-- ─── 2. transfer_creator_credits ─────────────────────────────────────────────

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
  v_user_uuid   uuid;
begin
  v_user_uuid := p_user_id::uuid;

  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- Lock and read user credits (cast text → uuid for user_profiles.id)
  select creator_credits into v_credits
    from public.user_profiles
   where id = v_user_uuid
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'User profile not found');
  end if;

  if v_credits < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient credits', 'available', v_credits);
  end if;

  -- Verify membership (workspace_members.user_id is uuid)
  if not exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace_id
       and user_id      = v_user_uuid
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
   where id = v_user_uuid;

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
