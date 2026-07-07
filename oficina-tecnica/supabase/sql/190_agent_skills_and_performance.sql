-- 190_agent_skills_and_performance.sql
-- Skills versionables e indicadores de desempeno para agentes IA.
--
-- Ejecutar despues de:
-- - 100_clean_start_schema.sql
-- - 180_agent_memory_layers.sql

begin;

create table if not exists public.agent_skill_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  skill_key text not null,
  name text not null,
  version text not null default 'v0.1',
  status text not null default 'proposed'
    check (status in ('draft', 'proposed', 'active', 'observed', 'rejected', 'archived')),
  discipline text,
  skill_type text,
  summary text not null,
  trigger_text text,
  inputs jsonb not null default '[]'::jsonb,
  workflow jsonb not null default '[]'::jsonb,
  safety_rules jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  proposed_by text,
  approved_by text,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_skill_versions_agent_not_blank check (length(trim(agent_id)) > 0),
  constraint agent_skill_versions_key_not_blank check (length(trim(skill_key)) > 0),
  constraint agent_skill_versions_name_not_blank check (length(trim(name)) > 0),
  constraint agent_skill_versions_summary_not_blank check (length(trim(summary)) > 0),
  constraint agent_skill_versions_inputs_array check (jsonb_typeof(inputs) = 'array'),
  constraint agent_skill_versions_workflow_array check (jsonb_typeof(workflow) = 'array'),
  constraint agent_skill_versions_safety_array check (jsonb_typeof(safety_rules) = 'array'),
  constraint agent_skill_versions_metrics_object check (jsonb_typeof(metrics) = 'object'),
  constraint agent_skill_versions_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint agent_skill_versions_unique_version unique (agent_id, skill_key, version)
);

create index if not exists agent_skill_versions_agent_status_idx
  on public.agent_skill_versions(agent_id, status, updated_at desc);
create index if not exists agent_skill_versions_key_idx
  on public.agent_skill_versions(skill_key, version desc);

drop trigger if exists set_agent_skill_versions_updated_at on public.agent_skill_versions;
create trigger set_agent_skill_versions_updated_at
before update on public.agent_skill_versions
for each row execute function public.set_updated_at();

