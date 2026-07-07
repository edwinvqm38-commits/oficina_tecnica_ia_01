-- 230_agent_html_app_generation_skill.sql
-- Skill versionable: generacion de aplicaciones HTML autocontenidas desde la Mesa.
--
-- Ejecutar despues de:
-- - 180_agent_memory_layers.sql
-- - 190_agent_skills_and_performance.sql

begin;

with agent_seeds(agent_id, discipline, name) as (
  values
    ('ie', 'Electrica', 'Aplicaciones HTML de ingenieria electrica'),
    ('ic', 'Costos', 'Aplicaciones HTML de costos y presupuestos'),
    ('pm', 'PMO', 'Aplicaciones HTML de gestion y seguimiento'),
    ('cd', 'Control documentario', 'Aplicaciones HTML de trazabilidad documental'),
    ('ti', 'Sistemas', 'Aplicaciones HTML de diagnostico tecnico')
)
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
  metrics,
  source,
  proposed_by,
  approved_by,
  approved_at,
  metadata
)
select
  agent_id,
  'html_app_generation',
  name,
  'v1.0',
  'active',
  discipline,
  'generation-workflow',
  'Genera aplicaciones HTML autocontenidas, con nivel profesional, para probar en la Mesa de trabajo: simuladores, calculadoras, dashboards, formularios, perfiles graficos, matrices y prototipos con datos editables.',
  'html, app, aplicacion, simulador, calculadora, dashboard, prototipo, replica este html, mejoralo, probar en la mesa, descargable',
  '[
    "Solicitud funcional del usuario",
    "HTML, PDF, imagen, tabla o datos adjuntos como referencia",
    "Formulas, criterios, variables y supuestos del dominio",
    "Formato esperado: app embebida, descarga HTML, dashboard o calculadora"
  ]'::jsonb,
  '[
    "Confirmar objetivo, entradas, salidas y restricciones de la app.",
    "Si hay HTML adjunto, usarlo como fuente principal para estructura, datos, formulas y flujo.",
    "Generar un bloque html-app con documento completo: html, head, css y script.",
    "Si el usuario pide similar, replica, mejora o avanzada, no entregar una calculadora minima de una sola pantalla.",
    "Incluir como minimo cabecera profesional, tarjetas KPI, navegacion por tabs/secciones, tabla editable, recalculo en tiempo real, grafica o canvas/SVG, resultados/resumen, validaciones y exportacion.",
    "Para ingenieria, incluir cuando aplique formulas visibles, supuestos editables, tabla de parametros, perfil/esquema en canvas o SVG, grafica tecnica y reporte resumido.",
    "Usar librerias CDN livianas solo si aportan valor claro: Plotly, Chart.js, MathJax/KaTeX o XLSX.",
    "Agregar exportacion CSV/JSON/HTML cuando sea util para revision o entrega.",
    "Si el alcance es muy grande, entregar una version funcional por modulos y listar el siguiente modulo pendiente."
  ]'::jsonb,
  '[
    "No incluir API keys, tokens ni secretos.",
    "No hacer llamadas a APIs privadas desde el HTML generado.",
    "No afirmar que una app esta completa si solo se entrego una maqueta.",
    "No mezclar datos de adjuntos anteriores cuando el usuario adjunta un HTML nuevo.",
    "No usar librerias pesadas si una solucion con JavaScript vanilla o Plotly/Chart.js basta.",
    "Indicar supuestos tecnicos y limites de calculo cuando la app haga ingenieria o economia."
  ]'::jsonb,
  '{
    "preferred_output": "html-app",
    "requires_downloadable_html": true,
    "requires_interactive_controls": true,
    "target_hallucination_rate": 0
  }'::jsonb,
  'seed_sql',
  'codex',
  'codex',
  now(),
  '{"seed":"230_agent_html_app_generation_skill","approved_for_prompt_context":true}'::jsonb
from agent_seeds
on conflict (agent_id, skill_key, version) do update set
  status = excluded.status,
  summary = excluded.summary,
  trigger_text = excluded.trigger_text,
  inputs = excluded.inputs,
  workflow = excluded.workflow,
  safety_rules = excluded.safety_rules,
  metrics = excluded.metrics,
  approved_by = excluded.approved_by,
  approved_at = excluded.approved_at,
  metadata = excluded.metadata,
  updated_at = now();

with agent_seeds(agent_id, title) as (
  values
    ('ie', 'Criterio para apps HTML de ingenieria electrica'),
    ('ic', 'Criterio para apps HTML de costos'),
    ('pm', 'Criterio para apps HTML de gestion'),
    ('cd', 'Criterio para apps HTML documentales'),
    ('ti', 'Criterio para apps HTML tecnicas')
)
insert into public.agent_knowledge (
  agent_id,
  project_id,
  title,
  content,
  knowledge_type,
  status,
  source,
  importance,
  tags,
  metadata,
  proposed_by,
  approved_by,
  approved_at
)
select
  agent_id,
  null,
  title,
  'Cuando el usuario pida una aplicacion, simulador, calculadora, dashboard, prototipo o replica/mejora de un HTML adjunto, entregar una app funcional dentro de un bloque html-app. Si pide algo similar o avanzado, no entregar una demo minima: incluir cabecera profesional, KPIs, tabs, tabla editable, recalculo, validaciones, graficas/canvas/SVG, reporte y exportacion cuando corresponda. La app debe ser autocontenida y ejecutable en navegador. Si el usuario valida el resultado, resumir arquitectura, formulas, entradas/salidas y criterios UX para usarlo como plantilla futura.',
  'criterion',
  'approved',
  'seed_sql',
  4,
  '["html-app","apps","simuladores","dashboards","generation"]'::jsonb,
  '{"seed":"230_agent_html_app_generation_skill","approved_for_prompt_context":true}'::jsonb,
  'codex',
  'codex',
  now()
from agent_seeds a
where not exists (
  select 1
  from public.agent_knowledge k
  where k.agent_id = a.agent_id
    and k.title = a.title
    and k.status <> 'archived'
);

insert into public.agent_performance_events (
  agent_id,
  conversation_scope,
  event_type,
  score_delta,
  source,
  message,
  metadata,
  created_by
)
select
  agent_id,
  'system',
  'skill_approved',
  6,
  'seed_sql',
  'Skill aprobada: generacion de aplicaciones HTML autocontenidas.',
  jsonb_build_object('skill_key', 'html_app_generation', 'version', 'v1.0', 'seed', '230_agent_html_app_generation_skill'),
  'codex'
from (values ('ie'), ('ic'), ('pm'), ('cd'), ('ti')) as a(agent_id)
where not exists (
  select 1
  from public.agent_performance_events e
  where e.agent_id = a.agent_id
    and e.event_type = 'skill_approved'
    and e.metadata ->> 'skill_key' = 'html_app_generation'
    and e.metadata ->> 'version' = 'v1.0'
);

commit;
