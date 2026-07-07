-- 100_clean_start_schema.sql
-- Oficina Tecnica IA / SGP Lite - clean Supabase start.
--
-- Objetivo:
-- - Crear una base nueva, normalizada y compatible con el codigo actual.
-- - Evitar lecturas masivas innecesarias: indices para filtros, vistas resumen
--   y RPCs paginadas para pantallas grandes.
-- - Mantener RLS activado. Ajustar politicas si se agregan organizaciones.
--
-- Ejecutar primero en una cuenta/proyecto Supabase nuevo.
-- Luego cargar datos con scripts de export/import.

begin;

create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- 0. Tipos comunes
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.app_role as enum ('admin', 'gerencia', 'responsable', 'consulta');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.user_status as enum ('approved', 'pending', 'rejected', 'disabled', 'blocked');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Usuarios y permisos
-- ---------------------------------------------------------------------------

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role public.app_role not null default 'consulta',
  status public.user_status not null default 'pending',
  is_super_admin boolean not null default false,
  approved_by text,
  approved_at timestamptz,
  rejected_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_email_lower_unique unique (email),
  constraint user_profiles_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists user_profiles_status_idx on public.user_profiles(status);
create index if not exists user_profiles_email_idx on public.user_profiles(lower(email));

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create table if not exists public.admin_module_permissions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  module_key text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_change_status boolean not null default false,
  can_upload_files boolean not null default false,
  can_view_prices boolean not null default false,
  can_view_supplier boolean not null default false,
  visible_columns jsonb not null default '[]'::jsonb,
  editable_fields jsonb not null default '[]'::jsonb,
  required_fields jsonb not null default '[]'::jsonb,
  enabled_buttons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_module_permissions_user_module_unique unique (user_email, module_key),
  constraint admin_module_permissions_user_email_not_blank check (length(trim(user_email)) > 0),
  constraint admin_module_permissions_module_key_not_blank check (length(trim(module_key)) > 0),
  constraint admin_module_permissions_visible_columns_array check (jsonb_typeof(visible_columns) = 'array'),
  constraint admin_module_permissions_editable_fields_array check (jsonb_typeof(editable_fields) = 'array'),
  constraint admin_module_permissions_required_fields_array check (jsonb_typeof(required_fields) = 'array'),
  constraint admin_module_permissions_enabled_buttons_array check (jsonb_typeof(enabled_buttons) = 'array'),
  constraint admin_module_permissions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists admin_module_permissions_user_email_idx on public.admin_module_permissions(lower(user_email));
create index if not exists admin_module_permissions_module_key_idx on public.admin_module_permissions(module_key);

drop trigger if exists set_admin_module_permissions_updated_at on public.admin_module_permissions;
create trigger set_admin_module_permissions_updated_at
before update on public.admin_module_permissions
for each row execute function public.set_updated_at();

create table if not exists public.app_catalog_items (
  catalog_key text not null,
  item_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  primary key (catalog_key, item_id),
  constraint app_catalog_items_catalog_key_not_blank check (length(trim(catalog_key)) > 0),
  constraint app_catalog_items_item_id_not_blank check (length(trim(item_id)) > 0),
  constraint app_catalog_items_payload_object check (jsonb_typeof(payload) = 'object')
);

create index if not exists app_catalog_items_catalog_key_idx on public.app_catalog_items(catalog_key);
create index if not exists app_catalog_items_payload_activo_idx on public.app_catalog_items((payload ->> 'activo'));

drop trigger if exists set_app_catalog_items_updated_at on public.app_catalog_items;
create trigger set_app_catalog_items_updated_at
before update on public.app_catalog_items
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    status,
    is_super_admin,
    approved_by,
    approved_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case when lower(coalesce(new.email, '')) = 'edwin.qm@outlook.com' then 'admin'::public.app_role else 'consulta'::public.app_role end,
    case when lower(coalesce(new.email, '')) = 'edwin.qm@outlook.com' then 'approved'::public.user_status else 'pending'::public.user_status end,
    lower(coalesce(new.email, '')) = 'edwin.qm@outlook.com',
    case when lower(coalesce(new.email, '')) = 'edwin.qm@outlook.com' then new.id::text else null end,
    case when lower(coalesce(new.email, '')) = 'edwin.qm@outlook.com' then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Catalogo de recursos
-- ---------------------------------------------------------------------------

