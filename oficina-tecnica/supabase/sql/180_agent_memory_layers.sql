-- 180_agent_memory_layers.sql
-- Capas de memoria para agentes:
-- 1) agent_conversations: historial corto (5 dias por defecto).
-- 2) agent_memories: memoria operativa temporal (60 dias por defecto).
-- 3) agent_knowledge: conocimiento permanente propuesto/aprobado por admin.

begin;

create table if not exists public.agent_knowledge (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  project_id text,
  title text not null,
  content text not null,
  knowledge_type text not null default 'criterion'
    check (knowledge_type in ('criterion', 'procedure', 'preference', 'lesson', 'standard', 'project_context')),
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected', 'archived')),
  source text not null default 'agent_learning',
  importance integer not null default 3 check (importance between 1 and 5),
  tags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  proposed_by text,
  approved_by text,
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_knowledge_title_not_blank check (length(trim(title)) > 0),
  constraint agent_knowledge_content_not_blank check (length(trim(content)) > 0),
  constraint agent_knowledge_tags_array check (jsonb_typeof(tags) = 'array'),
  constraint agent_knowledge_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists agent_knowledge_status_idx
  on public.agent_knowledge(status, created_at desc);

create index if not exists agent_knowledge_agent_status_idx
  on public.agent_knowledge(agent_id, status, importance desc, created_at desc);

create index if not exists agent_knowledge_project_idx
  on public.agent_knowledge(project_id, agent_id, status)
  where project_id is not null;

drop trigger if exists set_agent_knowledge_updated_at on public.agent_knowledge;
create trigger set_agent_knowledge_updated_at
before update on public.agent_knowledge
for each row execute function public.set_updated_at();

alter table public.agent_knowledge enable row level security;

grant select, insert, update on public.agent_knowledge to authenticated;

drop policy if exists agent_knowledge_read_approved_or_admin on public.agent_knowledge;
create policy agent_knowledge_read_approved_or_admin on public.agent_knowledge
for select to authenticated
using (status = 'approved' or public.is_admin_user());

drop policy if exists agent_knowledge_propose_approved_users on public.agent_knowledge;
create policy agent_knowledge_propose_approved_users on public.agent_knowledge
for insert to authenticated
with check (public.is_approved_user() and status = 'proposed');

drop policy if exists agent_knowledge_admin_update on public.agent_knowledge;
create policy agent_knowledge_admin_update on public.agent_knowledge
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create or replace function public.purge_old_agent_memory(
  p_conversation_days integer default 5,
  p_operational_days integer default 60
)
returns table (
  deleted_conversations integer,
  deleted_memories integer
)
language plpgsql
security invoker
as $$
declare
  v_conversation_cutoff timestamptz;
  v_operational_cutoff timestamptz;
  v_conversations integer;
  v_memories integer;
begin
  v_conversation_cutoff := now() - make_interval(days => greatest(1, coalesce(p_conversation_days, 5)));
  v_operational_cutoff := now() - make_interval(days => greatest(7, coalesce(p_operational_days, 60)));

  delete from public.agent_conversations
  where created_at < v_conversation_cutoff;
  get diagnostics v_conversations = row_count;

  delete from public.agent_memories
  where created_at < v_operational_cutoff;
  get diagnostics v_memories = row_count;

  return query select v_conversations, v_memories;
end;
$$;

grant execute on function public.purge_old_agent_memory(integer, integer) to authenticated;

commit;

-- Limpieza manual recomendada:
-- select * from public.purge_old_agent_memory(5, 60);
