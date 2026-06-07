-- 018_select_por_permisos_modulo.sql
-- Lectura controlada por permisos de módulo.
-- Objetivo:
-- Permitir que usuarios aprobados puedan leer cotizaciones, requerimientos
-- y detalle de requerimientos si tienen can_view = true en admin_module_permissions.
--
-- Importante:
-- - No habilita creación.
-- - No habilita edición.
-- - No habilita eliminación.
-- - No cambia códigos RQ.
-- - No toca importación histórica.
-- - No desactiva RLS.

-- ============================================================
-- 1. COTIZACIONES
-- ============================================================

drop policy if exists cotizaciones_select_by_module_permission
on public.cotizaciones;

create policy cotizaciones_select_by_module_permission
on public.cotizaciones
for select
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
      and amp.can_view = true
  )
);

-- ============================================================
-- 2. REQUERIMIENTOS
-- ============================================================

drop policy if exists requerimientos_select_by_module_permission
on public.requerimientos;

create policy requerimientos_select_by_module_permission
on public.requerimientos
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and amp.module_key = 'requerimientos'
      and amp.can_view = true
  )
);

-- ============================================================
-- 3. DETALLE DE REQUERIMIENTOS / ÍTEMS
-- ============================================================

drop policy if exists requerimiento_items_select_by_module_permission
on public.requerimiento_items;

create policy requerimiento_items_select_by_module_permission
on public.requerimiento_items
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and amp.module_key in ('detalle_rq', 'requerimientos')
      and amp.can_view = true
  )
);

-- ============================================================
-- 4. GRANTS DE LECTURA
-- ============================================================
-- Estos grants no abren la data por sí solos.
-- La lectura sigue controlada por RLS y por las policies anteriores.

grant select on public.cotizaciones to authenticated;
grant select on public.requerimientos to authenticated;
grant select on public.requerimiento_items to authenticated;