create table if not exists public.recursos (
  id uuid primary key default gen_random_uuid(),
  codigo_recurso text not null unique,
  codigo_eka text,
  codigo_fabricante text,
  tipo_recurso_id uuid,
  tipo_recurso_nombre text,
  descripcion text not null,
  unidad_id uuid,
  unidad_codigo text,
  precio_unitario_ref numeric not null default 0,
  moneda_codigo text not null default 'PEN' check (moneda_codigo in ('PEN', 'USD')),
  proveedor_id uuid,
  proveedor_nombre text,
  marca_id uuid,
  marca_nombre text,
  modelo text,
  tiempo_entrega_ref text,
  estado text not null default 'Activo' check (estado in ('Activo', 'Inactivo', 'Por revisar')),
  fecha_actualizacion date,
  observaciones text,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recursos_codigo_not_blank check (length(trim(codigo_recurso)) > 0),
  constraint recursos_descripcion_not_blank check (length(trim(descripcion)) > 0),
  constraint recursos_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists recursos_not_deleted_codigo_idx on public.recursos(codigo_recurso) where deleted_at is null;
create index if not exists recursos_tipo_idx on public.recursos(tipo_recurso_nombre) where deleted_at is null;
create index if not exists recursos_estado_idx on public.recursos(estado) where deleted_at is null;
create index if not exists recursos_moneda_idx on public.recursos(moneda_codigo) where deleted_at is null;
create index if not exists recursos_proveedor_idx on public.recursos(proveedor_nombre) where deleted_at is null;
create index if not exists recursos_marca_idx on public.recursos(marca_nombre) where deleted_at is null;
create index if not exists recursos_search_trgm_idx on public.recursos using gin (
  (
    lower(coalesce(codigo_recurso,'') || ' ' ||
          coalesce(codigo_eka,'') || ' ' ||
          coalesce(codigo_fabricante,'') || ' ' ||
          coalesce(descripcion,'') || ' ' ||
          coalesce(proveedor_nombre,'') || ' ' ||
          coalesce(marca_nombre,'') || ' ' ||
          coalesce(modelo,''))
  ) gin_trgm_ops
) where deleted_at is null;

drop trigger if exists set_recursos_updated_at on public.recursos;
create trigger set_recursos_updated_at
before update on public.recursos
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Cotizaciones
-- ---------------------------------------------------------------------------

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  oc text,
  cliente_id uuid,
  cliente_nombre text,
  proyecto text not null,
  unidad_trabajo_id uuid,
  unidad_trabajo_nombre text,
  moneda_codigo text not null default 'PEN' check (moneda_codigo in ('PEN', 'USD')),
  estado text not null default 'Borrador',
  estado_propuesta text,
  solicitante text,
  responsable_tecnico text,
  responsable_economico text,
  fecha_registro date,
  fecha_presentacion date,
  fecha_invitacion date,
  fecha_confirmacion date,
  fecha_visita_tecnica date,
  fecha_consultas date,
  fecha_abs_consultas date,
  fecha_entrega date,
  fecha_entregada date,
  fecha_oc date,
  tipo_servicio_id uuid,
  tipo_servicio_nombre text,
  prioridad text default 'Media' check (prioridad in ('Alta', 'Media', 'Baja')),
  avance numeric not null default 0 check (avance >= 0 and avance <= 100),
  observaciones text,
  monto numeric not null default 0,
  flat_mensual boolean not null default false,
  fecha_inicio_analisis date,
  fecha_fin_analisis date,
  meses_analisis integer,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  constraint cotizaciones_codigo_not_blank check (length(trim(codigo)) > 0),
  constraint cotizaciones_proyecto_not_blank check (length(trim(proyecto)) > 0),
  constraint cotizaciones_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists cotizaciones_not_deleted_codigo_idx on public.cotizaciones(codigo) where deleted_at is null;
create index if not exists cotizaciones_estado_idx on public.cotizaciones(estado) where deleted_at is null;
create index if not exists cotizaciones_cliente_idx on public.cotizaciones(cliente_nombre) where deleted_at is null;
create index if not exists cotizaciones_responsable_idx on public.cotizaciones(responsable_tecnico) where deleted_at is null;
create index if not exists cotizaciones_fecha_registro_idx on public.cotizaciones(fecha_registro desc) where deleted_at is null;
create index if not exists cotizaciones_search_trgm_idx on public.cotizaciones using gin (
  (
    lower(coalesce(codigo,'') || ' ' ||
          coalesce(oc,'') || ' ' ||
          coalesce(cliente_nombre,'') || ' ' ||
          coalesce(proyecto,'') || ' ' ||
          coalesce(responsable_tecnico,''))
  ) gin_trgm_ops
) where deleted_at is null;

drop trigger if exists set_cotizaciones_updated_at on public.cotizaciones;
create trigger set_cotizaciones_updated_at
before update on public.cotizaciones
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Requerimientos y detalle
-- ---------------------------------------------------------------------------

create table if not exists public.requerimientos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  cotizacion_id uuid not null references public.cotizaciones(id) on delete restrict,
  cotizacion_codigo text,
  codigo_cliente text,
  codigo_unidad text,
  codigo_proyecto_adjudicado text,
  proyecto_servicio text,
  oc text,
  anio integer,
  solicitante_rq text,
  tipo_servicio_nombre text,
  area_nombre text,
  estado text not null default 'Pendiente',
  fecha_solicitud date,
  fecha_requerida date,
  responsable text,
  avance numeric not null default 0 check (avance >= 0 and avance <= 100),
  total_rq numeric not null default 0,
  observaciones text,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requerimientos_codigo_not_blank check (length(trim(codigo)) > 0),
  constraint requerimientos_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists requerimientos_cotizacion_id_idx on public.requerimientos(cotizacion_id) where deleted_at is null;
create index if not exists requerimientos_codigo_idx on public.requerimientos(codigo) where deleted_at is null;
create index if not exists requerimientos_estado_idx on public.requerimientos(estado) where deleted_at is null;
create index if not exists requerimientos_responsable_idx on public.requerimientos(responsable) where deleted_at is null;
create index if not exists requerimientos_fecha_requerida_idx on public.requerimientos(fecha_requerida) where deleted_at is null;
create index if not exists requerimientos_search_trgm_idx on public.requerimientos using gin (
  (
    lower(coalesce(codigo,'') || ' ' ||
          coalesce(cotizacion_codigo,'') || ' ' ||
          coalesce(proyecto_servicio,'') || ' ' ||
          coalesce(responsable,'') || ' ' ||
          coalesce(solicitante_rq,''))
  ) gin_trgm_ops
) where deleted_at is null;

drop trigger if exists set_requerimientos_updated_at on public.requerimientos;
create trigger set_requerimientos_updated_at
before update on public.requerimientos
for each row execute function public.set_updated_at();

create table if not exists public.requerimiento_items (
  id uuid primary key default gen_random_uuid(),
  requerimiento_id uuid not null references public.requerimientos(id) on delete cascade,
  recurso_id uuid references public.recursos(id) on delete set null,
  cantidad numeric not null default 0,
  precio_unitario numeric not null default 0,
  subtotal numeric not null default 0,
  ajuste numeric not null default 0,
  atencion_real numeric not null default 0,
  cant_stock numeric not null default 0,
  compra numeric not null default 0,
  costo_unitario numeric not null default 0,
  moneda_codigo text not null default 'PEN' check (moneda_codigo in ('PEN', 'USD')),
  tc numeric not null default 1,
  factor_eq_herr numeric not null default 1,
  costo_total_presupuestado numeric not null default 0,
  fecha_coti date,
  estado text not null default 'Pendiente',
  informacion_adicional text,
  observaciones_item text,
  recurso_a_suministrar text,
  proveedor_id uuid,
  proveedor_nombre text,
  condicion_pago text,
  tiempo_entrega text,
  eq text default 'Pendiente',
  eq_fecha_aprob date,
  ll text default 'Pendiente',
  ll_fecha_aprob date,
  hb text default 'Pendiente',
  hb_fecha_aprob date,
  logistica_compra text default 'Pendiente compra',
  fecha_compra date,
  oc_os_recurso text,
  fecha_entrega date,
  guia_remision text,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requerimiento_items_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists requerimiento_items_rq_idx on public.requerimiento_items(requerimiento_id) where deleted_at is null;
create index if not exists requerimiento_items_recurso_idx on public.requerimiento_items(recurso_id) where deleted_at is null;
create index if not exists requerimiento_items_estado_idx on public.requerimiento_items(estado) where deleted_at is null;
create index if not exists requerimiento_items_proveedor_idx on public.requerimiento_items(proveedor_nombre) where deleted_at is null;
create index if not exists requerimiento_items_search_trgm_idx on public.requerimiento_items using gin (
  (
    lower(coalesce(recurso_a_suministrar,'') || ' ' ||
          coalesce(proveedor_nombre,'') || ' ' ||
          coalesce(observaciones_item,'') || ' ' ||
          coalesce(oc_os_recurso,''))
  ) gin_trgm_ops
) where deleted_at is null;

drop trigger if exists set_requerimiento_items_updated_at on public.requerimiento_items;
create trigger set_requerimiento_items_updated_at
before update on public.requerimiento_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Propuesta tecnica y logos
-- ---------------------------------------------------------------------------

create table if not exists public.entity_logos (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('company', 'client', 'supplier', 'unit')),
  entity_key text not null,
  display_name text not null,
  logo_url text,
  storage_path text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint entity_logos_unique_active unique (entity_type, entity_key),
  constraint entity_logos_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.technical_proposals (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references public.cotizaciones(id) on delete set null,
  cotizacion_codigo text not null,
  code text not null unique,
  document_type text not null default 'PT' check (document_type = 'PT'),
  revision text not null default 'REV00',
  revision_folder text not null default '02_PROPUESTA',
  status text not null default 'Borrador' check (status in ('Borrador', 'En revision', 'Aprobada', 'Archivada')),
  mode text not null default 'cliente' check (mode in ('cliente', 'interno')),
  work_status text not null default 'Borrador' check (work_status in ('Borrador', 'En proceso', 'Completado')),
  document_date date,
  company_logo_id uuid references public.entity_logos(id),
  client_logo_id uuid references public.entity_logos(id),
  header jsonb not null default '{}'::jsonb,
  recipient jsonb not null default '{}'::jsonb,
  presentation jsonb not null default '{}'::jsonb,
  commercial_terms jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint technical_proposals_unique_revision unique (cotizacion_id, revision)
);

create table if not exists public.technical_proposal_items (
  id uuid primary key default gen_random_uuid(),
  technical_proposal_id uuid not null references public.technical_proposals(id) on delete cascade,
  parent_id uuid references public.technical_proposal_items(id) on delete cascade,
  item_type text not null check (item_type in ('group', 'subgroup', 'activity')),
  item_number text not null,
  level integer not null default 0 check (level >= 0),
  sort_order integer not null default 0,
  title text not null,
  technical_description text,
  estimated_time_value numeric,
  estimated_time_unit text,
  is_complete boolean not null default false,
  internal_comments text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technical_proposal_items_unique_number unique (technical_proposal_id, item_number)
);

create table if not exists public.technical_proposal_resources (
  id uuid primary key default gen_random_uuid(),
  technical_proposal_id uuid not null references public.technical_proposals(id) on delete cascade,
  technical_proposal_item_id uuid not null references public.technical_proposal_items(id) on delete cascade,
  resource_id uuid references public.recursos(id) on delete set null,
  resource_category text not null,
  codigo_recurso text,
  codigo_fabricante text,
  tipo_recurso text,
  descripcion text not null,
  unidad text,
  cantidad numeric not null default 1,
  tiempo numeric,
  precio_unitario_ref numeric,
  moneda_codigo text,
  proveedor text,
  marca text,
  comentario text,
  detalle_adicional text,
  origin_status text not null default 'nuevo_por_formalizar',
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_proposal_files (
  id uuid primary key default gen_random_uuid(),
  technical_proposal_id uuid not null references public.technical_proposals(id) on delete cascade,
  technical_proposal_item_id uuid references public.technical_proposal_items(id) on delete set null,
  resource_snapshot_id uuid references public.technical_proposal_resources(id) on delete set null,
  file_type text not null,
  title text,
  relation_label text,
  storage_path text,
  public_url text,
  mime_type text,
  file_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.technical_proposal_events (
  id uuid primary key default gen_random_uuid(),
  technical_proposal_id uuid not null references public.technical_proposals(id) on delete cascade,
  event_type text not null,
  event_message text,
  old_status text,
  new_status text,
  actor_id uuid references auth.users(id),
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists technical_proposals_cotizacion_idx on public.technical_proposals(cotizacion_id);
create index if not exists technical_proposal_items_proposal_sort_idx on public.technical_proposal_items(technical_proposal_id, sort_order);
create index if not exists technical_proposal_resources_proposal_idx on public.technical_proposal_resources(technical_proposal_id);
create index if not exists technical_proposal_resources_item_idx on public.technical_proposal_resources(technical_proposal_item_id);
create index if not exists technical_proposal_files_proposal_idx on public.technical_proposal_files(technical_proposal_id);
create index if not exists technical_proposal_events_proposal_idx on public.technical_proposal_events(technical_proposal_id);

drop trigger if exists set_entity_logos_updated_at on public.entity_logos;
create trigger set_entity_logos_updated_at before update on public.entity_logos for each row execute function public.set_updated_at();
drop trigger if exists set_technical_proposals_updated_at on public.technical_proposals;
create trigger set_technical_proposals_updated_at before update on public.technical_proposals for each row execute function public.set_updated_at();
drop trigger if exists set_technical_proposal_items_updated_at on public.technical_proposal_items;
create trigger set_technical_proposal_items_updated_at before update on public.technical_proposal_items for each row execute function public.set_updated_at();
drop trigger if exists set_technical_proposal_resources_updated_at on public.technical_proposal_resources;
create trigger set_technical_proposal_resources_updated_at before update on public.technical_proposal_resources for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. App state, agentes, importacion historica, credenciales
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  agent_id text not null,
  project_id text,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model_used text,
  complexity text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  project_id text,
  memory_type text not null check (memory_type in ('decision', 'learning', 'context')),
  content text not null,
  importance integer not null default 1 check (importance between 1 and 5),
  created_at timestamptz not null default now()
);

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
  created_by uuid,
  updated_by uuid
);

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
  resolved_at timestamptz,
  resolved_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  provider text not null check (provider in ('anthropic', 'openai', 'google')),
  ciphertext text not null,
  base_url text,
  default_model text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index if not exists agent_conversations_user_agent_idx on public.agent_conversations(user_id, agent_id, created_at desc);
create index if not exists agent_conversations_project_idx on public.agent_conversations(project_id, agent_id) where project_id is not null;
create index if not exists agent_conversations_created_at_idx on public.agent_conversations(created_at desc);
create index if not exists agent_memories_agent_idx on public.agent_memories(agent_id, importance desc, created_at desc);
create index if not exists agent_memories_created_at_idx on public.agent_memories(created_at desc);
create index if not exists historical_import_issues_batch_idx on public.historical_import_issues(import_batch_id);

create or replace function public.purge_old_agent_memory(p_days integer default 5)
returns table (
  deleted_conversations integer,
  deleted_memories integer
)
language plpgsql
security invoker
as $$
declare
  v_cutoff timestamptz;
  v_conversations integer;
  v_memories integer;
begin
  v_cutoff := now() - make_interval(days => greatest(1, coalesce(p_days, 5)));

  delete from public.agent_conversations
  where created_at < v_cutoff;
  get diagnostics v_conversations = row_count;

  delete from public.agent_memories
  where created_at < v_cutoff;
  get diagnostics v_memories = row_count;

  return query select v_conversations, v_memories;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Vistas ligeras y RPCs paginadas para reducir lecturas
-- ---------------------------------------------------------------------------

create or replace view public.v_cotizaciones_list
with (security_invoker = true)
as
select
  id,
  codigo,
  oc,
  cliente_nombre,
  proyecto,
  unidad_trabajo_nombre,
  moneda_codigo,
  estado,
  estado_propuesta,
  solicitante,
  responsable_tecnico,
  responsable_economico,
  fecha_registro,
  fecha_presentacion,
  fecha_entrega,
  fecha_oc,
  tipo_servicio_nombre,
  prioridad,
  avance,
  monto,
  flat_mensual,
  created_at,
  updated_at
from public.cotizaciones
where deleted_at is null;

create or replace view public.v_requerimientos_list
with (security_invoker = true)
as
select
  id,
  codigo,
  cotizacion_id,
  cotizacion_codigo,
  codigo_cliente,
  codigo_unidad,
  proyecto_servicio,
  oc,
  anio,
  solicitante_rq,
  tipo_servicio_nombre,
  area_nombre,
  estado,
  fecha_solicitud,
  fecha_requerida,
  responsable,
  avance,
  total_rq,
  created_at,
  updated_at
from public.requerimientos
where deleted_at is null;

create or replace function public.search_cotizaciones_page(
  p_search text default null,
  p_estado text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  total_count bigint,
  id uuid,
  codigo text,
  oc text,
  cliente_nombre text,
  proyecto text,
  unidad_trabajo_nombre text,
  moneda_codigo text,
  estado text,
  estado_propuesta text,
  responsable_tecnico text,
  fecha_entrega date,
  monto numeric,
  avance numeric
)
language sql
stable
as $$
  with filtered as (
    select *
    from public.v_cotizaciones_list v
    where (p_estado is null or p_estado = '' or v.estado = p_estado)
      and (
        p_search is null or p_search = ''
        or unaccent(coalesce(v.codigo,'') || ' ' || coalesce(v.oc,'') || ' ' || coalesce(v.cliente_nombre,'') || ' ' || coalesce(v.proyecto,'')) ilike '%' || unaccent(p_search) || '%'
      )
  )
  select
    count(*) over() as total_count,
    f.id,
    f.codigo,
    f.oc,
    f.cliente_nombre,
    f.proyecto,
    f.unidad_trabajo_nombre,
    f.moneda_codigo,
    f.estado,
    f.estado_propuesta,
    f.responsable_tecnico,
    f.fecha_entrega,
    f.monto,
    f.avance
  from filtered f
  order by f.codigo desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.search_recursos_page(
  p_search text default null,
  p_tipo text default null,
  p_estado text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  total_count bigint,
  id uuid,
  codigo_recurso text,
  codigo_eka text,
  codigo_fabricante text,
  tipo_recurso_nombre text,
  descripcion text,
  unidad_codigo text,
  precio_unitario_ref numeric,
  moneda_codigo text,
  proveedor_nombre text,
  marca_nombre text,
  modelo text,
  estado text,
  fecha_actualizacion date
)
language sql
stable
as $$
  with filtered as (
    select *
    from public.recursos r
    where r.deleted_at is null
      and (p_tipo is null or p_tipo = '' or r.tipo_recurso_nombre = p_tipo)
      and (p_estado is null or p_estado = '' or r.estado = p_estado)
      and (
        p_search is null or p_search = ''
        or unaccent(coalesce(r.codigo_recurso,'') || ' ' || coalesce(r.codigo_eka,'') || ' ' || coalesce(r.codigo_fabricante,'') || ' ' || coalesce(r.descripcion,'') || ' ' || coalesce(r.proveedor_nombre,'')) ilike '%' || unaccent(p_search) || '%'
      )
  )
  select
    count(*) over() as total_count,
    f.id,
    f.codigo_recurso,
    f.codigo_eka,
    f.codigo_fabricante,
    f.tipo_recurso_nombre,
    f.descripcion,
    f.unidad_codigo,
    f.precio_unitario_ref,
    f.moneda_codigo,
    f.proveedor_nombre,
    f.marca_nombre,
    f.modelo,
    f.estado,
    f.fecha_actualizacion
  from filtered f
  order by f.codigo_recurso asc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.get_recursos_filter_options()
returns table (
  tipos text[],
  estados text[],
  monedas text[],
  proveedores text[],
  marcas text[]
)
language sql
stable
security invoker
as $$
  select
    coalesce(array_agg(distinct tipo_recurso_nombre order by tipo_recurso_nombre) filter (where tipo_recurso_nombre is not null and btrim(tipo_recurso_nombre) <> ''), '{}'::text[]) as tipos,
    coalesce(array_agg(distinct estado order by estado) filter (where estado is not null and btrim(estado) <> ''), '{}'::text[]) as estados,
    coalesce(array_agg(distinct moneda_codigo order by moneda_codigo) filter (where moneda_codigo is not null and btrim(moneda_codigo) <> ''), '{}'::text[]) as monedas,
    coalesce(array_agg(distinct proveedor_nombre order by proveedor_nombre) filter (where proveedor_nombre is not null and btrim(proveedor_nombre) <> ''), '{}'::text[]) as proveedores,
    coalesce(array_agg(distinct marca_nombre order by marca_nombre) filter (where marca_nombre is not null and btrim(marca_nombre) <> ''), '{}'::text[]) as marcas
  from public.recursos
  where deleted_at is null;
$$;

create or replace function public.search_requerimientos_page(
  p_search text default null,
  p_estado text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  total_count bigint,
  id uuid,
  codigo text,
  cotizacion_id uuid,
  cotizacion_codigo text,
  proyecto_servicio text,
  oc text,
  solicitante_rq text,
  tipo_servicio_nombre text,
  area_nombre text,
  estado text,
  fecha_solicitud date,
  fecha_requerida date,
  responsable text,
  avance numeric,
  total_rq numeric
)
language sql
stable
as $$
  with filtered as (
    select *
    from public.v_requerimientos_list v
    where (p_estado is null or p_estado = '' or v.estado = p_estado)
      and (
        p_search is null or p_search = ''
        or unaccent(coalesce(v.codigo,'') || ' ' || coalesce(v.cotizacion_codigo,'') || ' ' || coalesce(v.proyecto_servicio,'') || ' ' || coalesce(v.responsable,'') || ' ' || coalesce(v.solicitante_rq,'')) ilike '%' || unaccent(p_search) || '%'
      )
  )
  select
    count(*) over() as total_count,
    f.id,
    f.codigo,
    f.cotizacion_id,
    f.cotizacion_codigo,
    f.proyecto_servicio,
    f.oc,
    f.solicitante_rq,
    f.tipo_servicio_nombre,
    f.area_nombre,
    f.estado,
    f.fecha_solicitud,
    f.fecha_requerida,
    f.responsable,
    f.avance,
    f.total_rq
  from filtered f
  order by f.codigo desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- ---------------------------------------------------------------------------
-- 8. RLS, grants y politicas iniciales
-- ---------------------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.admin_module_permissions enable row level security;
alter table public.app_catalog_items enable row level security;
alter table public.recursos enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.requerimientos enable row level security;
alter table public.requerimiento_items enable row level security;
alter table public.entity_logos enable row level security;
alter table public.technical_proposals enable row level security;
alter table public.technical_proposal_items enable row level security;
alter table public.technical_proposal_resources enable row level security;
alter table public.technical_proposal_files enable row level security;
alter table public.technical_proposal_events enable row level security;
alter table public.workspace_state enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_memories enable row level security;
alter table public.historical_import_batches enable row level security;
alter table public.historical_import_issues enable row level security;
alter table public.provider_credentials enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update on public.admin_module_permissions to authenticated;
grant select, insert, update, delete on public.app_catalog_items to authenticated;
grant select, insert, update on public.recursos to authenticated;
grant select, insert, update on public.cotizaciones to authenticated;
grant select, insert, update on public.requerimientos to authenticated;
grant select, insert, update on public.requerimiento_items to authenticated;
grant select, insert, update on public.entity_logos to authenticated;
grant select, insert, update on public.technical_proposals to authenticated;
grant select, insert, update on public.technical_proposal_items to authenticated;
grant select, insert, update on public.technical_proposal_resources to authenticated;
grant select, insert on public.technical_proposal_files to authenticated;
grant select, insert on public.technical_proposal_events to authenticated;
grant select, insert, update on public.workspace_state to authenticated;
grant select, insert, update, delete on public.agent_conversations to authenticated;
grant select, insert on public.agent_memories to authenticated;
grant delete on public.agent_memories to authenticated;
grant select, insert, update on public.historical_import_batches to authenticated;
grant select, insert, update on public.historical_import_issues to authenticated;
grant select on public.v_cotizaciones_list to authenticated;
grant select on public.v_requerimientos_list to authenticated;
grant execute on function public.search_cotizaciones_page(text, text, integer, integer) to authenticated;
grant execute on function public.search_recursos_page(text, text, text, integer, integer) to authenticated;
grant execute on function public.get_recursos_filter_options() to authenticated;
grant execute on function public.search_requerimientos_page(text, text, integer, integer) to authenticated;
grant execute on function public.purge_old_agent_memory(integer) to authenticated;

create or replace function public.is_approved_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = (select auth.uid())
      and up.status = 'approved'
  );
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = (select auth.uid())
      and up.status = 'approved'
      and (up.is_super_admin is true or up.role in ('admin', 'gerencia'))
  );
$$;

create or replace function public.can_use_module(p_module text, p_action text default 'view')
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and lower(amp.module_key) = lower(p_module)
    where up.id = (select auth.uid())
      and up.status = 'approved'
      and (
        up.is_super_admin is true
        or up.role in ('admin', 'gerencia')
        or (
          case lower(coalesce(p_action, 'view'))
            when 'create' then amp.can_create
            when 'edit' then amp.can_edit
            when 'upload' then amp.can_upload_files
            when 'status' then amp.can_change_status
            else amp.can_view
          end
        ) is true
      )
  );
