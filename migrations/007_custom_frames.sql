-- Custom frame templates scoped to a workspace
-- Allows users to design reusable frames (gradient, HUD, or raw CSS)
-- Run against your Supabase project after 006_paid_frames.sql

create table if not exists public.custom_frames (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  created_by   text        not null,
  name         text        not null default 'My Frame',
  config       jsonb       not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists custom_frames_workspace_id_idx
  on public.custom_frames(workspace_id);

alter table public.custom_frames enable row level security;

create policy "workspace members can manage their frames"
  on public.custom_frames for all
  using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );
