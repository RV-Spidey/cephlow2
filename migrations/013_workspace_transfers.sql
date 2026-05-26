-- Workspace-to-workspace credit transfers + atomic marketplace purchase
-- Run after 012_lock_credit_rpcs.sql

-- ─── 1. Transfer code on workspaces ──────────────────────────────────────────
-- A short unique address (8 uppercase hex chars) that workspaces share so
-- others can send them credits without knowing their UUID.

alter table public.workspaces
  add column if not exists transfer_code text unique;

-- Backfill existing rows
do $$
declare r record;
begin
  for r in select id from public.workspaces where transfer_code is null loop
    update public.workspaces
       set transfer_code = upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8))
     where id = r.id;
  end loop;
end;
$$;

-- Auto-assign for new workspaces
create or replace function public.generate_transfer_code()
returns trigger language plpgsql as $$
begin
  if new.transfer_code is null then
    new.transfer_code :=
      upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  end if;
  return new;
end;
$$;

drop trigger if exists set_workspace_transfer_code on public.workspaces;
create trigger set_workspace_transfer_code
  before insert on public.workspaces
  for each row execute function public.generate_transfer_code();

-- ─── 2. Link ledger entries to the transfer that caused them ─────────────────

alter table public.ledgers
  add column if not exists transfer_id uuid;

-- ─── 3. workspace_transfers (append-only transfer ledger) ────────────────────

create table if not exists public.workspace_transfers (
  id                uuid        primary key default gen_random_uuid(),
  from_workspace_id uuid        not null references public.workspaces(id),
  to_workspace_id   uuid        not null references public.workspaces(id),
  amount            numeric     not null check (amount > 0),
  note              text        not null default '',
  initiated_by      text        not null,  -- auth.uid()
  created_at        timestamptz not null default now(),
  constraint no_self_transfer check (from_workspace_id <> to_workspace_id)
);

create index if not exists wt_from_idx on public.workspace_transfers(from_workspace_id);
create index if not exists wt_to_idx   on public.workspace_transfers(to_workspace_id);
create index if not exists wt_date_idx on public.workspace_transfers(created_at desc);

alter table public.workspace_transfers enable row level security;

create policy "members read own workspace transfers"
  on public.workspace_transfers for select
  using (
    from_workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
    or
    to_workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

-- ─── 4. send_workspace_credits RPC ───────────────────────────────────────────
-- Atomically debits one workspace, credits another, and writes both ledger
-- entries plus a workspace_transfers row — all inside one transaction.

create or replace function public.send_workspace_credits(
  p_from_workspace_id uuid,
  p_to_workspace_id   uuid,
  p_amount            numeric,
  p_user_id           text,
  p_note              text default ''
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_from_balance numeric;
  v_to_balance   numeric;
  v_from_name    text;
  v_to_name      text;
  v_transfer_id  uuid;
begin
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;
  if p_amount <> floor(p_amount) then
    return jsonb_build_object('success', false, 'error', 'Amount must be a whole number');
  end if;
  if p_from_workspace_id = p_to_workspace_id then
    return jsonb_build_object('success', false, 'error', 'Cannot transfer to the same workspace');
  end if;

  -- Only admins/owners may send
  if not exists (
    select 1 from public.workspace_members
     where workspace_id = p_from_workspace_id
       and user_id      = p_user_id
       and role in ('owner', 'admin')
  ) then
    return jsonb_build_object('success', false, 'error', 'Only workspace admins can send credits');
  end if;

  -- Lock + read source
  select current_balance, name into v_from_balance, v_from_name
    from public.workspaces
   where id = p_from_workspace_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Source workspace not found');
  end if;

  if v_from_balance < p_amount then
    return jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'available', v_from_balance
    );
  end if;

  -- Lock + read destination
  select current_balance, name into v_to_balance, v_to_name
    from public.workspaces
   where id = p_to_workspace_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Destination workspace not found');
  end if;

  -- Debit source
  update public.workspaces
     set current_balance = current_balance - p_amount
   where id = p_from_workspace_id;

  -- Credit destination
  update public.workspaces
     set current_balance = current_balance + p_amount
   where id = p_to_workspace_id;

  -- Record transfer
  insert into public.workspace_transfers(from_workspace_id, to_workspace_id, amount, note, initiated_by)
  values (p_from_workspace_id, p_to_workspace_id, p_amount, p_note, p_user_id)
  returning id into v_transfer_id;

  -- Debit ledger entry
  insert into public.ledgers(workspace_id, user_id, type, amount, balance_after, description, transfer_id)
  values (
    p_from_workspace_id, p_user_id, 'transfer_out',
    -p_amount,
    v_from_balance - p_amount,
    case when p_note = '' then 'Credits sent to ' || v_to_name else p_note end,
    v_transfer_id
  );

  -- Credit ledger entry
  insert into public.ledgers(workspace_id, user_id, type, amount, balance_after, description, transfer_id)
  values (
    p_to_workspace_id, p_user_id, 'transfer_in',
    p_amount,
    v_to_balance + p_amount,
    case when p_note = '' then 'Credits received from ' || v_from_name else p_note end,
    v_transfer_id
  );

  return jsonb_build_object(
    'success',        true,
    'transferId',     v_transfer_id,
    'newFromBalance', v_from_balance - p_amount,
    'newToBalance',   v_to_balance   + p_amount
  );
end;
$$;

-- ─── 5. purchase_marketplace_frame RPC ───────────────────────────────────────
-- Replaces the 5-step JS purchase flow with a single atomic transaction:
-- deduct workspace balance, log ledger, atomically credit creator,
-- insert purchase row, increment purchase_count.

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
  v_listing  record;
  v_ws_bal   numeric;
  v_new_bal  numeric;
begin
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
     where listing_id  = p_listing_id
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

    insert into public.ledgers(workspace_id, user_id, type, amount, balance_after, description, metadata)
    values (
      p_workspace_id, p_user_id, 'deduction',
      -v_listing.price, v_new_bal,
      'Marketplace frame: ' || v_listing.name,
      jsonb_build_object(
        'listingId', p_listing_id,
        'frameTier', 'marketplace:' || p_listing_id::text,
        'batchId',   p_batch_id
      )
    );

    -- Atomic increment — no read-then-update race
    update public.user_profiles
       set creator_credits = creator_credits + v_listing.price
     where id = v_listing.published_by;
  end if;

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
