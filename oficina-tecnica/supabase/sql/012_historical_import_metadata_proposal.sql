-- 012_historical_import_metadata_proposal.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Este archivo documenta una posible base tecnica para soportar
-- importacion historica observada con trazabilidad y calidad de datos.
-- NO ejecutar sin validar antes el esquema real desplegado en Supabase.
-- NO inserta, actualiza ni elimina datos reales.
--
-- Verificacion de esquema:
-- public.cotizaciones, public.requerimientos y public.requerimiento_items
-- ya cuentan con metadata jsonb.
-- Por ello, este SQL no agrega metadata a tablas principales.
-- La calidad de datos historica se almacenara en metadata->'historical_import'.

begin;

-- 1. Propuesta: tabla de lotes de importacion historica.
-- Permite registrar origen, volumen del lote y resumen de calidad.
create extension if not exists pgcrypto;

create table if not exists public.historical_import_batches (
  id uuid primary key default gen_random_uuid(),
  import_batch_id text not null unique,
  source_file_name text,
  source_file_path text,
  status text not null default 'prepared',
  total_cotizaciones integer not null default 0,
  total_requerimientos integer not null default 0,
  total_detalle_rq integer not null default 0,
  total_ok integer not null default 0,
  total_observado integer not null default 0,
  total_completar_datos integer not null default 0,
  total_critico_revisar integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  constraint historical_import_batches_status_not_blank check (length(trim(status)) > 0),
  constraint historical_import_batches_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists historical_import_batches_status_idx
  on public.historical_import_batches (status);

create index if not exists historical_import_batches_created_at_idx
  on public.historical_import_batches (created_at desc);

-- 2. Propuesta: tabla de issues por lote y entidad.
-- Sirve para trazabilidad de limpieza y revision humana posterior.
create table if not exists public.historical_import_issues (
  id uuid primary key default gen_random_uuid(),
  import_batch_id text not null,
  entity_type text not null,
  entity_key text,
  issue_type text not null,
  severity text not null,
  message text,
  source_row_number integer,
  field_name text,
  raw_value text,
  suggested_action text,
  resolved boolean not null default false,
  resolved_at timestamptz null,
  resolved_by uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint historical_import_issues_import_batch_id_not_blank check (length(trim(import_batch_id)) > 0),
  constraint historical_import_issues_entity_type_not_blank check (length(trim(entity_type)) > 0),
  constraint historical_import_issues_issue_type_not_blank check (length(trim(issue_type)) > 0),
  constraint historical_import_issues_severity_not_blank check (length(trim(severity)) > 0),
  constraint historical_import_issues_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists historical_import_issues_batch_idx
  on public.historical_import_issues (import_batch_id);

create index if not exists historical_import_issues_entity_idx
  on public.historical_import_issues (entity_type, entity_key);

create index if not exists historical_import_issues_severity_idx
  on public.historical_import_issues (severity);

create index if not exists historical_import_issues_resolved_idx
  on public.historical_import_issues (resolved);

-- 3. Propuesta: trigger de updated_at para historical_import_batches.
create or replace function public.set_historical_import_batches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_historical_import_batches_updated_at on public.historical_import_batches;

create trigger set_historical_import_batches_updated_at
before update on public.historical_import_batches
for each row
execute function public.set_historical_import_batches_updated_at();

-- 4. Comentario operativo.
-- Esta propuesta no habilita importacion real por si sola.
-- Aun falta validar:
-- - politicas RLS
-- - estrategia de carga observada y rollback logico

commit;
