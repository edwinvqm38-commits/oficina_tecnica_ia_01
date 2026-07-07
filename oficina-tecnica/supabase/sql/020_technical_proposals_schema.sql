-- 020_technical_proposals_schema.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Crea el modelo base para persistir Propuesta Tecnica en Supabase.
--
-- Alcance:
-- - no ejecuta integraciones con frontend
-- - no crea storage ni carpetas reales
-- - no toca Requerimientos ni formato RQ
-- - no toca importacion historica
-- - no habilita DELETE amplio
-- - mantiene la edicion de recursos PT como snapshot, sin modificar public.recursos
--
-- Deuda tecnica conocida:
-- - el fallback por correo edwin.qm@outlook.com replica el patron RLS actual del proyecto.
-- - debe migrarse luego a una autorizacion basada solo en user_profiles.is_super_admin
--   y permisos administrativos, pero no se cambia ahora para no romper consistencia.

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- 1. FUNCION COMUN UPDATED_AT
-- ============================================================
-- En las migraciones previas solo se encontraron funciones especificas por modulo.
-- Esta funcion generica queda disponible para las tablas nuevas de Propuesta Tecnica.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 2. LOGOS REUTILIZABLES POR ENTIDAD
-- ============================================================

create table if not exists public.entity_logos (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
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
  constraint entity_logos_entity_type_check
    check (entity_type in ('company', 'client', 'supplier', 'unit')),
  constraint entity_logos_entity_key_not_blank
    check (length(trim(entity_key)) > 0),
  constraint entity_logos_display_name_not_blank
    check (length(trim(display_name)) > 0),
  constraint entity_logos_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists entity_logos_entity_type_key_idx
  on public.entity_logos (entity_type, entity_key);

create index if not exists entity_logos_is_active_idx
  on public.entity_logos (is_active);

create index if not exists entity_logos_is_default_idx
  on public.entity_logos (is_default);

create unique index if not exists entity_logos_active_entity_unique_idx
  on public.entity_logos (entity_type, entity_key)
  where is_active = true;

drop trigger if exists set_entity_logos_updated_at on public.entity_logos;

create trigger set_entity_logos_updated_at
before update on public.entity_logos
for each row
execute function public.set_updated_at();

-- ============================================================
-- 3. CABECERA DOCUMENTAL DE PROPUESTA TECNICA
-- ============================================================

create table if not exists public.technical_proposals (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references public.cotizaciones(id),
  cotizacion_codigo text not null,
  code text not null unique,
  document_type text not null default 'PT',
  revision text not null default 'REV00',
  revision_folder text not null default '02_PROPUESTA',
  status text not null default 'Borrador',
  mode text not null default 'cliente',
  work_status text not null default 'Borrador',
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
  constraint technical_proposals_document_type_check
    check (document_type = 'PT'),
  constraint technical_proposals_mode_check
    check (mode in ('cliente', 'interno')),
  constraint technical_proposals_status_check
    check (status in ('Borrador', 'En revision', 'Aprobada', 'Archivada')),
  constraint technical_proposals_work_status_check
    check (work_status in ('Borrador', 'En proceso', 'Completado')),
  constraint technical_proposals_cotizacion_codigo_not_blank
    check (length(trim(cotizacion_codigo)) > 0),
  constraint technical_proposals_code_not_blank
    check (length(trim(code)) > 0),
  constraint technical_proposals_revision_not_blank
    check (length(trim(revision)) > 0),
  constraint technical_proposals_revision_folder_not_blank
    check (length(trim(revision_folder)) > 0),
  constraint technical_proposals_header_object
    check (jsonb_typeof(header) = 'object'),
  constraint technical_proposals_recipient_object
    check (jsonb_typeof(recipient) = 'object'),
  constraint technical_proposals_presentation_object
    check (jsonb_typeof(presentation) = 'object'),
  constraint technical_proposals_commercial_terms_object
    check (jsonb_typeof(commercial_terms) = 'object'),
  constraint technical_proposals_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint technical_proposals_cotizacion_revision_unique
    unique (cotizacion_id, revision)
);

create index if not exists technical_proposals_cotizacion_id_idx
  on public.technical_proposals (cotizacion_id);

create index if not exists technical_proposals_cotizacion_codigo_idx
  on public.technical_proposals (cotizacion_codigo);

create index if not exists technical_proposals_code_idx
  on public.technical_proposals (code);

create index if not exists technical_proposals_status_idx
  on public.technical_proposals (status);

create index if not exists technical_proposals_revision_idx
  on public.technical_proposals (revision);

create index if not exists technical_proposals_document_date_idx
  on public.technical_proposals (document_date);

drop trigger if exists set_technical_proposals_updated_at on public.technical_proposals;

create trigger set_technical_proposals_updated_at
before update on public.technical_proposals
for each row
execute function public.set_updated_at();

-- ============================================================
-- 4. ESTRUCTURA VERTICAL JERARQUICA
-- ============================================================

create table if not exists public.technical_proposal_items (
  id uuid primary key default gen_random_uuid(),
  technical_proposal_id uuid not null references public.technical_proposals(id) on delete cascade,
  parent_id uuid references public.technical_proposal_items(id) on delete cascade,
  item_type text not null,
  item_number text not null,
  level integer not null default 0,
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
  constraint technical_proposal_items_item_type_check
    check (item_type in ('group', 'subgroup', 'activity')),
  constraint technical_proposal_items_level_check
    check (level >= 0),
  constraint technical_proposal_items_item_number_not_blank
    check (length(trim(item_number)) > 0),
  constraint technical_proposal_items_title_not_blank
    check (length(trim(title)) > 0),
  constraint technical_proposal_items_estimated_time_check
    check (estimated_time_value is null or estimated_time_value >= 0),
  constraint technical_proposal_items_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint technical_proposal_items_number_unique
    unique (technical_proposal_id, item_number)
);

create index if not exists technical_proposal_items_proposal_id_idx
  on public.technical_proposal_items (technical_proposal_id);

create index if not exists technical_proposal_items_parent_id_idx
  on public.technical_proposal_items (parent_id);

create index if not exists technical_proposal_items_proposal_sort_idx
  on public.technical_proposal_items (technical_proposal_id, sort_order);

create index if not exists technical_proposal_items_proposal_number_idx
  on public.technical_proposal_items (technical_proposal_id, item_number);

drop trigger if exists set_technical_proposal_items_updated_at on public.technical_proposal_items;

create trigger set_technical_proposal_items_updated_at
before update on public.technical_proposal_items
for each row
execute function public.set_updated_at();

-- ============================================================
-- 5. RECURSOS USADOS COMO SNAPSHOT EDITABLE
-- ============================================================

create table if not exists public.technical_proposal_resources (
  id uuid primary key default gen_random_uuid(),
  technical_proposal_id uuid not null references public.technical_proposals(id) on delete cascade,
  technical_proposal_item_id uuid not null references public.technical_proposal_items(id) on delete cascade,
  resource_id uuid references public.recursos(id),
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
  updated_at timestamptz not null default now(),
  constraint technical_proposal_resources_origin_status_check
    check (origin_status in ('catalogo_copiado', 'nuevo_por_formalizar', 'manual')),
  constraint technical_proposal_resources_cantidad_check
    check (cantidad >= 0),
  constraint technical_proposal_resources_tiempo_check
    check (tiempo is null or tiempo >= 0),
  constraint technical_proposal_resources_precio_check
    check (precio_unitario_ref is null or precio_unitario_ref >= 0),
  constraint technical_proposal_resources_category_not_blank
    check (length(trim(resource_category)) > 0),
  constraint technical_proposal_resources_descripcion_not_blank
    check (length(trim(descripcion)) > 0),
  constraint technical_proposal_resources_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists technical_proposal_resources_proposal_id_idx
  on public.technical_proposal_resources (technical_proposal_id);

create index if not exists technical_proposal_resources_item_id_idx
  on public.technical_proposal_resources (technical_proposal_item_id);

create index if not exists technical_proposal_resources_resource_id_idx
  on public.technical_proposal_resources (resource_id);

create index if not exists technical_proposal_resources_category_idx
  on public.technical_proposal_resources (resource_category);

create index if not exists technical_proposal_resources_origin_status_idx
  on public.technical_proposal_resources (origin_status);

drop trigger if exists set_technical_proposal_resources_updated_at on public.technical_proposal_resources;

create trigger set_technical_proposal_resources_updated_at
before update on public.technical_proposal_resources
for each row
execute function public.set_updated_at();

-- ============================================================
-- 6. ARCHIVOS, IMAGENES Y EXPORTACIONES
-- ============================================================

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
  created_by uuid references auth.users(id),
  constraint technical_proposal_files_file_type_check
    check (file_type in ('general_image', 'activity_image', 'resource_image', 'export_doc', 'export_pdf', 'export_html', 'export_json', 'other')),
  constraint technical_proposal_files_file_size_check
    check (file_size is null or file_size >= 0),
  constraint technical_proposal_files_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists technical_proposal_files_proposal_id_idx
  on public.technical_proposal_files (technical_proposal_id);

create index if not exists technical_proposal_files_item_id_idx
  on public.technical_proposal_files (technical_proposal_item_id);

create index if not exists technical_proposal_files_file_type_idx
  on public.technical_proposal_files (file_type);

create index if not exists technical_proposal_files_storage_path_idx
  on public.technical_proposal_files (storage_path);

-- ============================================================
-- 7. EVENTOS DE AUDITORIA OPERATIVA
-- ============================================================

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
  created_at timestamptz not null default now(),
  constraint technical_proposal_events_event_type_check
    check (event_type in ('created', 'updated', 'status_changed', 'resource_assigned', 'resource_reused', 'logo_resolved', 'exported_word', 'exported_html', 'exported_json', 'printed_pdf')),
  constraint technical_proposal_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists technical_proposal_events_proposal_id_idx
  on public.technical_proposal_events (technical_proposal_id);

create index if not exists technical_proposal_events_event_type_idx
  on public.technical_proposal_events (event_type);

create index if not exists technical_proposal_events_created_at_idx
  on public.technical_proposal_events (created_at);

create index if not exists technical_proposal_events_actor_email_idx
  on public.technical_proposal_events (lower(actor_email));

-- ============================================================
-- 8. RLS Y GRANTS MINIMOS
-- ============================================================

alter table public.entity_logos enable row level security;
alter table public.technical_proposals enable row level security;
alter table public.technical_proposal_items enable row level security;
alter table public.technical_proposal_resources enable row level security;
alter table public.technical_proposal_files enable row level security;
alter table public.technical_proposal_events enable row level security;

grant select, insert, update on public.entity_logos to authenticated;
grant select, insert, update on public.technical_proposals to authenticated;
grant select, insert, update on public.technical_proposal_items to authenticated;
grant select, insert, update on public.technical_proposal_resources to authenticated;
grant select, insert on public.technical_proposal_files to authenticated;
grant select, insert on public.technical_proposal_events to authenticated;

-- Lectura minima para usuarios autenticados.
drop policy if exists "entity_logos_select_authenticated" on public.entity_logos;
create policy "entity_logos_select_authenticated"
on public.entity_logos
for select
to authenticated
using (true);

drop policy if exists "technical_proposals_select_authenticated" on public.technical_proposals;
create policy "technical_proposals_select_authenticated"
on public.technical_proposals
for select
to authenticated
using (true);

drop policy if exists "technical_proposal_items_select_authenticated" on public.technical_proposal_items;
create policy "technical_proposal_items_select_authenticated"
on public.technical_proposal_items
for select
to authenticated
using (true);

drop policy if exists "technical_proposal_resources_select_authenticated" on public.technical_proposal_resources;
create policy "technical_proposal_resources_select_authenticated"
on public.technical_proposal_resources
for select
to authenticated
using (true);

drop policy if exists "technical_proposal_files_select_authenticated" on public.technical_proposal_files;
create policy "technical_proposal_files_select_authenticated"
on public.technical_proposal_files
for select
to authenticated
using (true);

drop policy if exists "technical_proposal_events_select_authenticated" on public.technical_proposal_events;
create policy "technical_proposal_events_select_authenticated"
on public.technical_proposal_events
for select
to authenticated
using (true);

-- Escritura conservadora: super admin, admin aprobado, usuario especial,
-- o permiso explicito del modulo technical_proposals.

drop policy if exists "entity_logos_insert_admin" on public.entity_logos;
create policy "entity_logos_insert_admin"
on public.entity_logos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key in ('technical_proposals', 'entity_logos')
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_create = true
      )
  )
);

