-- 029_fix_delete_new_rq_legacy_code_pattern.sql
-- PROPUESTA NO DESTRUCTIVA PARA REVISION MANUAL.
--
-- Objetivo:
-- - Mantener como formato vigente de creacion: RQ-YYYY-CLIENTE-UNIDAD-PNNN-NNN.
-- - Permitir eliminar tambien RQ nuevos mal generados previamente con 4 digitos finales:
--   RQ-YYYY-CLIENTE-UNIDAD-PNNN-NNNN.
-- - Bloquear siempre codigos historicos como RQ-CJM043-003_2024 o RQ-CJM043-003_2026.
-- - Mantener validacion de usuario, perfil aprobado, permiso administrable, items, costos y avance.
-- - No abrir DELETE general.
--
-- IMPORTANTE:
-- Este archivo actualiza la RPC public.delete_new_requirement_if_empty(uuid).
-- No ejecutarlo automaticamente desde la app.

begin;

create or replace function public.delete_new_requirement_if_empty(p_requirement_id uuid)
returns table (
  success boolean,
  message text,
  deleted_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email text;
  v_is_allowed boolean := false;
  v_requirement public.requerimientos%rowtype;
  v_item_count integer := 0;
  v_is_new_current_format boolean := false;
  v_is_new_legacy_bug_format boolean := false;
  v_is_historical_format boolean := false;
begin
  if auth.uid() is null then
    success := false;
    message := 'Usuario no autenticado.';
    deleted_code := null;
    return next;
    return;
  end if;

  select lower(trim(up.email))
  into v_user_email
  from public.user_profiles up
  where up.id = auth.uid()
    and lower(up.status::text) = 'approved'
  limit 1;

  if v_user_email is null then
    success := false;
    message := 'Usuario no aprobado para eliminar RQ.';
    deleted_code := null;
    return next;
    return;
  end if;

  select exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and lower(amp.module_key) = 'cotizaciones'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or (
          amp.can_view is true
          and coalesce(
            amp.metadata #>> '{module_sensitive_permissions,cotizaciones,can_delete_associated_requirements}',
            'false'
          ) = 'true'
        )
      )
  )
  into v_is_allowed;

  if v_is_allowed is not true then
    success := false;
    message := 'No tienes permiso para eliminar RQ asociados.';
    deleted_code := null;
    return next;
    return;
  end if;

  select *
  into v_requirement
  from public.requerimientos r
  where r.id = p_requirement_id
    and r.deleted_at is null
  for update;

  if not found then
    success := false;
    message := 'El requerimiento no existe o ya fue eliminado.';
    deleted_code := null;
    return next;
    return;
  end if;

  deleted_code := v_requirement.codigo;
  v_is_new_current_format := v_requirement.codigo ~ '^RQ-[0-9]{4}-[A-Z0-9]+-[A-Z0-9]+-P[0-9]{3}-[0-9]{3}$';
  v_is_new_legacy_bug_format := v_requirement.codigo ~ '^RQ-[0-9]{4}-[A-Z0-9]+-[A-Z0-9]+-P[0-9]{3}-[0-9]{4}$';
  v_is_historical_format := v_requirement.codigo ~ '^RQ-[A-Z]{3}[0-9]{3}-[0-9]{3}_[0-9]{4}$';

  if v_is_historical_format or (v_is_new_current_format is not true and v_is_new_legacy_bug_format is not true) then
    success := false;
    message := 'RQ historico conservado. No se elimina desde esta vista.';
    return next;
    return;
  end if;

  select count(*)
  into v_item_count
  from public.requerimiento_items ri
  where ri.requerimiento_id = p_requirement_id
    and ri.deleted_at is null;

  if v_item_count > 0 then
    success := false;
    message := 'No se elimino el RQ porque tiene items/detalle asociado. Usa anulacion controlada en una fase posterior.';
    return next;
    return;
  end if;

  if coalesce(v_requirement.total_rq, 0) <> 0 or coalesce(v_requirement.avance, 0) <> 0 then
    success := false;
    message := 'No se elimino el RQ porque tiene costos, avance o trazabilidad operacional en cabecera.';
    return next;
    return;
  end if;

  delete from public.requerimientos
  where id = p_requirement_id;

  success := true;
  message := case
    when v_is_new_legacy_bug_format then 'RQ nuevo legacy sin detalle eliminado correctamente.'
    else 'RQ nuevo sin detalle eliminado correctamente.'
  end;
  return next;
end;
$$;

revoke all on function public.delete_new_requirement_if_empty(uuid) from public;
grant execute on function public.delete_new_requirement_if_empty(uuid) to authenticated;

comment on function public.delete_new_requirement_if_empty(uuid) is
'Elimina fisicamente solo RQ nuevos con formato vigente de 3 digitos o formato nuevo legacy bug de 4 digitos, sin items/costos/avance, validando usuario aprobado y permiso can_delete_associated_requirements. Bloquea historicos y no abre DELETE general.';

commit;

-- ============================================================
-- CONSULTAS MANUALES DE DIAGNOSTICO, NO EJECUTAR EN BLOQUE
-- ============================================================

-- 1. Perfil y usuario aprobado. En Supabase SQL Editor, reemplaza el email si no hay contexto auth.uid().
-- select id, email, role, status, is_super_admin
-- from public.user_profiles
-- where lower(email) = lower('edwin.qm@outlook.com');

-- 2. Permiso exacto guardado para Cotizaciones.
-- select
--   user_email,
--   module_key,
--   can_view,
--   metadata,
--   metadata #>> '{module_sensitive_permissions,cotizaciones,can_delete_associated_requirements}' as can_delete_associated_requirements
-- from public.admin_module_permissions
-- where lower(user_email) = lower('edwin.qm@outlook.com')
--   and lower(module_key) = 'cotizaciones';

-- 3. Estado del RQ objetivo.
-- select
--   id,
--   codigo,
--   total_rq,
--   avance,
--   deleted_at,
--   codigo ~ '^RQ-[0-9]{4}-[A-Z0-9]+-[A-Z0-9]+-P[0-9]{3}-[0-9]{3}$' as is_new_current_3_digits,
--   codigo ~ '^RQ-[0-9]{4}-[A-Z0-9]+-[A-Z0-9]+-P[0-9]{3}-[0-9]{4}$' as is_new_legacy_bug_4_digits,
--   codigo ~ '^RQ-[A-Z]{3}[0-9]{3}-[0-9]{3}_[0-9]{4}$' as is_historical
-- from public.requerimientos
-- where codigo = 'RQ-2026-NEXA-PCON-P001-0003';

-- 4. Items asociados al RQ objetivo.
-- select count(*) as active_item_count
-- from public.requerimiento_items ri
-- join public.requerimientos r on r.id = ri.requerimiento_id
-- where r.codigo = 'RQ-2026-NEXA-PCON-P001-0003'
--   and ri.deleted_at is null;

-- 5. Prueba controlada de RPC desde sesion autenticada de la app o SQL con contexto auth disponible.
-- select * from public.delete_new_requirement_if_empty('<uuid-rq-nuevo-vacio>');
