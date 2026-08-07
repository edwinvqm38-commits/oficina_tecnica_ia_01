-- Preview controlado: diagnostico y reconciliacion manual del codigo RQ
-- No ejecutar como script de correccion sin revisar primero los SELECT.
--
-- Caso objetivo confirmado:
--   requerimiento_id        = a1c768de-737f-4fa5-bdcb-1e98a0ea7e63
--   cotizacion_id           = ab96ca99-1ef6-45ea-bda4-4b5a435fafaf
--   cotizacion              = FOR-EKA-PRO-3_2026-055_REV02
--   codigo actual incorrecto = RQ-2026-NEXA-RCJM-P001-002
--   codigo correcto          = RQ-2026-NEXA-RCJM-P002-001
--   proyecto correcto        = P002
--
-- Este archivo no aplica cambios. Todo INSERT/UPDATE/COMMIT esta comentado.

-- 1) Proyectos adjudicados y alcance NEXA/RCJM.
select
  id,
  anio,
  codigo_proyecto,
  cotizacion,
  oc,
  cliente,
  codigo_cliente,
  unidad_trabajo,
  codigo_unidad,
  estado,
  activo
from public.proyectos_adjudicados
where anio = 2026
  and (
    cotizacion in (
      'COT-EKA-2026-143',
      'FOR-EKA-PRO-3_2026-055_REV02'
    )
    or (
      codigo_cliente = 'NEXA'
      and codigo_unidad = 'RCJM'
    )
  )
order by codigo_proyecto, cotizacion;

-- 2) Requerimiento objetivo y cotizacion completa sin asumir columnas de cotizaciones.
select
  r.id,
  r.codigo,
  r.cotizacion_id,
  r.cotizacion_codigo,
  r.codigo_cliente,
  r.codigo_unidad,
  r.codigo_proyecto_adjudicado,
  r.anio,
  r.estado,
  r.deleted_at,
  r.created_at,
  r.updated_at,
  r.metadata,
  to_jsonb(c) as cotizacion_detalle
from public.requerimientos r
left join public.cotizaciones c on c.id = r.cotizacion_id
where r.id = 'a1c768de-737f-4fa5-bdcb-1e98a0ea7e63'::uuid
   or r.codigo = 'RQ-2026-NEXA-RCJM-P001-002';

-- 3) Reserva anual de P### desde proyectos_adjudicados y requerimientos activos/eliminados.
with reserved_project_codes as (
  select upper(trim(pa.codigo_proyecto)) as project_code, 'proyectos_adjudicados.codigo_proyecto' as source
  from public.proyectos_adjudicados pa
  where pa.anio = 2026
    and upper(trim(pa.codigo_proyecto)) ~ '^P[0-9]{3}$'
  union
  select upper(trim(r.codigo_proyecto_adjudicado)) as project_code, 'requerimientos.codigo_proyecto_adjudicado' as source
  from public.requerimientos r
  where r.anio = 2026
    and upper(trim(coalesce(r.codigo_proyecto_adjudicado, ''))) ~ '^P[0-9]{3}$'
  union
  select (regexp_match(upper(trim(r.codigo)), '^RQ-2026-[A-Z0-9]+-[A-Z0-9]+-(P[0-9]{3})-[0-9]{3}$'))[1] as project_code,
         'requerimientos.codigo' as source
  from public.requerimientos r
  where upper(trim(r.codigo)) ~ '^RQ-2026-[A-Z0-9]+-[A-Z0-9]+-P[0-9]{3}-[0-9]{3}$'
),
reserved_summary as (
  select
    array_agg(distinct project_code order by project_code) as all_reserved_project_codes,
    max(substring(project_code from 2)::int) as max_project_number
  from reserved_project_codes
),
candidate as (
  select
    coalesce(all_reserved_project_codes, array[]::text[]) as all_reserved_project_codes,
    coalesce(max_project_number, 0) as max_project_number,
    'P' || lpad((coalesce(max_project_number, 0) + 1)::text, 3, '0') as next_project_code
  from reserved_summary
)
select
  all_reserved_project_codes,
  max_project_number,
  next_project_code,
  exists (
    select 1
    from public.proyectos_adjudicados pa
    where pa.anio = 2026
      and upper(trim(pa.codigo_proyecto)) = 'P002'
  ) as candidate_exists_in_projects,
  exists (
    select 1
    from public.requerimientos r
    where (
        r.anio = 2026
        and upper(trim(coalesce(r.codigo_proyecto_adjudicado, ''))) = 'P002'
      )
      or upper(trim(r.codigo)) ~ '^RQ-2026-[A-Z0-9]+-[A-Z0-9]+-P002-[0-9]{3}$'
  ) as candidate_exists_in_requirements,
  'RQ-2026-NEXA-RCJM-P002-001' as proposed_requirement_code