drop policy if exists "entity_logos_update_admin" on public.entity_logos;
create policy "entity_logos_update_admin"
on public.entity_logos
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key in ('technical_proposals', 'entity_logos')
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
      )
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key in ('technical_proposals', 'entity_logos')
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
      )
  )
);

drop policy if exists "technical_proposals_insert_by_module_permission" on public.technical_proposals;
create policy "technical_proposals_insert_by_module_permission"
on public.technical_proposals
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_create = true
      )
  )
);

drop policy if exists "technical_proposals_update_by_module_permission" on public.technical_proposals;
create policy "technical_proposals_update_by_module_permission"
on public.technical_proposals
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
        or amp.can_change_status = true
      )
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
        or amp.can_change_status = true
      )
  )
);

drop policy if exists "technical_proposal_items_insert_by_module_permission" on public.technical_proposal_items;
create policy "technical_proposal_items_insert_by_module_permission"
on public.technical_proposal_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_create = true
        or amp.can_edit = true
      )
  )
);

drop policy if exists "technical_proposal_items_update_by_module_permission" on public.technical_proposal_items;
create policy "technical_proposal_items_update_by_module_permission"
on public.technical_proposal_items
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
      )
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
      )
  )
);

drop policy if exists "technical_proposal_resources_insert_by_module_permission" on public.technical_proposal_resources;
create policy "technical_proposal_resources_insert_by_module_permission"
on public.technical_proposal_resources
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_create = true
        or amp.can_edit = true
      )
  )
);

