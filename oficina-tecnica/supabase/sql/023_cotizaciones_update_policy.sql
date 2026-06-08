-- 023_cotizaciones_update_policy.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Habilita edicion controlada de cotizaciones existentes desde /cotizaciones.
--
-- Alcance:
-- - habilita UPDATE solo para authenticated
-- - mantiene RLS activo
-- - no toca politicas SELECT ni INSERT existentes
-- - no toca requerimientos, codigos RQ ni importacion historica
-- - exige usuario aprobado con can_edit = true para el modulo cotizaciones
-- - permite super admin / fallback temporal edwin.qm@outlook.com

begin;

alter table public.cotizaciones enable row level security;

-- GRANT minimo base. RLS sigue aplicando la restriccion final.
grant update on public.cotizaciones to authenticated;

-- Edicion controlada por permisos administrativos del modulo Cotizaciones.
drop policy if exists "cotizaciones_update_by_module_permission"
on public.cotizaciones;

create policy "cotizaciones_update_by_module_permission"
on public.cotizaciones
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and amp.module_key = 'cotizaciones'
      and amp.can_edit = true
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and amp.module_key = 'cotizaciones'
      and amp.can_edit = true
  )
);

-- Fallback operativo para administradores globales y cuenta temporal del proyecto.
drop policy if exists "cotizaciones_update_super_admin"
on public.cotizaciones;

create policy "cotizaciones_update_super_admin"
on public.cotizaciones
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
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
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
      )
  )
);

-- Validacion manual 1: grant UPDATE para authenticated.
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'cotizaciones'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE'
order by privilege_type;

-- Validacion manual 2: politicas UPDATE creadas.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'cotizaciones'
  and policyname in (
    'cotizaciones_update_by_module_permission',
    'cotizaciones_update_super_admin'
  )
order by policyname;

commit;
