-- Frame style per batch (issuer picks at creation time)
-- Run against your Supabase project after 004_banner_crop.sql

alter table public.batches
  add column if not exists frame_tier text not null default 'none';
