-- Track which frames have been purchased for each batch
-- Once paid, a frame is free to re-select at any time for that batch
-- Run against your Supabase project after 005_frame_tier.sql

alter table public.batches
  add column if not exists paid_frames text[] not null default '{}';