from candidate;

-- 4) Proyecto exacto inexistente antes de la correccion.
select
  count(*) as exact_project_count,
  string_agg(codigo_proyecto, ', ' order by codigo_proyecto) as exact_project_codes
from public.proyectos_adjudicados
where anio = 2026
  and cotizacion = 'FOR-EKA-PRO-3_2026-055_REV02';

-- 5) Codigo nuevo inexistente y codigo antiguo presente.
select
  'old_code_in_requerimientos' as check_name,
  count(*) as rows_found
from public.requerimientos
where codigo = 'RQ-2026-NEXA-RCJM-P001-002'
union all
select
  'new_code_in_requerimientos' as check_name,
  count(*) as rows_found
from public.requerimientos
where codigo = 'RQ-2026-NEXA-RCJM-P002-001';

-- 6) Referencias confirmadas por UUID/codigo.
select 'requerimientos.codigo_old' as reference_name, count(*) as rows_found
from public.requerimientos
where codigo = 'RQ-2026-NEXA-RCJM-P001-002'
union all
select 'requerimiento_items.requerimiento_id' as reference_name, count(*) as rows_found
from public.requerimiento_items
where requerimiento_id = 'a1c768de-737f-4fa5-bdcb-1e98a0ea7e63'::uuid
union all
select 'email_threads.entity_code_old' as reference_name, count(*) as rows_found
from public.email_threads
where entity_type = 'requirement'
  and entity_code = 'RQ-2026-NEXA-RCJM-P001-002'
union all
select 'email_send_attempts.entity_code_old' as reference_name, count(*) as rows_found
from public.email_send_attempts
where entity_type = 'requirement'
  and entity_code = 'RQ-2026-NEXA-RCJM-P001-002';

-- 7) Detalle de historial Gmail asociado al codigo anterior.
select
  'email_threads' as source_table,
  id::text,
  user_email,
  gmail_account_id::text,
  entity_type,
  entity_code,
  subject,
  gmail_thread_id,
  last_gmail_message_id,
  last_sent_at,
  created_at,
  updated_at
from public.email_threads
where entity_type = 'requirement'
  and entity_code = 'RQ-2026-NEXA-RCJM-P001-002'
union all
select
  'email_send_attempts' as source_table,
  id::text,
  user_email,
  gmail_account_id::text,
  entity_type,
  entity_code,
  subject,
  gmail_thread_id,
  gmail_message_id as last_gmail_message_id,
  sent_at as last_sent_at,
  created_at,
  updated_at
from public.email_send_attempts
where entity_type = 'requirement'
  and entity_code = 'RQ-2026-NEXA-RCJM-P001-002'
order by source_table, updated_at desc;

-- 8) Matriz de columnas candidatas que pueden guardar codigo RQ o relaciones por UUID.
select
  table_schema,
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (
    column_name in (
      'codigo',
      'codigo_rq',
      'codigo_proyecto_adjudicado',
      'requerimiento_codigo',
      'rq_code',
      'entity_code',
      'requerimiento_id',
      'cotizacion_id'
    )
    or column_name ilike '%requerimiento%'
    or column_name ilike '%rq%'
    or column_name ilike '%entity_code%'
  )
order by table_name, ordinal_position;

