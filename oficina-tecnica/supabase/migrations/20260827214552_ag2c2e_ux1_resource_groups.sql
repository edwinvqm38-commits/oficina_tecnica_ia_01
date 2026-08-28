-- AG-2C.2E.UX1 - Soporte de grupos economicos de recursos desde PT.
-- Migracion forward-only local. No aplica RQ, REAL, compras ni linea base.

begin;

alter table public.cotizacion_presupuesto_partidas
  drop constraint if exists cotizacion_presupuesto_partidas_tipo_check;

alter table public.cotizacion_presupuesto_partidas
  add constraint cotizacion_presupuesto_partidas_tipo_check
  check (tipo in ('CAPITULO', 'SUBCAPITULO', 'PARTIDA', 'GRUPO_RECURSOS'));

create or replace function public.validate_cotizacion_presupuesto_partida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_presupuesto_id uuid;
  v_parent_tipo text;
  v_next_parent_id uuid;
  v_cursor_parent_id uuid;
  v_depth integer := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.assert_cotizacion_presupuesto_mutable(old.presupuesto_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  perform public.assert_cotizacion_presupuesto_mutable(new.presupuesto_id);

  if new.tipo = 'CAPITULO' and new.parent_id is not null then
    raise exception 'Un CAPITULO no puede tener parent_id.';
  end if;

  if new.tipo in ('SUBCAPITULO', 'PARTIDA', 'GRUPO_RECURSOS') and new.parent_id is null then
    raise exception 'Una fila % debe tener parent_id.', new.tipo;
  end if;

  if new.parent_id is not null then
    select p.presupuesto_id, p.tipo, p.parent_id
    into v_parent_presupuesto_id, v_parent_tipo, v_next_parent_id
    from public.cotizacion_presupuesto_partidas p
    where p.id = new.parent_id;

    if v_parent_presupuesto_id is null then
      raise exception 'La partida padre no existe.';
    end if;

    if v_parent_presupuesto_id is distinct from new.presupuesto_id then
      raise exception 'La partida padre debe pertenecer al mismo presupuesto.';
    end if;

    if new.tipo = 'SUBCAPITULO' and v_parent_tipo <> 'CAPITULO' then
      raise exception 'Un SUBCAPITULO solo puede depender de un CAPITULO.';
    end if;

    if new.tipo = 'PARTIDA' and v_parent_tipo not in ('CAPITULO', 'SUBCAPITULO') then
      raise exception 'Una PARTIDA solo puede depender de un CAPITULO o SUBCAPITULO.';
    end if;

    if new.tipo = 'GRUPO_RECURSOS' and v_parent_tipo not in ('CAPITULO', 'SUBCAPITULO', 'PARTIDA') then
      raise exception 'Un GRUPO_RECURSOS solo puede depender de CAPITULO, SUBCAPITULO o PARTIDA.';
    end if;

    v_cursor_parent_id := new.parent_id;
    while v_cursor_parent_id is not null loop
      v_depth := v_depth + 1;

      if v_cursor_parent_id = new.id then
        raise exception 'La jerarquia de partidas no puede contener ciclos.';
      end if;

      if v_depth > 20 then
        raise exception 'La jerarquia de partidas excede la profundidad maxima permitida.';
      end if;

      select p.parent_id, p.presupuesto_id
      into v_next_parent_id, v_parent_presupuesto_id
      from public.cotizacion_presupuesto_partidas p
      where p.id = v_cursor_parent_id;

      if v_parent_presupuesto_id is distinct from new.presupuesto_id then
        raise exception 'La jerarquia padre/hijo debe permanecer en el mismo presupuesto.';
      end if;

      v_cursor_parent_id := v_next_parent_id;
    end loop;
  end if;

  if new.tipo not in ('PARTIDA', 'GRUPO_RECURSOS') and exists (
    select 1
    from public.cotizacion_presupuesto_recursos r
    where r.partida_id = new.id
  ) then
    raise exception 'Solo una PARTIDA o GRUPO_RECURSOS puede tener recursos presupuestados.';
  end if;

  if new.tipo = 'PARTIDA' and exists (
    select 1
    from public.cotizacion_presupuesto_partidas child
    where child.parent_id = new.id
      and child.tipo <> 'GRUPO_RECURSOS'
  ) then
    raise exception 'Una PARTIDA solo puede contener GRUPO_RECURSOS.';
  end if;

  if new.tipo = 'SUBCAPITULO' and exists (
    select 1
    from public.cotizacion_presupuesto_partidas child
    where child.parent_id = new.id
      and child.tipo not in ('PARTIDA', 'GRUPO_RECURSOS')
  ) then
    raise exception 'Un SUBCAPITULO solo puede contener PARTIDAS o GRUPO_RECURSOS.';
  end if;

  if new.tipo = 'GRUPO_RECURSOS' and exists (
    select 1
    from public.cotizacion_presupuesto_partidas child
    where child.parent_id = new.id
  ) then
    raise exception 'Un GRUPO_RECURSOS no puede tener hijos.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_cotizacion_presupuesto_recurso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_presupuesto_id uuid;
  v_partida_tipo text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select p.presupuesto_id
    into v_presupuesto_id
    from public.cotizacion_presupuesto_partidas p
    where p.id = old.partida_id;

    perform public.assert_cotizacion_presupuesto_mutable(v_presupuesto_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  select p.presupuesto_id, p.tipo
  into v_presupuesto_id, v_partida_tipo
  from public.cotizacion_presupuesto_partidas p
  where p.id = new.partida_id;

  if v_partida_tipo not in ('PARTIDA', 'GRUPO_RECURSOS') then
    raise exception 'Los recursos presupuestados solo pueden asociarse a PARTIDAS o GRUPO_RECURSOS.';
  end if;

  perform public.assert_cotizacion_presupuesto_mutable(v_presupuesto_id);
  return new;
end;
$$;

create or replace function public.crear_presupuesto_desde_propuesta_tecnica(
  p_propuesta_tecnica_id uuid
)
returns table (
  id uuid,
  cotizacion_id uuid,
  revision integer,
  estado text,
  moneda_codigo text,
  creado_por_user_id uuid,
  creado_at timestamptz,
  actualizado_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_pt public.technical_proposals%rowtype;
  v_cot public.cotizaciones%rowtype;
  v_budget public.cotizacion_presupuestos%rowtype;
  v_next_revision integer;
  v_item record;
  v_resource record;
  v_item_map jsonb := '{}'::jsonb;
  v_resource_group_map jsonb := '{}'::jsonb;
  v_parent_budget_id uuid;
  v_budget_item_id uuid;
  v_resource_group_key text;
  v_resource_group_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Usuario no autenticado para crear presupuesto desde PT.';
  end if;

  if p_propuesta_tecnica_id is null then
    raise exception 'p_propuesta_tecnica_id es obligatorio.';
  end if;

  if not public.can_use_module('cotizaciones', 'edit') then
    raise exception 'No tienes permiso para crear presupuestos de cotizacion.';
  end if;

  if not public.can_use_module('technical_proposals', 'view') then
    raise exception 'No tienes permiso para leer Propuestas Tecnicas.';
  end if;

  select *
  into v_pt
  from public.technical_proposals tp
  where tp.id = p_propuesta_tecnica_id
  for update;

  if v_pt.id is null then
    raise exception 'No existe la Propuesta Tecnica indicada.';
  end if;

  if v_pt.cotizacion_id is null then
    raise exception 'La Propuesta Tecnica no esta vinculada a una cotizacion real.';
  end if;

  if coalesce(v_pt.work_status, '') <> 'Completado' then
    raise exception 'Solo una Propuesta Tecnica completada puede importarse a presupuesto.';
  end if;

  select *
  into v_cot
  from public.cotizaciones c
  where c.id = v_pt.cotizacion_id
    and c.deleted_at is null
  for update;

  if v_cot.id is null then
    raise exception 'No existe la cotizacion asociada a la Propuesta Tecnica.';
  end if;

  if exists (
    select 1
    from public.cotizacion_presupuestos cp
    where cp.propuesta_tecnica_id = v_pt.id
  ) then
    raise exception 'Ya existe un presupuesto originado desde esta revision PT.';
  end if;

  if exists (
    select 1
    from public.technical_proposal_resources tpr
    left join public.technical_proposal_items tpi on tpi.id = tpr.technical_proposal_item_id
    where tpr.technical_proposal_id = v_pt.id
      and (tpi.id is null or tpi.technical_proposal_id <> v_pt.id)
  ) then
    raise exception 'La PT contiene recursos con trazabilidad cruzada inconsistente.';
  end if;

  if exists (
    select 1
    from public.technical_proposal_resources tpr
    where tpr.technical_proposal_id = v_pt.id
      and tpr.resource_id is null
  ) then
    raise exception 'La PT contiene recursos sin recurso_id del catalogo maestro.';
  end if;

  select coalesce(max(cp.revision), 0) + 1
  into v_next_revision
  from public.cotizacion_presupuestos cp
  where cp.cotizacion_id = v_cot.id;

  insert into public.cotizacion_presupuestos (
    cotizacion_id,
    revision,
    estado,
    moneda_codigo,
    creado_por_user_id,
    propuesta_tecnica_id
  )
  values (
    v_cot.id,
    v_next_revision,
    'BORRADOR',
    case when coalesce(v_cot.moneda_codigo, 'PEN') = 'USD' then 'USD' else 'PEN' end,
    v_actor_id,
    v_pt.id
  )
  returning * into v_budget;

  for v_item in
    select tpi.*
    from public.technical_proposal_items tpi
    where tpi.technical_proposal_id = v_pt.id
    order by tpi.sort_order asc, tpi.item_number asc
  loop
    v_parent_budget_id := null;
    if v_item.parent_id is not null then
      v_parent_budget_id := nullif(v_item_map ->> v_item.parent_id::text, '')::uuid;
    end if;

    insert into public.cotizacion_presupuesto_partidas (
      presupuesto_id,
      parent_id,
      codigo,
      tipo,
      descripcion,
      unidad,
      cantidad,
      orden,
      observaciones,
      propuesta_tecnica_item_id
    )
    values (
      v_budget.id,
      v_parent_budget_id,
      v_item.item_number,
      case
        when v_item.item_type = 'group' then 'CAPITULO'
        when v_item.item_type = 'subgroup' then 'SUBCAPITULO'
        else 'PARTIDA'
      end,
      v_item.title,
      case when v_item.item_type = 'activity' then v_item.estimated_time_unit else null end,
      case when v_item.item_type = 'activity' then v_item.estimated_time_value else null end,
      v_item.sort_order,
      v_item.technical_description,
      v_item.id
    )
    returning id into v_budget_item_id;

    v_item_map := v_item_map || jsonb_build_object(v_item.id::text, v_budget_item_id::text);
  end loop;

  for v_resource in
    select
      tpr.*,
      tpi.item_type,
      tpi.item_number,
      tpi.title as item_title,
      tpi.sort_order as item_sort_order
    from public.technical_proposal_resources tpr
    join public.technical_proposal_items tpi on tpi.id = tpr.technical_proposal_item_id
    where tpr.technical_proposal_id = v_pt.id
      and tpi.technical_proposal_id = v_pt.id
    order by tpi.sort_order asc, tpr.resource_category asc, tpr.sort_order asc
  loop
    v_budget_item_id := nullif(v_item_map ->> v_resource.technical_proposal_item_id::text, '')::uuid;

    if v_budget_item_id is null then
      raise exception 'No se pudo resolver el nodo presupuestal destino para un recurso PT.';
    end if;

    if v_resource.item_type <> 'activity' then
      v_resource_group_key := v_resource.technical_proposal_item_id::text || ':' || coalesce(nullif(v_resource.resource_category, ''), 'recursos');
      v_resource_group_id := nullif(v_resource_group_map ->> v_resource_group_key, '')::uuid;

      if v_resource_group_id is null then
        insert into public.cotizacion_presupuesto_partidas (
          presupuesto_id,
          parent_id,
          codigo,
          tipo,
          descripcion,
          unidad,
          cantidad,
          orden,
          observaciones,
          propuesta_tecnica_item_id
        )
        values (
          v_budget.id,
          v_budget_item_id,
          concat_ws('.', v_resource.item_number, 'R'),
          'GRUPO_RECURSOS',
          upper(coalesce(nullif(v_resource.resource_category, ''), 'Recursos')),
          null,
          null,
          coalesce(v_resource.item_sort_order, 0) * 1000 + coalesce(v_resource.sort_order, 0),
          'Grupo economico generado desde recursos PT asociados a titulo/subtitulo.',
          v_resource.technical_proposal_item_id
        )
        returning id into v_resource_group_id;

        v_resource_group_map := v_resource_group_map || jsonb_build_object(v_resource_group_key, v_resource_group_id::text);
      end if;

      v_budget_item_id := v_resource_group_id;
    end if;

    insert into public.cotizacion_presupuesto_recursos (
      partida_id,
      recurso_id,
      cantidad_presupuestada,
      precio_base_unitario,
      precio_ofertado_unitario,
      orden,
      observaciones,
      propuesta_tecnica_recurso_id,
      codigo_recurso_snapshot,
      codigo_fabricante_snapshot,
      descripcion_snapshot,
      tipo_recurso_snapshot,
      unidad_snapshot,
      precio_unitario_ref_snapshot,
      moneda_codigo_snapshot,
      proveedor_snapshot,
      marca_snapshot
    )
    values (
      v_budget_item_id,
      v_resource.resource_id,
      greatest(coalesce(v_resource.cantidad, 1), 0.0001),
      0,
      0,
      v_resource.sort_order,
      concat_ws(' | ', nullif(v_resource.comentario, ''), case when v_resource.tiempo is not null then 'Tiempo PT: ' || v_resource.tiempo::text else null end),
      v_resource.id,
      v_resource.codigo_recurso,
      v_resource.codigo_fabricante,
      v_resource.descripcion,
      v_resource.tipo_recurso,
      v_resource.unidad,
      v_resource.precio_unitario_ref,
      v_resource.moneda_codigo,
      v_resource.proveedor,
      v_resource.marca
    );
  end loop;

  return query
  select
    v_budget.id,
    v_budget.cotizacion_id,
    v_budget.revision,
    v_budget.estado,
    v_budget.moneda_codigo,
    v_budget.creado_por_user_id,
    v_budget.creado_at,
    v_budget.actualizado_at;
end;
$$;

revoke all on function public.crear_presupuesto_desde_propuesta_tecnica(uuid) from public;
revoke all on function public.crear_presupuesto_desde_propuesta_tecnica(uuid) from anon;
revoke all on function public.crear_presupuesto_desde_propuesta_tecnica(uuid) from service_role;
grant execute on function public.crear_presupuesto_desde_propuesta_tecnica(uuid) to authenticated;

comment on column public.cotizacion_presupuesto_partidas.tipo is
  'CAPITULO, SUBCAPITULO, PARTIDA o GRUPO_RECURSOS. GRUPO_RECURSOS representa recursos PT asociados a titulo/subtitulo/partida sin inventar actividades.';

commit;
