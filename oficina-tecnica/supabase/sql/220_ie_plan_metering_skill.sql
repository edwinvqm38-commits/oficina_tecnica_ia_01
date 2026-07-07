-- 220_ie_plan_metering_skill.sql
-- Skill versionable para el agente IE: metrado e interpretacion de planos.
--
-- Ejecutar despues de:
-- - 180_agent_memory_layers.sql
-- - 190_agent_skills_and_performance.sql

begin;

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
values (
  'ie',
  'metrado_planos_electricos',
  'Metrado visual de planos electricos e instrumentacion',
  'v1.0',
  'active',
  'Electrica',
  'vision_review_protocol',
  'Protocolo para interpretar planos PDF/imagen, leer leyendas, contar solo elementos visibles y reportar metrado con confianza por item.',
  'plano, pdf, imagen, unifilar, tablero, cuadro de cargas, leyenda, metrado, enumera equipos, interpreta plano',
  '[
    "PDF vectorial o escaneado renderizado como imagen",
    "Imagen o captura pegada en la mesa de trabajo",
    "Leyenda visible del plano cuando exista",
    "Solicitud del usuario: metrar, enumerar, interpretar o validar equipos/materiales"
  ]'::jsonb,
  '[
    "Declarar alcance de lectura: pagina completa, recorte visible, hoja parcial o imagen borrosa.",
    "Leer primero la leyenda y construir una tabla simbolo-descripcion-texto visible.",
    "Contar solo simbolos, etiquetas, ramales o textos legibles en el plano actual.",
    "Separar metrado observado de elementos inferidos o no verificables.",
    "Responder en tabla con Item, Equipo/material, Simbolo/etiqueta visible, Cantidad, Ubicacion/plano/zona, Confianza y Observacion.",
    "Pedir PDF vectorial, mayor resolucion o recorte de zona critica si no se puede validar."
  ]'::jsonb,
  '[
    "No inventar equipos tipicos ni etiquetas genericas como I1, C1, R1, M1 o T1 si no aparecen visibles.",
    "No asumir cantidades por experiencia; usar No verificable cuando falte evidencia.",
    "No mezclar informacion de adjuntos anteriores cuando el usuario adjunta un plano nuevo.",
    "No afirmar confianza alta si la imagen esta recortada, borrosa o no muestra la leyenda completa.",
    "No reemplazar revision humana de planos IFC/constructivos; entregar premetrado y observaciones."
  ]'::jsonb,
  '{
    "requires_legend_mapping": true,
    "requires_confidence_per_row": true,
    "target_hallucination_rate": 0,
    "preferred_output": "tables"
  }'::jsonb,
  'seed_sql',
  'codex',
  'codex',
  now(),
  '{"seed":"220_ie_plan_metering_skill","reason":"correccion_por_hallucination_en_metrado_de_plano"}'::jsonb
)
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
  'ie',
  null,
  'Criterio de metrado visual de planos electricos',
  'Cuando el usuario pida metrar, enumerar o interpretar un plano electrico, no crear equipos genericos ni etiquetas no visibles. Primero leer la leyenda, mapear simbolos a descripciones y luego contar solo elementos visibles en el plano actual. Si una etiqueta, simbolo, cantidad o conexion no se puede leer, marcar como No verificable y pedir mejor resolucion, PDF vectorial o recorte. Este criterio corrige respuestas que inventen I1, C1, R1, M1, T1 u otros componentes no presentes.',
  'criterion',
  'approved',
  'seed_sql',
  5,
  '["ie","metrado","planos","vision","anti_hallucination"]'::jsonb,
  '{"seed":"220_ie_plan_metering_skill","approved_for_prompt_context":true}'::jsonb,
  'codex',
  'codex',
  now()
where not exists (
  select 1
  from public.agent_knowledge
  where agent_id = 'ie'
    and title = 'Criterio de metrado visual de planos electricos'
    and status <> 'archived'
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
  'ie',
  'system',
  'skill_approved',
  8,
  'seed_sql',
  'Skill aprobada: metrado visual de planos electricos e instrumentacion.',
  '{"skill_key":"metrado_planos_electricos","version":"v1.0","seed":"220_ie_plan_metering_skill"}'::jsonb,
  'codex'
where not exists (
  select 1
  from public.agent_performance_events
  where agent_id = 'ie'
    and event_type = 'skill_approved'
    and metadata ->> 'skill_key' = 'metrado_planos_electricos'
    and metadata ->> 'version' = 'v1.0'
);

commit;
