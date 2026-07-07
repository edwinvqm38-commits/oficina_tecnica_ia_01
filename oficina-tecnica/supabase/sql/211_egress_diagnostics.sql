-- 211_egress_diagnostics.sql
-- Diagnosticos para ubicar fuentes probables de PostgREST egress.
-- Solo lectura: no modifica datos.

-- 1) Tamano de workspace_state. Debe estar en KB, no en MB.
select
  id,
  pg_size_pretty(pg_column_size(state)::bigint) as state_size,
  jsonb_array_length(coalesce(state #> '{chats,roundtable}', '[]'::jsonb)) as roundtable_messages,
  updated_at
from public.workspace_state
order by pg_column_size(state) desc;

-- 2) Filas publicas mas pesadas por columnas jsonb comunes.
select *
from (
  select 'workspace_state' as table_name, id::text as row_id, pg_column_size(state)::bigint as bytes
  from public.workspace_state
  union all
  select 'cotizaciones', id::text, pg_column_size(metadata)::bigint
  from public.cotizaciones
  where metadata is not null
  union all
  select 'requerimientos', id::text, pg_column_size(metadata)::bigint
  from public.requerimientos
  where metadata is not null
  union all
  select 'requerimiento_items', id::text, pg_column_size(metadata)::bigint
  from public.requerimiento_items
  where metadata is not null
  union all
  select 'recursos', id::text, pg_column_size(metadata)::bigint
  from public.recursos
  where metadata is not null
) s
order by bytes desc
limit 30;

-- 3) Tamano aproximado de tablas principales.
select
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  n_live_tup as approx_rows
from pg_catalog.pg_stat_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc;
