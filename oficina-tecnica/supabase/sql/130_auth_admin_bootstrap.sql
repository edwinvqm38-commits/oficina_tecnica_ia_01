-- 130_auth_admin_bootstrap.sql
-- Ejecutar despues de crear en Supabase Auth el usuario:
--   email: edwin.qm@outlook.com
--   password: 123456
--
-- Objetivo:
-- - Asegurar perfil admin aprobado para Edwin si el usuario ya existe en auth.users.
-- - Reforzar el trigger de nuevos usuarios: admin aprobado, otros pending.
-- - Registrar solicitudes de acceso para auditoria/aprobacion.
-- - Sembrar permisos completos del admin esperado.

begin;

create table if not exists public.user_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  provider text not null default 'email',
  status public.user_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejected_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_access_requests_user_unique unique (user_id),
  constraint user_access_requests_email_not_blank check (length(trim(email)) > 0),
  constraint user_access_requests_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists user_access_requests_status_idx on public.user_access_requests(status);
create index if not exists user_access_requests_email_idx on public.user_access_requests(lower(email));

drop trigger if exists set_user_access_requests_updated_at on public.user_access_requests;
create trigger set_user_access_requests_updated_at
before update on public.user_access_requests
for each row execute function public.set_updated_at();

alter table public.user_access_requests enable row level security;
grant select, insert, update on public.user_access_requests to authenticated;

drop policy if exists user_access_requests_select_own_or_admin on public.user_access_requests;
create policy user_access_requests_select_own_or_admin on public.user_access_requests
for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists user_access_requests_insert_own on public.user_access_requests;
create policy user_access_requests_insert_own on public.user_access_requests
for insert to authenticated
with check (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists user_access_requests_update_admin on public.user_access_requests;
create policy user_access_requests_update_admin on public.user_access_requests
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_full_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name');
  v_avatar_url text := new.raw_user_meta_data ->> 'avatar_url';
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', new.raw_user_meta_data ->> 'provider', 'email');
  v_is_admin boolean := lower(coalesce(new.email, '')) = 'edwin.qm@outlook.com';
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
    approved_at,
    metadata
  )
  values (
    new.id,
    new.email,
    v_full_name,
    v_avatar_url,
    case when v_is_admin then 'admin'::public.app_role else 'consulta'::public.app_role end,
    case when v_is_admin then 'approved'::public.user_status else 'pending'::public.user_status end,
    v_is_admin,
    case when v_is_admin then new.id::text else null end,
    case when v_is_admin then now() else null end,
    jsonb_build_object('provider', v_provider, 'seed', 'handle_new_user')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.user_profiles.avatar_url, excluded.avatar_url),
    role = case when v_is_admin then 'admin'::public.app_role else public.user_profiles.role end,
    status = case when v_is_admin then 'approved'::public.user_status else public.user_profiles.status end,
    is_super_admin = case when v_is_admin then true else public.user_profiles.is_super_admin end,
    approved_by = case when v_is_admin then new.id::text else public.user_profiles.approved_by end,
    approved_at = case when v_is_admin then coalesce(public.user_profiles.approved_at, now()) else public.user_profiles.approved_at end,
    metadata = coalesce(public.user_profiles.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  insert into public.user_access_requests (
    user_id,
    email,
    full_name,
    provider,
    status,
    reviewed_by,
    reviewed_at,
    metadata
  )
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    v_provider,
    case when v_is_admin then 'approved'::public.user_status else 'pending'::public.user_status end,
    case when v_is_admin then new.id else null end,
    case when v_is_admin then now() else null end,
    jsonb_build_object('seed', 'handle_new_user')
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = coalesce(public.user_access_requests.full_name, excluded.full_name),
    provider = excluded.provider,
    status = case when v_is_admin then 'approved'::public.user_status else public.user_access_requests.status end,
    reviewed_by = case when v_is_admin then new.id else public.user_access_requests.reviewed_by end,
    reviewed_at = case when v_is_admin then coalesce(public.user_access_requests.reviewed_at, now()) else public.user_access_requests.reviewed_at end,
    metadata = coalesce(public.user_access_requests.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.user_profiles (
  id,
  email,
  full_name,
  role,
  status,
  is_super_admin,
  approved_by,
  approved_at,
  metadata
)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', 'Edwin Administrador'),
  'admin'::public.app_role,
  'approved'::public.user_status,
  true,
  au.id::text,
  now(),
  '{"seed":"130_auth_admin_bootstrap"}'::jsonb
from auth.users au
where lower(coalesce(au.email, '')) = 'edwin.qm@outlook.com'
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
  role = 'admin'::public.app_role,
  status = 'approved'::public.user_status,
  is_super_admin = true,
  approved_by = excluded.approved_by,
  approved_at = coalesce(public.user_profiles.approved_at, now()),
  metadata = coalesce(public.user_profiles.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

insert into public.user_access_requests (
  user_id,
  email,
  full_name,
  provider,
  status,
  reviewed_by,
  reviewed_at,
  metadata
)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', 'Edwin Administrador'),
  coalesce(au.raw_app_meta_data ->> 'provider', 'email'),
  'approved'::public.user_status,
  au.id,
  now(),
  '{"seed":"130_auth_admin_bootstrap"}'::jsonb
from auth.users au
where lower(coalesce(au.email, '')) = 'edwin.qm@outlook.com'
on conflict (user_id) do update set
  status = 'approved'::public.user_status,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = coalesce(public.user_access_requests.reviewed_at, now()),
  metadata = coalesce(public.user_access_requests.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

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
  '{"seed":"130_auth_admin_bootstrap"}'::jsonb
from (values
  ('dashboard'),
  ('cotizaciones'),
  ('requerimientos'),
  ('recursos'),
  ('datos'),
  ('technical_proposals'),
  ('admin'),
  ('administrador'),
  ('admin-users'),
  ('connections'),
  ('agents'),
  ('org'),
  ('inbox'),
  ('approvals'),
  ('memory'),
  ('timeline'),
  ('chat'),
  ('office'),
  ('roundtable'),
  ('skills'),
  ('wiki-agentes'),
  ('wiki-ia')
) as modules(module_key)
on conflict (user_email, module_key) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_change_status = excluded.can_change_status,
  can_upload_files = excluded.can_upload_files,
  can_view_prices = excluded.can_view_prices,
  can_view_supplier = excluded.can_view_supplier,
  updated_at = now(),
  metadata = coalesce(public.admin_module_permissions.metadata, '{}'::jsonb) || excluded.metadata;

commit;

-- Validacion:
-- select id, email, role, status, is_super_admin from public.user_profiles where lower(email) = 'edwin.qm@outlook.com';
-- select module_key, can_view, can_create, can_edit from public.admin_module_permissions where lower(user_email) = 'edwin.qm@outlook.com' order by module_key;
