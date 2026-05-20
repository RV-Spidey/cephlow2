-- Banner display settings on batches
-- Run against your Supabase project after 002_workspaces.sql

alter table public.batches
  add column if not exists banner_overlay_opacity numeric not null default 0.70;

alter table public.batches
  add column if not exists banner_text_color text not null default 'default';