$$;

grant execute on function public.is_approved_user() to authenticated;
grant execute on function public.is_admin_user() to authenticated;
grant execute on function public.can_use_module(text, text) to authenticated;

-- Politicas simples, basadas en permisos por modulo.
drop policy if exists user_profiles_select_own_or_admin on public.user_profiles;
create policy user_profiles_select_own_or_admin on public.user_profiles
for select to authenticated
using (id = (select auth.uid()) or public.is_admin_user());

drop policy if exists user_profiles_update_admin on public.user_profiles;
create policy user_profiles_update_admin on public.user_profiles
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists admin_module_permissions_select on public.admin_module_permissions;
create policy admin_module_permissions_select on public.admin_module_permissions
for select to authenticated
using (lower(user_email) = lower(coalesce((select auth.jwt()) ->> 'email', '')) or public.is_admin_user());

drop policy if exists admin_module_permissions_write_admin on public.admin_module_permissions;
create policy admin_module_permissions_write_admin on public.admin_module_permissions
for all to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists app_catalog_items_select_datos on public.app_catalog_items;
create policy app_catalog_items_select_datos on public.app_catalog_items
for select to authenticated
using (
  public.can_use_module('datos', 'view')
  or public.can_use_module('cotizaciones', 'view')
  or public.can_use_module('requerimientos', 'view')
  or public.can_use_module('recursos', 'view')
);

