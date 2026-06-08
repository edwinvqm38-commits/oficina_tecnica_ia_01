-- 011_admin_permissions_management.sql
-- Habilita gestion de permisos por modulo (INSERT/UPDATE) solo para administradores autorizados.
-- No habilita DELETE. Mantiene lectura segun politicas existentes de la fase anterior.

begin;
grant select, insert, update on public.admin_module_permissions to authenticated;
alter table public.admin_module_permissions enable row level security;

-- Politica de insercion para administradores/super admin aprobados.
drop policy if exists "admin_module_permissions_insert_admin" on public.admin_module_permissions;
create policy "admin_module_permissions_insert_admin"
on public.admin_module_permissions
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
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
      )
  )
);

-- Politica de actualizacion para administradores/super admin aprobados.
drop policy if exists "admin_module_permissions_update_admin" on public.admin_module_permissions;
create policy "admin_module_permissions_update_admin"
on public.admin_module_permissions
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.status::text = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
      )
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.status::text = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
      )
  )
);

-- Validacion de politicas activas.
select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'admin_module_permissions'
order by policyname;

commit;