-- 9) Bloque transaccional de correccion manual.
-- Estrategia Gmail recomendada si los envios fueron de prueba:
--   - Conservar public.email_send_attempts como auditoria historica.
--   - No reutilizar ni actualizar public.email_threads del codigo anterior.
--   - Permitir que el primer envio con RQ-2026-NEXA-RCJM-P002-001 cree un hilo Gmail nuevo.
--   - Evitar que el nuevo RQ quede enlazado al subject/hilo antiguo.
--
-- Estrategia Gmail alternativa:
--   - Actualizar entity_code en email_threads/email_send_attempts solo si no hay colision
--     y si se decide continuar historicamente el mismo hilo.
--   - No borrar auditoria ni alterar mensajes ya enviados en Gmail.
--
-- begin;
--
-- do $$
-- declare
--   v_requirement_id uuid := 'a1c768de-737f-4fa5-bdcb-1e98a0ea7e63'::uuid;
--   v_cotizacion_id uuid := 'ab96ca99-1ef6-45ea-bda4-4b5a435fafaf'::uuid;
--   v_cotizacion_codigo text := 'FOR-EKA-PRO-3_2026-055_REV02';
--   v_old_code text := 'RQ-2026-NEXA-RCJM-P001-002';
--   v_new_code text := 'RQ-2026-NEXA-RCJM-P002-001';
--   v_new_project text := 'P002';
-- begin
--   if not exists (
--     select 1
--     from public.requerimientos
--     where id = v_requirement_id
--       and codigo = v_old_code
--       and cotizacion_id = v_cotizacion_id
--       and cotizacion_codigo = v_cotizacion_codigo
--   ) then
--     raise exception 'El requerimiento objetivo no coincide con id/codigo/cotizacion esperados.';
--   end if;
--
--   if exists (
--     select 1
--     from public.requerimientos
--     where codigo = v_new_code
--       and id <> v_requirement_id
--   ) then
--     raise exception 'El codigo nuevo ya existe en otro requerimiento.';
--   end if;
--
--   if exists (
--     select 1
--     from public.proyectos_adjudicados
--     where anio = 2026
--       and upper(trim(codigo_proyecto)) = v_new_project
--       and cotizacion <> v_cotizacion_codigo
--   ) then
--     raise exception 'P002 ya esta asignado a otra cotizacion en proyectos_adjudicados.';
--   end if;
--
--   if exists (
--     select 1
--     from public.requerimientos
--     where id <> v_requirement_id
--       and (
--         (anio = 2026 and upper(trim(coalesce(codigo_proyecto_adjudicado, ''))) = v_new_project)
--         or upper(trim(codigo)) ~ '^RQ-2026-[A-Z0-9]+-[A-Z0-9]+-P002-[0-9]{3}$'
--       )
--   ) then
--     raise exception 'P002 ya esta reservado por otro requerimiento.';
--   end if;
-- end $$;
--
-- insert into public.proyectos_adjudicados (
--   id,
--   anio,
--   codigo_proyecto,
--   cotizacion,
--   oc,
--   cliente,
--   codigo_cliente,
--   unidad_trabajo,
--   codigo_unidad,
--   fecha_adjudicacion,
--   estado,
--   activo
-- )
-- values (
--   'pa-reconcile-2026-nexa-rcjm-p002',
--   2026,
--   'P002',
--   'FOR-EKA-PRO-3_2026-055_REV02',
--   coalesce(null::text, ''), -- oc es text not null default ''; representa OC no informada.
--   'NEXA RESOURCES',
--   'NEXA',
--   'Refinería Cajamarquilla',
--   'RCJM',
--   current_date,
--   'Activo',
--   true
-- );
--
-- update public.requerimientos
-- set
--   codigo = 'RQ-2026-NEXA-RCJM-P002-001',
--   codigo_proyecto_adjudicado = 'P002',
--   metadata =
--     jsonb_set(
--       jsonb_set(
--         jsonb_set(
--           jsonb_set(coalesce(metadata, '{}'::jsonb), '{codigo_original_reconciliado}', to_jsonb('RQ-2026-NEXA-RCJM-P001-002'::text), true),
--           '{codigo_reconciliado}',
--           to_jsonb('RQ-2026-NEXA-RCJM-P002-001'::text),
--           true
--         ),
--         '{motivo_reconciliacion}',
--         to_jsonb('proyecto P reutilizado incorrectamente entre cotizaciones'::text),
--         true
--       ),
--       '{reconciliado_at}',
--       to_jsonb(now()::text),
--       true
--     ),
--   updated_at = now()
-- where id = 'a1c768de-737f-4fa5-bdcb-1e98a0ea7e63'::uuid
--   and codigo = 'RQ-2026-NEXA-RCJM-P001-002'
--   and cotizacion_id = 'ab96ca99-1ef6-45ea-bda4-4b5a435fafaf'::uuid
--   and cotizacion_codigo = 'FOR-EKA-PRO-3_2026-055_REV02';
--
-- -- Estrategia Gmail recomendada: no actualizar email_threads ni email_send_attempts.
--
-- -- Estrategia Gmail alternativa, si se aprueba continuar el hilo anterior:
-- -- update public.email_threads
-- -- set entity_code = 'RQ-2026-NEXA-RCJM-P002-001', updated_at = now()
-- -- where entity_type = 'requirement'
-- --   and entity_code = 'RQ-2026-NEXA-RCJM-P001-002'
-- --   and not exists (
-- --     select 1
-- --     from public.email_threads collision
-- --     where collision.entity_type = 'requirement'
-- --       and collision.entity_code = 'RQ-2026-NEXA-RCJM-P002-001'
-- --       and collision.id <> public.email_threads.id
-- --   );
-- --
-- -- update public.email_send_attempts
-- -- set entity_code = 'RQ-2026-NEXA-RCJM-P002-001', updated_at = now()
-- -- where entity_type = 'requirement'
-- --   and entity_code = 'RQ-2026-NEXA-RCJM-P001-002'
-- --   and not exists (
-- --     select 1
-- --     from public.email_send_attempts collision
-- --     where collision.entity_type = 'requirement'
-- --       and collision.entity_code = 'RQ-2026-NEXA-RCJM-P002-001'
-- --       and collision.id <> public.email_send_attempts.id
-- --   );
--
-- -- Verificacion posterior antes de decidir rollback/commit.
-- select id, codigo, codigo_proyecto_adjudicado, cotizacion_id, cotizacion_codigo, metadata
-- from public.requerimientos
-- where id = 'a1c768de-737f-4fa5-bdcb-1e98a0ea7e63'::uuid;
--
-- select count(*) as item_count
-- from public.requerimiento_items
-- where requerimiento_id = 'a1c768de-737f-4fa5-bdcb-1e98a0ea7e63'::uuid;
--
-- select id, anio, codigo_proyecto, cotizacion, codigo_cliente, codigo_unidad, cliente, unidad_trabajo, oc, estado, activo
-- from public.proyectos_adjudicados
-- where anio = 2026
--   and codigo_proyecto = 'P002'
--   and cotizacion = 'FOR-EKA-PRO-3_2026-055_REV02';
--
-- select 'old_code_count' as check_name, count(*) as rows_found
-- from public.requerimientos
-- where codigo = 'RQ-2026-NEXA-RCJM-P001-002'
-- union all
-- select 'new_code_count' as check_name, count(*) as rows_found
-- from public.requerimientos
-- where codigo = 'RQ-2026-NEXA-RCJM-P002-001';
--
-- select 'email_threads_old_code' as check_name, count(*) as rows_found
-- from public.email_threads
-- where entity_type = 'requirement'
--   and entity_code = 'RQ-2026-NEXA-RCJM-P001-002'
-- union all
-- select 'email_threads_new_code' as check_name, count(*) as rows_found
-- from public.email_threads
-- where entity_type = 'requirement'
--   and entity_code = 'RQ-2026-NEXA-RCJM-P002-001'
-- union all
-- select 'email_send_attempts_old_code' as check_name, count(*) as rows_found
-- from public.email_send_attempts
-- where entity_type = 'requirement'
--   and entity_code = 'RQ-2026-NEXA-RCJM-P001-002'
-- union all
-- select 'email_send_attempts_new_code' as check_name, count(*) as rows_found
-- from public.email_send_attempts
-- where entity_type = 'requirement'
--   and entity_code = 'RQ-2026-NEXA-RCJM-P002-001';
--
-- rollback;
-- -- commit;