drop policy if exists app_catalog_items_insert_datos on public.app_catalog_items;
create policy app_catalog_items_insert_datos on public.app_catalog_items
for insert to authenticated
with check (public.can_use_module('datos', 'create') or public.can_use_module('datos', 'edit'));

drop policy if exists app_catalog_items_update_datos on public.app_catalog_items;
create policy app_catalog_items_update_datos on public.app_catalog_items
for update to authenticated
using (public.can_use_module('datos', 'edit'))
with check (public.can_use_module('datos', 'edit'));

drop policy if exists app_catalog_items_delete_datos on public.app_catalog_items;
create policy app_catalog_items_delete_datos on public.app_catalog_items
for delete to authenticated
using (public.can_use_module('datos', 'edit'));

drop policy if exists recursos_select_by_permission on public.recursos;
create policy recursos_select_by_permission on public.recursos
for select to authenticated
using (public.can_use_module('recursos', 'view'));

drop policy if exists recursos_write_by_permission on public.recursos;
create policy recursos_write_by_permission on public.recursos
for all to authenticated
using (public.can_use_module('recursos', 'edit'))
with check (public.can_use_module('recursos', 'edit') or public.can_use_module('recursos', 'create'));

drop policy if exists cotizaciones_select_by_permission on public.cotizaciones;
create policy cotizaciones_select_by_permission on public.cotizaciones
for select to authenticated
using (public.can_use_module('cotizaciones', 'view'));

