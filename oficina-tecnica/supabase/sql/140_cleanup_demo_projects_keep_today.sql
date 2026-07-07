-- 140_cleanup_demo_projects_keep_today.sql
-- Limpia cotizaciones/requerimientos demo y conserva lo registrado hoy.
--
-- Alcance:
-- - Conserva cotizaciones activas con created_at::date = current_date
--   o fecha_registro = current_date.
-- - Borra cotizaciones demo antiguas y sus RQ/detalles/propuestas tecnicas.
-- - No toca usuarios, permisos, recursos, conversaciones de agentes ni credenciales.
--
-- Antes de ejecutar, revisa el resultado de la seccion PREVIEW.

-- ---------------------------------------------------------------------------
-- PREVIEW: filas que se conservaran y filas demo candidatas a borrar
-- ---------------------------------------------------------------------------

select
  'cotizaciones_hoy_conservadas' as grupo,
  count(*) as total
from public.cotizaciones
where deleted_at is null
  and (created_at::date = current_date or fecha_registro = current_date);

select
  'cotizaciones_demo_a_borrar' as grupo,
  codigo,
  cliente_nombre,
  proyecto,
  fecha_registro,
  created_at
from public.cotizaciones
where deleted_at is null
  and not (created_at::date = current_date or fecha_registro = current_date)
  and (
    observaciones ilike '%demo%'
    or upper(coalesce(cliente_nombre, '')) in (
      'NEXA RESOURCES',
      'MINERA HORIZONTE',
      'PLANTA ALFA',
      'CONSTRUCTORA DELTA',
      'METALMECANICA SUR',
      'ENERGIA NORTE',
      'INGENIERIA ATLAS',
      'SERVICIOS INDUSTRIALES K2'
    )
    or proyecto in (
      'Mantenimiento eléctrico',
      'Tablero principal BT',
      'Automatización de bombeo',
      'Modernización subestación',
      'Control de motores',
      'Canalización de fuerza',
      'Upgrade sala MCC',
      'Integración de PLC'
    )
  )
order by created_at desc, codigo desc;

-- ---------------------------------------------------------------------------
-- APPLY
-- ---------------------------------------------------------------------------

begin;

create temp table cleanup_keep_cotizaciones on commit drop as
select id
from public.cotizaciones
where deleted_at is null
  and (created_at::date = current_date or fecha_registro = current_date);

do $$
begin
  if not exists (select 1 from cleanup_keep_cotizaciones) then
    raise exception
      'No se encontro ninguna cotizacion registrada hoy. Limpieza cancelada para evitar borrar informacion real.';
  end if;
end $$;

create temp table cleanup_delete_cotizaciones on commit drop as
select
  c.id,
  c.codigo
from public.cotizaciones c
where c.deleted_at is null
  and not exists (
    select 1
    from cleanup_keep_cotizaciones k
    where k.id = c.id
  )
  and (
    c.observaciones ilike '%demo%'
    or upper(coalesce(c.cliente_nombre, '')) in (
      'NEXA RESOURCES',
      'MINERA HORIZONTE',
      'PLANTA ALFA',
      'CONSTRUCTORA DELTA',
      'METALMECANICA SUR',
      'ENERGIA NORTE',
      'INGENIERIA ATLAS',
      'SERVICIOS INDUSTRIALES K2'
    )
    or c.proyecto in (
      'Mantenimiento eléctrico',
      'Tablero principal BT',
      'Automatización de bombeo',
      'Modernización subestación',
      'Control de motores',
      'Canalización de fuerza',
      'Upgrade sala MCC',
      'Integración de PLC'
    )
  );

with deleted_proposals as (
  delete from public.technical_proposals tp
  using cleanup_delete_cotizaciones d
  where tp.cotizacion_id = d.id
     or tp.cotizacion_codigo = d.codigo
  returning tp.id
),
deleted_items as (
  delete from public.requerimiento_items ri
  using public.requerimientos rq, cleanup_delete_cotizaciones d
  where ri.requerimiento_id = rq.id
    and rq.cotizacion_id = d.id
  returning ri.id
),
deleted_requirements as (
  delete from public.requerimientos rq
  using cleanup_delete_cotizaciones d
  where rq.cotizacion_id = d.id
  returning rq.id
),
deleted_quotes as (
  delete from public.cotizaciones c
  using cleanup_delete_cotizaciones d
  where c.id = d.id
  returning c.id
)
select
  (select count(*) from deleted_proposals) as propuestas_tecnicas_borradas,
  (select count(*) from deleted_items) as items_rq_borrados,
  (select count(*) from deleted_requirements) as requerimientos_borrados,
  (select count(*) from deleted_quotes) as cotizaciones_borradas;

commit;

-- Verificacion final.
select
  codigo,
  cliente_nombre,
  proyecto,
  fecha_registro,
  created_at
from public.cotizaciones
where deleted_at is null
order by created_at desc, codigo desc;