drop policy if exists "technical_proposal_resources_update_by_module_permission" on public.technical_proposal_resources;
create policy "technical_proposal_resources_update_by_module_permission"
on public.technical_proposal_resources
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
      )
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
      )
  )
);

drop policy if exists "technical_proposal_files_insert_by_module_permission" on public.technical_proposal_files;
create policy "technical_proposal_files_insert_by_module_permission"
on public.technical_proposal_files
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_upload_files = true
        or amp.can_create = true
      )
  )
);

drop policy if exists "technical_proposal_events_insert_by_module_permission" on public.technical_proposal_events;
create policy "technical_proposal_events_insert_by_module_permission"
on public.technical_proposal_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and amp.module_key = 'technical_proposals'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_create = true
        or amp.can_edit = true
        or amp.can_change_status = true
      )
  )
);

-- ============================================================
-- 9. COMENTARIOS DE NEGOCIO
-- ============================================================

comment on table public.entity_logos is
  'Logos reutilizables para empresa, clientes, proveedores o unidades. Permite resolver logo por entidad sin depender de localStorage.';

comment on column public.entity_logos.entity_type is
  'Tipo de entidad propietaria del logo: company, client, supplier o unit.';

comment on column public.entity_logos.entity_key is
  'Clave normalizada de entidad para reutilizar el logo entre documentos.';

