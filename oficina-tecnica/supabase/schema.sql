-- OFICINA TECNICA — persistence schema for Supabase
--
-- Run this against a fresh Supabase project (SQL editor, or `supabase db push`)
-- and set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY to enable
-- real cloud persistence. Without it, the app falls back to localStorage only.
--
-- Design: a single JSON snapshot per workspace. This keeps the client-side
-- store (lib/store) simple — one document, synced as a whole — while still
-- giving you durable, multi-device, multi-user persistence in Postgres.
-- It can be normalized into per-entity tables later without changing the
-- public API surface the UI talks to (lib/store/persistence.ts).

create table if not exists workspace_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table workspace_state enable row level security;

-- Single shared workspace ("default"): any authenticated user of this
-- deployment may read and write it. Tighten this once you add per-company
-- accounts (e.g. scope by a `workspace_id` column tied to auth.uid()).
create policy "workspace_state_read" on workspace_state
  for select using (true);

create policy "workspace_state_write" on workspace_state
  for insert with check (true);

create policy "workspace_state_update" on workspace_state
  for update using (true);

-- Encrypted storage for model-provider API keys (see Conexiones de modelos).
-- Keys are encrypted application-side (see app/api/connections route) before
-- being written here — Postgres only ever stores ciphertext.
create table if not exists provider_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  provider text not null check (provider in ('anthropic', 'openai', 'google', 'ollama')),
  ciphertext text not null,
  base_url text,
  default_model text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

alter table provider_credentials enable row level security;

create policy "provider_credentials_rw" on provider_credentials
  for all using (true) with check (true);
