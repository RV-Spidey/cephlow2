-- Banner crop / zoom settings on batches
-- Run against your Supabase project after 003_banner_settings.sql

alter table public.batches
  add column if not exists banner_crop_zoom numeric not null default 1.0;

alter table public.batches
  add column if not exists banner_crop_x numeric not null default 50;

alter table public.batches
  add column if not exists banner_crop_y numeric not null default 50;