drop policy if exists cotizaciones_write_by_permission on public.cotizaciones;
create policy cotizaciones_write_by_permission on public.cotizaciones
for all to authenticated
using (public.can_use_module('cotizaciones', 'edit'))
with check (public.can_use_module('cotizaciones', 'edit') or public.can_use_module('cotizaciones', 'create'));

drop policy if exists requerimientos_select_by_permission on public.requerimientos;
create policy requerimientos_select_by_permission on public.requerimientos
for select to authenticated
using (public.can_use_module('requerimientos', 'view'));

drop policy if exists requerimientos_write_by_permission on public.requerimientos;
create policy requerimientos_write_by_permission on public.requerimientos
for all to authenticated
using (public.can_use_module('requerimientos', 'edit'))
with check (public.can_use_module('requerimientos', 'edit') or public.can_use_module('requerimientos', 'create'));

drop policy if exists requerimiento_items_select_by_permission on public.requerimiento_items;
create policy requerimiento_items_select_by_permission on public.requerimiento_items
for select to authenticated
using (public.can_use_module('requerimientos', 'view'));

drop policy if exists requerimiento_items_write_by_permission on public.requerimiento_items;
create policy requerimiento_items_write_by_permission on public.requerimiento_items
for all to authenticated
using (public.can_use_module('requerimientos', 'edit'))
with check (public.can_use_module('requerimientos', 'edit'));

