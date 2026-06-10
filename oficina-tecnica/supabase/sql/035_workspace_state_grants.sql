-- 035_workspace_state_grants.sql
-- The 034 migration created public.workspace_state and its RLS policies,
-- but Postgres also requires explicit table-level GRANTs before RLS is
-- even evaluated. Without them, every request fails with
-- "permission denied for table workspace_state" (403), which is what
-- broke the shared Mesa de trabajo chat sync.
--
-- Also grants the same to agent_conversations, which was missing grants
-- for the same reason (seen as 403s on /agent_conversations in the
-- browser console).

begin;

grant usage on schema public to authenticated;

grant select, insert, update on public.workspace_state to authenticated;

grant select, insert, update, delete on public.agent_conversations to authenticated;

commit;
