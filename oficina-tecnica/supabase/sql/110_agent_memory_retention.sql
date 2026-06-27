-- 110_agent_memory_retention.sql
-- Retencion corta para memoria de agentes.
-- Ejecutar en Supabase SQL Editor despues de 100_clean_start_schema.sql.

begin;

create index if not exists agent_conversations_created_at_idx
  on public.agent_conversations(created_at desc);

create index if not exists agent_memories_created_at_idx
  on public.agent_memories(created_at desc);

grant delete on public.agent_memories to authenticated;

drop policy if exists agent_memories_write_admin on public.agent_memories;
drop policy if exists agent_memories_write_approved on public.agent_memories;
create policy agent_memories_write_approved on public.agent_memories
for insert to authenticated
with check (public.is_approved_user());

drop policy if exists agent_memories_delete_admin on public.agent_memories;
create policy agent_memories_delete_admin on public.agent_memories
for delete to authenticated
using (public.is_admin_user());

create or replace function public.purge_old_agent_memory(p_days integer default 5)
returns table (
  deleted_conversations integer,
  deleted_memories integer
)
language plpgsql
security invoker
as $$
declare
  v_cutoff timestamptz;
  v_conversations integer;
  v_memories integer;
begin
  v_cutoff := now() - make_interval(days => greatest(1, coalesce(p_days, 5)));

  delete from public.agent_conversations
  where created_at < v_cutoff;
  get diagnostics v_conversations = row_count;

  delete from public.agent_memories
  where created_at < v_cutoff;
  get diagnostics v_memories = row_count;

  return query select v_conversations, v_memories;
end;
$$;

grant execute on function public.purge_old_agent_memory(integer) to authenticated;

commit;

-- Limpieza manual:
-- select * from public.purge_old_agent_memory(5);