drop policy if exists technical_select_by_permission on public.technical_proposals;
create policy technical_select_by_permission on public.technical_proposals
for select to authenticated
using (public.can_use_module('technical_proposals', 'view'));

drop policy if exists technical_write_by_permission on public.technical_proposals;
create policy technical_write_by_permission on public.technical_proposals
for all to authenticated
using (public.can_use_module('technical_proposals', 'edit'))
with check (public.can_use_module('technical_proposals', 'edit') or public.can_use_module('technical_proposals', 'create'));

-- Tablas hijas de PT: si se puede editar/crear PT, se puede operar sobre hijas.
do $$
declare
  t text;
begin
  foreach t in array array[
    'entity_logos',
    'technical_proposal_items',
    'technical_proposal_resources',
    'technical_proposal_files',
    'technical_proposal_events'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_by_permission', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_use_module(''technical_proposals'', ''view'') or public.can_use_module(''recursos'', ''view''))',
      t || '_select_by_permission',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_write_by_permission', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_use_module(''technical_proposals'', ''edit'')) with check (public.can_use_module(''technical_proposals'', ''edit'') or public.can_use_module(''technical_proposals'', ''create''))',
      t || '_write_by_permission',
      t
    );
  end loop;
end $$;

drop policy if exists workspace_state_rw on public.workspace_state;
create policy workspace_state_rw on public.workspace_state
for all to authenticated
using (public.is_approved_user())
with check (public.is_approved_user());

