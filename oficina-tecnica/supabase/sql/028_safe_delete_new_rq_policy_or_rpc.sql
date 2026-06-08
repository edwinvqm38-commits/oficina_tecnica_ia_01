-- 028_safe_delete_new_rq_policy_or_rpc.sql
-- PROPUESTA NO DESTRUCTIVA PARA REVISION MANUAL.
--
-- Objetivo:
-- - Permitir eliminar fisicamente solo RQ nuevos con formato vigente y sin detalle asociado.
-- - Bloquear siempre RQ historicos como RQ-CJM043-003_2024 o RQ-CJM043-003_2026.
-- - No abrir DELETE general sobre public.requerimientos.
-- - No tocar importacion historica ni datos existentes por si sola.
--
-- IMPORTANTE:
-- Este archivo crea/reemplaza una RPC. No debe ejecutarse automaticamente desde la app.

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

  if v_requirement.codigo !~ '^RQ-[0-9]{4}-[A-Z0-9]+-[A-Z0-9]+-P[0-9]{3}-[0-9]{3}$' then
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
  message := 'RQ nuevo sin detalle eliminado correctamente.';
  return next;
end;
$$;

revoke all on function public.delete_new_requirement_if_empty(uuid) from public;
grant execute on function public.delete_new_requirement_if_empty(uuid) to authenticated;

comment on function public.delete_new_requirement_if_empty(uuid) is
'Elimina fisicamente solo RQ nuevos con formato vigente y sin items/costos/avance, validando usuario aprobado y permiso can_delete_associated_requirements en cotizaciones. No abre DELETE general.';

-- Validacion manual sugerida:
-- select * from public.delete_new_requirement_if_empty('<uuid-rq-nuevo-vacio>');
-- select proname, prosecdef from pg_proc where proname = 'delete_new_requirement_if_empty';

commit;
