-- 014_historical_import_remote_validation_permissions.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Este archivo no importa datos ni ejecuta la carga historica observada.
-- Su objetivo es habilitar validaciones remotas seguras por SELECT
-- para el importador controlado, manteniendo RLS activo.
-- SELECT queda restringido por politica a super admin.
-- DELETE sigue bloqueado por decision conservadora.

begin;

-- 1. Mantener RLS activo en tablas relevantes para validacion remota.
alter table public.historical_import_batches enable row level security;
alter table public.historical_import_issues enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.requerimientos enable row level security;
alter table public.requerimiento_items enable row level security;

-- 2. Grants minimos para authenticated.
-- Nota: GRANT no reemplaza RLS; solo habilita el permiso base.
-- La restriccion final sigue dependiendo de las politicas.
grant usage on schema public to authenticated;

grant select on public.cotizaciones to authenticated;
grant select on public.requerimientos to authenticated;
grant select on public.requerimiento_items to authenticated;

grant select, insert, update on public.historical_import_batches to authenticated;
grant select, insert, update on public.historical_import_issues to authenticated;

-- 3. Patron reutilizado del proyecto:
-- public.user_profiles + auth.uid() + status = approved + is_super_admin
-- con fallback explicito para edwin.qm@outlook.com.

-- ==========================
-- cotizaciones
-- ==========================

drop policy if exists "cotizaciones_select_super_admin_for_historical_import" on public.cotizaciones;
create policy "cotizaciones_select_super_admin_for_historical_import"
on public.cotizaciones
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

-- ==========================
-- requerimientos
-- ==========================

drop policy if exists "requerimientos_select_super_admin_for_historical_import" on public.requerimientos;
create policy "requerimientos_select_super_admin_for_historical_import"
on public.requerimientos
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

-- ==========================
-- requerimiento_items
-- ==========================

drop policy if exists "requerimiento_items_select_super_admin_for_historical_import" on public.requerimiento_items;
create policy "requerimiento_items_select_super_admin_for_historical_import"
on public.requerimiento_items
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

-- 4. Comentario operativo.
-- historical_import_batches e historical_import_issues ya tienen politicas
-- de select/insert/update definidas en el SQL 013.
-- Este archivo no las duplica; solo asegura los GRANT base necesarios.
-- No habilita DELETE ni modifica tablas principales fuera del alcance de SELECT remoto.

-- Validacion manual 1: grants actuales para tablas relevantes.
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'historical_import_batches',
    'historical_import_issues',
    'cotizaciones',
    'requerimientos',
    'requerimiento_items'
  )
order by table_name, grantee, privilege_type;

-- Validacion manual 2: estado de row level security.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'historical_import_batches',
    'historical_import_issues',
    'cotizaciones',
    'requerimientos',
    'requerimiento_items'
  )
order by tablename;

-- Validacion manual 3: politicas RLS en tablas relevantes.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'historical_import_batches',
    'historical_import_issues',
    'cotizaciones',
    'requerimientos',
    'requerimiento_items'
  )
order by tablename, policyname;

commit;