comment on column public.entity_logos.storage_path is
  'Ruta o identificador externo opcional del logo. Para archivos nuevos debe preferirse Google Drive y guardar aqui solo referencia/metadata.';

comment on table public.technical_proposals is
  'Cabecera documental de Propuesta Tecnica por cotizacion y revision.';

comment on column public.technical_proposals.cotizacion_id is
  'Referencia opcional a public.cotizaciones. Puede quedar nula en migraciones o cargas preliminares.';

comment on column public.technical_proposals.code is
  'Codigo documental unico de la Propuesta Tecnica.';

comment on column public.technical_proposals.commercial_terms is
  'Condiciones comerciales en JSONB para MVP. Puede normalizarse en una fase posterior.';

comment on table public.technical_proposal_items is
  'Estructura vertical jerarquica de grupos, subgrupos y actividades para evitar columnas infinitas.';

comment on column public.technical_proposal_items.parent_id is
  'Padre jerarquico del item. Nulo para grupos de primer nivel.';

comment on column public.technical_proposal_items.item_number is
  'Numeracion visible del documento tecnico, por ejemplo 1, 1.1 o 1.1.1.';

comment on table public.technical_proposal_resources is
  'Recursos usados en Propuesta Tecnica como snapshot editable. Editar esta tabla no modifica public.recursos.';

comment on column public.technical_proposal_resources.resource_id is
  'Referencia opcional al recurso maestro usado como origen del snapshot.';

comment on column public.technical_proposal_resources.origin_status is
  'Origen visual/operativo del recurso: catalogo_copiado, nuevo_por_formalizar o manual.';

comment on table public.technical_proposal_files is
  'Registro de imagenes, referencias y exportaciones asociadas a una Propuesta Tecnica.';

comment on column public.technical_proposal_files.storage_path is
  'Ruta o identificador externo opcional. Para archivos nuevos debe preferirse Google Drive y guardar aqui solo referencia/metadata.';

comment on table public.technical_proposal_events is
  'Eventos de trazabilidad operativa de la Propuesta Tecnica.';

comment on column public.technical_proposal_events.event_type is
  'Tipo de evento esperado: created, updated, status_changed, resource_assigned, resource_reused, logo_resolved, exported_word, exported_html, exported_json o printed_pdf.';

-- ============================================================
-- 10. VALIDACIONES MANUALES
-- ============================================================

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'entity_logos',
    'technical_proposals',
    'technical_proposal_items',
    'technical_proposal_resources',
    'technical_proposal_files',
    'technical_proposal_events'
  )
order by table_name;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'entity_logos',
    'technical_proposals',
    'technical_proposal_items',
    'technical_proposal_resources',
    'technical_proposal_files',
    'technical_proposal_events'
  )
order by tablename, policyname;

commit;