drop policy if exists agent_conversations_own_or_roundtable on public.agent_conversations;
create policy agent_conversations_own_or_roundtable on public.agent_conversations
for all to authenticated
using (user_id = coalesce((select auth.jwt()) ->> 'email', '') or user_id = 'roundtable-shared' or public.is_admin_user())
with check (user_id = coalesce((select auth.jwt()) ->> 'email', '') or user_id = 'roundtable-shared' or public.is_admin_user());

drop policy if exists agent_memories_read on public.agent_memories;
create policy agent_memories_read on public.agent_memories
for select to authenticated
using (public.is_approved_user());

drop policy if exists agent_memories_write_admin on public.agent_memories;
drop policy if exists agent_memories_write_approved on public.agent_memories;
create policy agent_memories_write_approved on public.agent_memories
for insert to authenticated
with check (public.is_approved_user());

drop policy if exists agent_memories_delete_admin on public.agent_memories;
create policy agent_memories_delete_admin on public.agent_memories
for delete to authenticated
using (public.is_admin_user());

drop policy if exists historical_import_admin on public.historical_import_batches;
create policy historical_import_admin on public.historical_import_batches
for all to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists historical_import_issues_admin on public.historical_import_issues;
create policy historical_import_issues_admin on public.historical_import_issues
for all to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists provider_credentials_admin on public.provider_credentials;
create policy provider_credentials_admin on public.provider_credentials
for all to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- 9. Archivos documentales
-- ---------------------------------------------------------------------------

