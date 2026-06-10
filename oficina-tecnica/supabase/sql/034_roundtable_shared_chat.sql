-- 034_roundtable_shared_chat.sql
-- Mesa de trabajo (Roundtable) becomes a shared room:
-- 1) Enable Realtime on workspace_state so the shared chat (state.chats.roundtable)
--    syncs live across users without a manual refresh.
-- 2) Allow any authenticated user to read/write the shared agent-memory rows
--    (user_id = 'roundtable-shared'), so agents learn from every user's
--    messages in Mesa de trabajo, not just their own.

begin;

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
