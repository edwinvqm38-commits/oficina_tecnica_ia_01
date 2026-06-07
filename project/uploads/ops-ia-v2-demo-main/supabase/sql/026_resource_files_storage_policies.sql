-- 026_resource_files_storage_policies.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Prepara el bucket privado para archivos reales del maestro de recursos.
--
-- Alcance ejecutable:
-- - crea/asegura el bucket privado resource-files
-- - no altera storage.objects
-- - no hace DROP POLICY / CREATE POLICY / COMMENT ON POLICY sobre storage.objects
-- - no usa service_role
-- - no habilita DELETE fisico
-- - no toca public.recursos, public.requerimientos, public.requerimiento_items
--   ni public.cotizaciones
--
-- Nota importante:
-- En algunos proyectos Supabase, storage.objects pertenece al sistema interno de
-- Storage y el SQL Editor no tiene ownership sobre esa relacion. Por eso las
-- policies de Storage deben configurarse desde Supabase Dashboard > Storage >
-- Policies para el bucket resource-files.

begin;

-- Bucket privado: la app debe abrir archivos con signed URLs.
insert into storage.buckets (
  id,
  name,
  public
) values (
  'resource-files',
  'resource-files',
  false
)
on conflict (id) do update set
  name = excluded.name,
  public = false;

-- Validacion A: bucket resource-files existe.
select
  id,
  name,
  public,
  created_at,
  updated_at
from storage.buckets
where id = 'resource-files';

-- Validacion B: bucket resource-files queda privado.
select
  id,
  public = false as resource_files_is_private
from storage.buckets
where id = 'resource-files';

-- Validacion C: esta migracion no define policies sobre storage.objects.
-- Debe retornar 0 porque las policies se crean manualmente desde el Dashboard.
select
  count(*) as resource_files_policies_created_by_this_sql
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'resource_files_select_by_recursos_permission',
    'resource_files_insert_by_recursos_permission',
    'resource_files_update_by_recursos_permission'
  );

-- Validacion D: confirmacion no invasiva de tablas public fuera de alcance.
-- Estas consultas solo leen metadatos; no modifican recursos, requerimientos,
-- requerimiento_items ni cotizaciones.
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'recursos',
    'requerimientos',
    'requerimiento_items',
    'cotizaciones'
  )
order by table_name;

commit;

-- ---------------------------------------------------------------------------
-- POLICIES SUGERIDAS PARA CREAR MANUALMENTE EN SUPABASE DASHBOARD
-- ---------------------------------------------------------------------------
-- Crear desde:
-- Supabase Dashboard > Storage > Policies > bucket resource-files
--
-- Motivo:
-- No se crean desde esta migracion porque el entorno actual no tiene ownership
-- sobre storage.objects y PostgreSQL devuelve:
-- ERROR: 42501: must be owner of relation objects
--
-- Bucket:
-- resource-files
--
-- Rutas permitidas:
-- recursos/{resourceId}/image/{archivo}
-- recursos/{resourceId}/datasheet/{archivo}
-- recursos/{resourceId}/attachments/{archivo}
--
-- No crear policy DELETE en esta fase.
--
-- ---------------------------------------------------------------------------
-- 1) SELECT: lectura de archivos de recursos
-- ---------------------------------------------------------------------------
-- Policy name:
-- resource_files_select_by_recursos_permission
--
-- Operation:
-- SELECT
--
-- Target roles:
-- authenticated
--
-- USING expression:
-- (
--   bucket_id = 'resource-files'
--   and exists (
--     select 1
--     from public.user_profiles up
--     left join public.admin_module_permissions amp
--       on lower(amp.user_email) = lower(up.email)
--       and lower(amp.module_key) = 'recursos'
--     where up.id = auth.uid()
--       and lower(up.status::text) = 'approved'
--       and (
--         up.is_super_admin is true
--         or lower(up.role::text) = 'admin'
--         or lower(up.email) = 'edwin.qm@outlook.com'
--         or amp.can_view = true
--       )
--   )
-- )
--
-- ---------------------------------------------------------------------------
-- 2) INSERT: subida de imagenes, fichas y adjuntos de recursos
-- ---------------------------------------------------------------------------
-- Policy name:
-- resource_files_insert_by_recursos_permission
--
-- Operation:
-- INSERT
--
-- Target roles:
-- authenticated
--
-- WITH CHECK expression:
-- (
--   bucket_id = 'resource-files'
--   and name ~ '^recursos/[^/]+/(image|datasheet|attachments)/[^/]+$'
--   and exists (
--     select 1
--     from public.user_profiles up
--     left join public.admin_module_permissions amp
--       on lower(amp.user_email) = lower(up.email)
--       and lower(amp.module_key) = 'recursos'
--     where up.id = auth.uid()
--       and lower(up.status::text) = 'approved'
--       and (
--         up.is_super_admin is true
--         or lower(up.role::text) = 'admin'
--         or lower(up.email) = 'edwin.qm@outlook.com'
--         or amp.can_edit = true
--         or amp.can_upload_files = true
--       )
--   )
-- )
--
-- ---------------------------------------------------------------------------
-- 3) UPDATE: reemplazo logico de archivos de recursos
-- ---------------------------------------------------------------------------
-- Policy name:
-- resource_files_update_by_recursos_permission
--
-- Operation:
-- UPDATE
--
-- Target roles:
-- authenticated
--
-- USING expression:
-- (
--   bucket_id = 'resource-files'
--   and exists (
--     select 1
--     from public.user_profiles up
--     left join public.admin_module_permissions amp
--       on lower(amp.user_email) = lower(up.email)
--       and lower(amp.module_key) = 'recursos'
--     where up.id = auth.uid()
--       and lower(up.status::text) = 'approved'
--       and (
--         up.is_super_admin is true
--         or lower(up.role::text) = 'admin'
--         or lower(up.email) = 'edwin.qm@outlook.com'
--         or amp.can_edit = true
--         or amp.can_upload_files = true
--       )
--   )
-- )
--
-- WITH CHECK expression:
-- (
--   bucket_id = 'resource-files'
--   and name ~ '^recursos/[^/]+/(image|datasheet|attachments)/[^/]+$'
--   and exists (
--     select 1
--     from public.user_profiles up
--     left join public.admin_module_permissions amp
--       on lower(amp.user_email) = lower(up.email)
--       and lower(amp.module_key) = 'recursos'
--     where up.id = auth.uid()
--       and lower(up.status::text) = 'approved'
--       and (
--         up.is_super_admin is true
--         or lower(up.role::text) = 'admin'
--         or lower(up.email) = 'edwin.qm@outlook.com'
--         or amp.can_edit = true
--         or amp.can_upload_files = true
--       )
--   )
-- )