-- No se crea Supabase Storage para archivos nuevos.
-- Regla actual: Supabase guarda datos, IDs, URLs y metadata; Google Drive guarda
-- PDFs, imagenes, fichas, sustentos y documentos adjuntos.

-- ---------------------------------------------------------------------------
-- 10. Permisos iniciales para el usuario admin esperado
-- ---------------------------------------------------------------------------

insert into public.admin_module_permissions (
  user_email,
  module_key,
  can_view,
  can_create,
  can_edit,
  can_change_status,
  can_upload_files,
  can_view_prices,
  can_view_supplier,
  visible_columns,
  editable_fields,
  required_fields,
  enabled_buttons,
  metadata
)
select
  'edwin.qm@outlook.com',
  module_key,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{"seed":"100_clean_start_schema"}'::jsonb
from (values
  ('dashboard'),
  ('cotizaciones'),
  ('requerimientos'),
  ('recursos'),
  ('datos'),
  ('technical_proposals'),
  ('admin'),
  ('chat'),
  ('office'),
  ('roundtable'),
  ('skills')
) as modules(module_key)
on conflict (user_email, module_key) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_change_status = excluded.can_change_status,
  can_upload_files = excluded.can_upload_files,
  can_view_prices = excluded.can_view_prices,
  can_view_supplier = excluded.can_view_supplier,
  updated_at = now();

commit;
