-- Fix: user_profiles.id is uuid but RPCs declared p_user_id as text.
-- PostgreSQL has no implicit uuid = text operator, so cast explicitly.

create or replace function public.redeem_creator_credits(
  p_user_id text,
  p_amount  numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_credits    numeric;
  v_yearly     numeric;
begin
  if p_amount < 100 then
    return jsonb_build_object('success', false, 'error', 'Minimum redemption is ₹100');
  end if;

  -- Check annual cap (₹20,000 per calendar year)
  select coalesce(sum(amount), 0) into v_yearly
    from public.redemption_requests
   where user_id = p_user_id
     and status in ('pending', 'fulfilled')
     and created_at >= date_trunc('year', now());

  if v_yearly + p_amount > 20000 then
    return jsonb_build_object(
      'success', false,
      'error', 'Annual redemption cap reached',
      'yearlyUsed', v_yearly,
      'yearlyLimit', 20000
    );
  end if;

  -- Lock and read user credits (cast text → uuid for user_profiles.id)
  select creator_credits into v_credits
    from public.user_profiles
   where id = p_user_id::uuid
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'User profile not found');
  end if;

  if v_credits < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient credits', 'available', v_credits);
  end if;

  update public.user_profiles
     set creator_credits = creator_credits - p_amount
   where id = p_user_id::uuid;

  return jsonb_build_object('success', true, 'new_credits', v_credits - p_amount, 'yearly_used', v_yearly + p_amount);
end;
$$;

create or replace function public.refund_creator_credits(
  p_user_id text,
  p_amount  numeric
)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_profiles
     set creator_credits = creator_credits + p_amount
   where id = p_user_id::uuid;
end;
$$;