create table if not exists public.agent_performance_events (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  project_id text,
  conversation_scope text not null default 'private'
    check (conversation_scope in ('private', 'roundtable', 'system')),
  event_type text not null
    check (event_type in (
      'answer',
      'supabase_grounded',
      'knowledge_proposed',
      'knowledge_approved',
      'skill_proposed',
      'skill_approved',
      'correction',
      'repeated_question',
      'hallucination',
      'clarification_needed',
      'clarification_unnecessary',
      'user_positive_signal',
      'user_negative_signal'
    )),
  score_delta integer not null default 0,
  weight numeric not null default 1,
  source text not null default 'chat',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  constraint agent_performance_events_agent_not_blank check (length(trim(agent_id)) > 0),
  constraint agent_performance_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists agent_performance_events_agent_created_idx
  on public.agent_performance_events(agent_id, created_at desc);
create index if not exists agent_performance_events_type_idx
  on public.agent_performance_events(event_type, created_at desc);
create index if not exists agent_performance_events_project_idx
  on public.agent_performance_events(project_id, agent_id)
  where project_id is not null;

create or replace view public.v_agent_performance_summary
with (security_invoker = true)
as
select
  agent_id,
  count(*)::integer as total_events,
  coalesce(sum(score_delta), 0)::integer as score,
  count(*) filter (where event_type = 'answer')::integer as answers,
  count(*) filter (where event_type = 'supabase_grounded')::integer as grounded_answers,
  count(*) filter (where event_type = 'knowledge_proposed')::integer as knowledge_proposals,
  count(*) filter (where event_type = 'knowledge_approved')::integer as knowledge_approved,
  count(*) filter (where event_type = 'skill_proposed')::integer as skill_proposals,
  count(*) filter (where event_type = 'skill_approved')::integer as skill_approved,
  count(*) filter (where event_type in ('correction', 'repeated_question', 'hallucination', 'user_negative_signal'))::integer as negative_signals,
  count(*) filter (where event_type = 'clarification_needed')::integer as useful_clarifications,
  max(created_at) as last_event_at,
  case
    when coalesce(sum(score_delta), 0) >= 120 then 'Experto'
    when coalesce(sum(score_delta), 0) >= 60 then 'Especialista'
    when coalesce(sum(score_delta), 0) >= 25 then 'Intermedio'
    else 'Inicial'
  end as level_label,
  least(100, greatest(0, 40 + coalesce(sum(score_delta), 0)))::integer as confidence_score
from public.agent_performance_events
group by agent_id;

alter table public.agent_skill_versions enable row level security;
alter table public.agent_performance_events enable row level security;

grant select, insert, update on public.agent_skill_versions to authenticated;
grant select, insert on public.agent_performance_events to authenticated;
grant select on public.v_agent_performance_summary to authenticated;

drop policy if exists agent_skill_versions_select on public.agent_skill_versions;
create policy agent_skill_versions_select on public.agent_skill_versions
for select to authenticated
using (status = 'active' or public.is_admin_user());

drop policy if exists agent_skill_versions_insert on public.agent_skill_versions;
create policy agent_skill_versions_insert on public.agent_skill_versions
for insert to authenticated
with check (public.is_approved_user());

drop policy if exists agent_skill_versions_update_admin on public.agent_skill_versions;
create policy agent_skill_versions_update_admin on public.agent_skill_versions
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists agent_performance_events_select on public.agent_performance_events;
create policy agent_performance_events_select on public.agent_performance_events
for select to authenticated
using (public.is_approved_user());

drop policy if exists agent_performance_events_insert on public.agent_performance_events;
create policy agent_performance_events_insert on public.agent_performance_events
for insert to authenticated
with check (public.is_approved_user());

-- Semillas iniciales: convierten las skills mock actuales en registros reales versionables.
insert into public.agent_skill_versions (
  agent_id,
  skill_key,
  name,
  version,
  status,
  discipline,
  skill_type,
  summary,
  trigger_text,
  inputs,
  workflow,
  safety_rules,
  source,
  approved_by,
  approved_at,
  metadata
) values
  (
    'ic',
    'revision_desviacion_presupuesto',
    'Revision de desviacion de presupuesto',
    'v1.3',
    'active',
    'Costos',
    'analysis-workflow',
    'Evalua desviaciones de costo contra presupuesto base, evidencia y curva de avance.',
    'Solicitud de analisis de desviacion costo-plazo o sobrecostos.',
    '["Presupuesto base aprobado", "Valorizacion mensual actualizada", "Actas o evidencia de campo"]'::jsonb,
    '["Calcular variacion porcentual", "Identificar causa raiz", "Separar costo incurrido y comprometido", "Proponer accion correctiva con evidencia"]'::jsonb,
    '["No proponer adicionales sin evidencia", "Indicar fuente de cada supuesto", "Escalar montos relevantes a GG"]'::jsonb,
    'seed_190',
    'system',
    now(),
    '{"seed":"190_agent_skills_and_performance"}'::jsonb
  ),
  (
    'pm',
    'gestion_restricciones_proyecto',
    'Gestion de restricciones de proyecto',
    'v1.1',
    'proposed',
    'PMO',
    'review-protocol',
    'Identifica restricciones, impacto en ruta critica y responsables de cierre.',
    'Revision de restricciones, riesgos, retrasos o bloqueos de proyecto.',
    '["Lista de restricciones", "Cronograma actualizado", "Registro de riesgos"]'::jsonb,
    '["Clasificar restriccion", "Evaluar impacto en hito", "Asignar responsable", "Escalar si es contractual"]'::jsonb,
    '["No cerrar restricciones contractuales sin aprobacion", "Registrar evidencia antes de marcar como resuelta"]'::jsonb,
    'seed_190',
    null,
    null,
    '{"seed":"190_agent_skills_and_performance"}'::jsonb
  ),
  (
    'ie',
    'revision_criterios_diseno_electrico',
    'Revision de criterios de diseno electrico',
    'v0.1',
    'proposed',
    'Electrica',
    'knowledge-method',
    'Revisa criterios tecnicos y normativos para diseno electrico.',
    'Solicitud de revision normativa, calculos o criterios electricos.',
    '["Norma aplicable", "Especificacion del cliente", "Memoria o dato tecnico"]'::jsonb,
    '["Identificar norma", "Verificar criterio", "Documentar observacion", "Proponer correccion"]'::jsonb,
    '["No reemplaza firma de ingeniero responsable", "Distinguir supuesto de dato verificado"]'::jsonb,
    'seed_190',
    null,
    null,
    '{"seed":"190_agent_skills_and_performance"}'::jsonb
  )
on conflict (agent_id, skill_key, version) do update set
  name = excluded.name,
  status = excluded.status,
  discipline = excluded.discipline,
  skill_type = excluded.skill_type,
  summary = excluded.summary,
  trigger_text = excluded.trigger_text,
  inputs = excluded.inputs,
  workflow = excluded.workflow,
  safety_rules = excluded.safety_rules,
  updated_at = now();

commit;
