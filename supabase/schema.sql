-- AI Editorial Workspace — Supabase schema
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text,
  text text,
  note text,
  status text not null
    check (status in ('ok', 'needs_manual_text', 'error')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists sources_created_at_idx
  on public.sources (created_at desc);

create index if not exists sources_status_idx
  on public.sources (status);

-- ---------------------------------------------------------------------------
-- RLS (locked down)
-- ---------------------------------------------------------------------------
-- Take-home has no end-user auth. All reads/writes go through Next.js API
-- routes using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- Anon/authenticated have NO policies => Data API access is denied.
-- Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.

alter table public.sources enable row level security;

drop policy if exists "sources_select_anon" on public.sources;
drop policy if exists "sources_insert_anon" on public.sources;
drop policy if exists "sources_update_anon" on public.sources;
