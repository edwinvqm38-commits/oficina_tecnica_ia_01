-- 008_recursos_codigo_por_tipo.sql
-- Normaliza codigos de recursos por tipo de recurso.
-- Alcance: solo public.recursos. No toca requerimientos ni codigos RQ.

begin;

create temporary table tmp_recursos_codigo_por_tipo on commit drop as
with prefix_map(tipo_recurso_nombre, prefijo) as (
  values
    ('Materiales', 'MAT'),
    ('Equipos', 'EQP'),
    ('Herramientas', 'HER'),
    ('Mano de obra directa', 'MOD'),
    ('Mano de obra indirecta', 'MOI'),
    ('Sub contratos', 'SUB'),
    ('Subcontratos', 'SUB'),
    ('Consumibles', 'CON')
),
ranked_recursos as (
  select
    r.id,
    pm.prefijo,
    row_number() over (
      partition by pm.prefijo
      order by r.created_at nulls last, r.codigo_recurso nulls last, r.id
    ) as correlativo
  from public.recursos r
  join prefix_map pm
    on lower(trim(r.tipo_recurso_nombre)) = lower(trim(pm.tipo_recurso_nombre))
  where r.deleted_at is null
)
select
  id,
  format('%s-2026-%s', prefijo, lpad(correlativo::text, 4, '0')) as nuevo_codigo
from ranked_recursos;

-- Si un codigo objetivo ya esta ocupado por un recurso no incluido en la normalizacion,
-- se detiene para no romper la restriccion unique ni pisar datos manuales.
do $$
begin
  if exists (
    select 1
    from tmp_recursos_codigo_por_tipo t
    join public.recursos r
      on r.codigo_recurso = t.nuevo_codigo
     and r.id <> t.id
    left join tmp_recursos_codigo_por_tipo target_scope
      on target_scope.id = r.id
    where target_scope.id is null
  ) then
    raise exception 'Existen codigos objetivo ya usados por recursos fuera del alcance de normalizacion. Revisar public.recursos.codigo_recurso antes de continuar.';
  end if;
end $$;

-- Paso temporal para evitar colisiones cuando los codigos existentes se cruzan entre filas.
update public.recursos r
set
  codigo_recurso = 'TMP-RESOURCE-CODE-' || r.id::text,
  updated_at = now()
from tmp_recursos_codigo_por_tipo t
where r.id = t.id
  and r.codigo_recurso is distinct from t.nuevo_codigo;

update public.recursos r
set
  codigo_recurso = t.nuevo_codigo,
  updated_at = now()
from tmp_recursos_codigo_por_tipo t
where r.id = t.id
  and r.codigo_recurso is distinct from t.nuevo_codigo;

-- Validacion 1: recursos normalizados por prefijo aprobado.
select
  split_part(codigo_recurso, '-', 1) as prefijo,
  count(*) as total
from public.recursos
where deleted_at is null
  and codigo_recurso ~ '^(MAT|EQP|HER|MOD|MOI|SUB|CON)-2026-[0-9]{4}$'
group by split_part(codigo_recurso, '-', 1)
order by prefijo;

-- Validacion 2: tipos de recurso que no tienen prefijo aprobado y no fueron modificados.
with prefix_map(tipo_recurso_nombre, prefijo) as (
  values
    ('Materiales', 'MAT'),
    ('Equipos', 'EQP'),
    ('Herramientas', 'HER'),
    ('Mano de obra directa', 'MOD'),
    ('Mano de obra indirecta', 'MOI'),
    ('Sub contratos', 'SUB'),
    ('Subcontratos', 'SUB'),
    ('Consumibles', 'CON')
)
select
  r.tipo_recurso_nombre,
  count(*) as total
from public.recursos r
where r.deleted_at is null
  and not exists (
    select 1
    from prefix_map pm
    where lower(trim(pm.tipo_recurso_nombre)) = lower(trim(r.tipo_recurso_nombre))
  )
group by r.tipo_recurso_nombre
order by r.tipo_recurso_nombre;

commit;
