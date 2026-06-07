-- 015_historical_import_execute_permissions.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Este archivo no ejecuta la importacion historica observada.
-- Su objetivo es dejar preparados los permisos minimos de INSERT
-- para una futura ejecucion real controlada del importador historico.
-- RLS permanece activo y el acceso sigue restringido a super admin.
-- DELETE no se habilita.

begin;

alter table public.cotizaciones enable row level security;
alter table public.requerimientos enable row level security;
alter table public.requerimiento_items enable row level security;
alter table public.historical_import_batches enable row level security;

grant insert on public.cotizaciones to authenticated;
grant insert on public.requerimientos to authenticated;
grant insert on public.requerimiento_items to authenticated;
grant update on public.historical_import_batches to authenticated;

-- Patron reutilizado del proyecto:
-- public.user_profiles + auth.uid() + status = approved + is_super_admin
-- con fallback explicito para edwin.qm@outlook.com.

drop policy if exists "cotizaciones_insert_super_admin_for_historical_import" on public.cotizaciones;
create policy "cotizaciones_insert_super_admin_for_historical_import"
on public.cotizaciones
for insert
to authenticated
with check (
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

drop policy if exists "requerimientos_insert_super_admin_for_historical_import" on public.requerimientos;
create policy "requerimientos_insert_super_admin_for_historical_import"
on public.requerimientos
for insert
to authenticated
with check (
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

drop policy if exists "requerimiento_items_insert_super_admin_for_historical_import" on public.requerimiento_items;
create policy "requerimiento_items_insert_super_admin_for_historical_import"
on public.requerimiento_items
for insert
to authenticated
with check (
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

-- Nota operativa:
-- historical_import_batches ya cuenta con politicas select/insert/update
-- definidas previamente en el SQL 013.
-- Este archivo solo refuerza el grant update si se necesitara para
-- cambiar el status final del batch durante la rama --execute.

-- Validacion manual 1: grants relevantes.
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'cotizaciones',
    'requerimientos',
    'requerimiento_items',
    'historical_import_batches'
  )
order by table_name, grantee, privilege_type;

-- Validacion manual 2: politicas RLS relevantes.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'cotizaciones',
    'requerimientos',
    'requerimiento_items',
    'historical_import_batches'
  )
order by tablename, policyname;

commit;
