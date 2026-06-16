-- 037_admin_readonly_bypass_PROPOSED.sql
-- ESTADO: PROPUESTO — NO EJECUTADO EN SUPABASE.
-- Este archivo es solo una propuesta para revisión humana. No fue corrido
-- contra ninguna base de datos real como parte de este diagnóstico.
--
-- Objetivo:
-- Permitir que un usuario admin (is_super_admin = true o role = 'admin' en
-- user_profiles) pueda leer cotizaciones/requerimientos/requerimiento_items
-- SIN depender de una fila en admin_module_permissions, agregando una
-- condición "or" de bypass a las policies de SELECT existentes (ver
-- 018_select_por_permisos_modulo.sql). No otorga create/update/delete.
--
-- Importante:
-- - Solo agrega una condición OR a las policies de SELECT ya existentes.
-- - No habilita creación, edición ni eliminación.
-- - No cambia códigos RQ ni importación histórica.
-- - No desactiva RLS.
-- - Requiere revisión y ejecución manual deliberada; no se ejecutó aquí.

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
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (up.is_super_admin is true or up.role::text = 'admin')
  )
  or exists (
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
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (up.is_super_admin is true or up.role::text = 'admin')
  )
  or exists (
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
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (up.is_super_admin is true or up.role::text = 'admin')
  )
  or exists (
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
