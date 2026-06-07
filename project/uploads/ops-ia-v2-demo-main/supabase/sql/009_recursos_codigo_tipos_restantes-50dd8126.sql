-- 009_recursos_codigo_tipos_restantes.sql
-- Normaliza codigos de recursos para tipos pendientes aprobados.
-- Alcance: solo public.recursos. No toca requerimientos ni codigos RQ.
-- Ejecutar despues de 008_recursos_codigo_por_tipo.sql.
-- Version corregida: no crea ni usa tablas temporales; cada bloque recalcula su alcance con CTEs.

begin;

-- Si un codigo objetivo ya esta ocupado por un recurso fuera del alcance,
-- se detiene para proteger la restriccion unique y evitar pisar datos manuales.
do $$
begin
  if exists (
    with prefix_map(tipo_recurso_nombre, prefijo) as (
      values
        ('Alimentación', 'ALI'),
        ('Antecedentes policiales', 'ANT'),
        ('Capacitaciones', 'CAP'),
        ('Cursos de inducción', 'IND'),
        ('Cursos EKA', 'CEK'),
        ('EPPs', 'EPP'),
        ('Examen médico', 'EXM'),
        ('Gastos generales', 'GGE'),
        ('Lavado de uniforme', 'LAV'),
        ('Reglamento de ingreso', 'RIN'),
        ('Transporte', 'TRA'),
        ('Vehículos', 'VEH')
    ),
    target_codes as (
      select
        r.id,
        format(
          '%s-2026-%s',
          pm.prefijo,
          lpad(
            row_number() over (
              partition by pm.prefijo
              order by r.created_at nulls last, r.id
            )::text,
            4,
            '0'
          )
        ) as nuevo_codigo
      from public.recursos r
      join prefix_map pm
        on lower(trim(r.tipo_recurso_nombre)) = lower(trim(pm.tipo_recurso_nombre))
      where r.deleted_at is null
    )
    select 1
    from target_codes t
    join public.recursos r
      on r.codigo_recurso = t.nuevo_codigo
     and r.id <> t.id
    left join target_codes target_scope
      on target_scope.id = r.id
    where target_scope.id is null
  ) then
    raise exception 'Existen codigos objetivo ya usados por recursos fuera del alcance de normalizacion. Revisar public.recursos.codigo_recurso antes de continuar.';
  end if;
end $$;

-- Paso de resguardo para evitar colisiones cuando los codigos existentes se cruzan entre filas.
with prefix_map(tipo_recurso_nombre, prefijo) as (
  values
    ('Alimentación', 'ALI'),
    ('Antecedentes policiales', 'ANT'),
    ('Capacitaciones', 'CAP'),
    ('Cursos de inducción', 'IND'),
    ('Cursos EKA', 'CEK'),
    ('EPPs', 'EPP'),
    ('Examen médico', 'EXM'),
    ('Gastos generales', 'GGE'),
    ('Lavado de uniforme', 'LAV'),
    ('Reglamento de ingreso', 'RIN'),
    ('Transporte', 'TRA'),
    ('Vehículos', 'VEH')
),
target_codes as (
  select
    r.id,
    format(
      '%s-2026-%s',
      pm.prefijo,
      lpad(
        row_number() over (
          partition by pm.prefijo
          order by r.created_at nulls last, r.id
        )::text,
        4,
        '0'
      )
    ) as nuevo_codigo
  from public.recursos r
  join prefix_map pm
    on lower(trim(r.tipo_recurso_nombre)) = lower(trim(pm.tipo_recurso_nombre))
  where r.deleted_at is null
)
update public.recursos r
set
  codigo_recurso = 'SWAP-RESOURCE-CODE-' || r.id::text,
  updated_at = now()
from target_codes t
where r.id = t.id
  and r.codigo_recurso is distinct from t.nuevo_codigo;

-- Aplicacion final del nuevo codigo normalizado.
with prefix_map(tipo_recurso_nombre, prefijo) as (
  values
    ('Alimentación', 'ALI'),
    ('Antecedentes policiales', 'ANT'),
    ('Capacitaciones', 'CAP'),
    ('Cursos de inducción', 'IND'),
    ('Cursos EKA', 'CEK'),
    ('EPPs', 'EPP'),
    ('Examen médico', 'EXM'),
    ('Gastos generales', 'GGE'),
    ('Lavado de uniforme', 'LAV'),
    ('Reglamento de ingreso', 'RIN'),
    ('Transporte', 'TRA'),
    ('Vehículos', 'VEH')
),
target_codes as (
  select
    r.id,
    format(
      '%s-2026-%s',
      pm.prefijo,
      lpad(
        row_number() over (
          partition by pm.prefijo
          order by r.created_at nulls last, r.id
        )::text,
        4,
        '0'
      )
    ) as nuevo_codigo
  from public.recursos r
  join prefix_map pm
    on lower(trim(r.tipo_recurso_nombre)) = lower(trim(pm.tipo_recurso_nombre))
  where r.deleted_at is null
)
update public.recursos r
set
  codigo_recurso = t.nuevo_codigo,
  updated_at = now()
from target_codes t
where r.id = t.id
  and r.codigo_recurso is distinct from t.nuevo_codigo;

-- Validacion 1: resumen por tipo de recurso.
select
  tipo_recurso_nombre,
  count(*) as total,
  min(codigo_recurso) as primer_codigo,
  max(codigo_recurso) as ultimo_codigo
from public.recursos
where deleted_at is null
group by tipo_recurso_nombre
order by tipo_recurso_nombre;

-- Validacion 2: deteccion de codigos duplicados.
select
  codigo_recurso,
  count(*) as total
from public.recursos
where deleted_at is null
group by codigo_recurso
having count(*) > 1
order by codigo_recurso;

-- Validacion 3: tipos que siguen con codigos REC-2026.
select
  tipo_recurso_nombre,
  count(*) as total_rec_2026
from public.recursos
where deleted_at is null
  and codigo_recurso like 'REC-2026-%'
group by tipo_recurso_nombre
order by tipo_recurso_nombre;

-- Validacion 4: tipos sin prefijo aprobado, si existieran.
with approved_prefix_map(tipo_recurso_nombre, prefijo) as (
  values
    ('Alimentación', 'ALI'),
    ('Antecedentes policiales', 'ANT'),
    ('Capacitaciones', 'CAP'),
    ('Consumibles', 'CON'),
    ('Cursos de inducción', 'IND'),
    ('Cursos EKA', 'CEK'),
    ('EPPs', 'EPP'),
    ('Equipos', 'EQP'),
    ('Examen médico', 'EXM'),
    ('Gastos generales', 'GGE'),
    ('Herramientas', 'HER'),
    ('Lavado de uniforme', 'LAV'),
    ('Mano de obra directa', 'MOD'),
    ('Mano de obra indirecta', 'MOI'),
    ('Materiales', 'MAT'),
    ('Reglamento de ingreso', 'RIN'),
    ('Sub contratos', 'SUB'),
    ('Subcontratos', 'SUB'),
    ('Transporte', 'TRA'),
    ('Vehículos', 'VEH')
)
select
  r.tipo_recurso_nombre,
  count(*) as total
from public.recursos r
where r.deleted_at is null
  and not exists (
    select 1
    from approved_prefix_map pm
    where lower(trim(pm.tipo_recurso_nombre)) = lower(trim(r.tipo_recurso_nombre))
  )
group by r.tipo_recurso_nombre
order by r.tipo_recurso_nombre;

commit;
