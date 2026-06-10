-- 034_roundtable_shared_chat.sql
-- Mesa de trabajo (Roundtable) becomes a shared room:
-- 0) Create the base workspace_state table (it may not exist yet in this
--    project), with RLS policies allowing any authenticated user to read
--    and write the single shared workspace row.
-- 1) Enable Realtime on workspace_state so the shared chat (state.chats.roundtable)
--    syncs live across users without a manual refresh.
-- 2) Allow any authenticated user to read/write the shared agent-memory rows
--    (user_id = 'roundtable-shared'), so agents learn from every user's
--    messages in Mesa de trabajo, not just their own.

begin;

-- 0) Base workspace_state table (idempotent)
create table if not exists public.workspace_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspace_state enable row level security;

drop policy if exists "workspace_state_read" on public.workspace_state;
create policy "workspace_state_read" on public.workspace_state
  for select using (true);

drop policy if exists "workspace_state_write" on public.workspace_state;
create policy "workspace_state_write" on public.workspace_state
  for insert with check (true);

drop policy if exists "workspace_state_update" on public.workspace_state;
create policy "workspace_state_update" on public.workspace_state
  for update using (true);

-- 1) Realtime for workspace_state (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_state'
  ) then
    alter publication supabase_realtime add table public.workspace_state;
  end if;
end $$;

-- 2) Shared roundtable memory access for agent_conversations
drop policy if exists "roundtable_shared_memory" on public.agent_conversations;
create policy "roundtable_shared_memory" on public.agent_conversations
  for all
  using (user_id = 'roundtable-shared')
  with check (user_id = 'roundtable-shared');

commit;
