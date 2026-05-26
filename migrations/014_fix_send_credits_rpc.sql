-- Fix send_workspace_credits: cast p_user_id to uuid where compared against
-- workspace_members.user_id (uuid column) to resolve "operator does not exist: uuid = text".

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

  -- Cast to uuid for the workspace_members comparison (user_id is uuid there)
  if not exists (
    select 1 from public.workspace_members
     where workspace_id = p_from_workspace_id
       and user_id      = p_user_id::uuid
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
