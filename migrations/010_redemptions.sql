-- Gift voucher redemption for creator credits
-- Run after 009_frame_likes.sql

-- ─── redemption_requests ─────────────────────────────────────────────────────

create table if not exists public.redemption_requests (
  id            uuid        primary key default gen_random_uuid(),
  user_id       text        not null,
  amount        numeric     not null
                constraint rr_min  check (amount >= 100),
  brand         text        not null
                constraint rr_brand check (brand in ('amazon', 'flipkart')),
  status        text        not null default 'pending'
                constraint rr_status check (status in ('pending', 'fulfilled', 'rejected')),
  voucher_code  text,
  admin_note    text,
  user_email    text        not null,   -- denormalized at request time
  creator_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists rr_user_id_idx on public.redemption_requests(user_id);
create index if not exists rr_status_idx  on public.redemption_requests(status)
  where status = 'pending';

alter table public.redemption_requests enable row level security;

create policy "user reads own redemptions"
  on public.redemption_requests for select
  using (user_id = auth.uid()::text);

-- All mutations go through the Express API (service-role key bypasses RLS).

-- ─── Touch updated_at ─────────────────────────────────────────────────────────

create or replace function public.touch_redemption_requests_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger rr_touch_updated_at
  before update on public.redemption_requests
  for each row execute function public.touch_redemption_requests_updated_at();

-- ─── redeem_creator_credits RPC ───────────────────────────────────────────────
-- Atomically deducts credits for a redemption request.
-- Also enforces the ₹20,000/year cap (Section 194R safeguard).

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

  -- Lock and read user credits
  select creator_credits into v_credits
    from public.user_profiles
   where id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'User profile not found');
  end if;

  if v_credits < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient credits', 'available', v_credits);
  end if;

  update public.user_profiles
     set creator_credits = creator_credits - p_amount
   where id = p_user_id;

  return jsonb_build_object('success', true, 'new_credits', v_credits - p_amount, 'yearly_used', v_yearly + p_amount);
end;
$$;

-- ─── refund_creator_credits RPC ───────────────────────────────────────────────
-- Adds credits back when a request is rejected or cancelled.

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
   where id = p_user_id;
end;
$$;
