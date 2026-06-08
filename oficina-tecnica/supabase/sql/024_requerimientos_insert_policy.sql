-- 024_requerimientos_insert_policy.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Habilita el permiso INSERT controlado para el módulo de Requerimientos.
--
-- Alcance:
-- - Otorga permiso de inserción al rol 'authenticated'.
-- - Crea política de RLS para validar que el usuario esté aprobado y tenga can_create = true.
-- - Mantiene compatibilidad con Super Admins y el fallback de administración.
-- - No afecta políticas de SELECT ni políticas históricas de importación.

begin;

-- ============================================================
-- 1. OTORGAR PERMISOS BASE
-- ============================================================
-- El rol authenticated requiere el permiso de INSERT a nivel de tabla
-- para que el motor de políticas RLS sea evaluado.
grant insert on table public.requerimientos to authenticated;

-- ============================================================
-- 2. POLÍTICA DE INSERCIÓN CONTROLADA
-- ============================================================
-- Esta política valida el estado del perfil y el permiso explícito en el módulo.

drop policy if exists "requerimientos_insert_by_module_permission" on public.requerimientos;

create policy "requerimientos_insert_by_module_permission"
on public.requerimientos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and lower(amp.module_key) = 'requerimientos'
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

comment on policy "requerimientos_insert_by_module_permission" on public.requerimientos is 
'Permite insertar nuevos requerimientos solo a usuarios autenticados con perfil aprobado y permiso can_create en el módulo requerimientos.';

-- ============================================================
-- 3. CONSULTAS DE VALIDACIÓN (POST-EJECUCIÓN)
-- ============================================================

-- A. Validar grant INSERT para authenticated
select grantee, privilege_type 
from information_schema.role_table_grants 
where table_name = 'requerimientos' 
  and grantee = 'authenticated' 
  and privilege_type = 'INSERT';

-- B. Validar todas las políticas de tipo INSERT en la tabla
select policyname, cmd, roles 
from pg_policies 
where tablename = 'requerimientos' 
  and cmd = 'INSERT';

-- C. Confirmar existencia de la política específica creada en este script
select count(*) = 1 as policy_exists
from pg_policies 
where policyname = 'requerimientos_insert_by_module_permission';

commit;