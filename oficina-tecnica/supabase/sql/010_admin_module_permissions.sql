-- 010_admin_module_permissions.sql
-- Base simple de permisos por usuario y modulo.
-- Alcance inicial: preparar permisos del modulo recursos para administracion futura.
-- No habilita creacion, edicion, eliminacion ni subida de documentos en la app.

begin;

create extension if not exists pgcrypto;

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

create index if not exists admin_module_permissions_user_email_idx
  on public.admin_module_permissions (lower(user_email));

create index if not exists admin_module_permissions_module_key_idx
  on public.admin_module_permissions (module_key);

create or replace function public.set_admin_module_permissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_admin_module_permissions_updated_at on public.admin_module_permissions;

create trigger set_admin_module_permissions_updated_at
before update on public.admin_module_permissions
for each row
execute function public.set_admin_module_permissions_updated_at();

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
) values (
  'edwin.qm@outlook.com',
  'recursos',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  '[
    "codigo_recurso",
    "codigo_eka",
    "codigo_fabricante",
    "tipo_recurso_nombre",
    "descripcion",
    "unidad_codigo",
    "precio_unitario_ref",
    "moneda_codigo",
    "proveedor_nombre",
    "marca_nombre",
    "modelo",
    "estado",
    "fecha_actualizacion"
  ]'::jsonb,
  '[]'::jsonb,
  '[
    "codigo_recurso",
    "tipo_recurso_nombre",
    "descripcion",
    "unidad_codigo",
    "precio_unitario_ref",
    "moneda_codigo",
    "estado"
  ]'::jsonb,
  '[
    "new_resource",
    "edit_resource",
    "change_status",
    "upload_files"
  ]'::jsonb,
  '{"seed": "010_admin_module_permissions", "scope": "recursos"}'::jsonb
)
on conflict (user_email, module_key) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_change_status = excluded.can_change_status,
  can_upload_files = excluded.can_upload_files,
  can_view_prices = excluded.can_view_prices,
  can_view_supplier = excluded.can_view_supplier,
  visible_columns = excluded.visible_columns,
  editable_fields = excluded.editable_fields,
  required_fields = excluded.required_fields,
  enabled_buttons = excluded.enabled_buttons,
  metadata = public.admin_module_permissions.metadata || excluded.metadata,
  updated_at = now();

alter table public.admin_module_permissions enable row level security;

drop policy if exists "admin_module_permissions_select_own" on public.admin_module_permissions;
create policy "admin_module_permissions_select_own"
on public.admin_module_permissions
for select
to authenticated
using (
  lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "admin_module_permissions_select_super_admin" on public.admin_module_permissions;
create policy "admin_module_permissions_select_super_admin"
on public.admin_module_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.status::text = 'approved'
      and (
        up.is_super_admin is true
        or lower(up.email) = 'edwin.qm@outlook.com'
      )
  )
);

-- Validacion 1: permiso inicial del modulo recursos.
select
  user_email,
  module_key,
  can_view,
  can_create,
  can_edit,
  can_change_status,
  can_upload_files,
  can_view_prices,
  can_view_supplier
from public.admin_module_permissions
where module_key = 'recursos'
order by user_email;

-- Validacion 2: politicas RLS creadas para la tabla.
select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'admin_module_permissions'
order by policyname;

commit;
