-- AG-2C.2D - Vinculacion transaccional del presupuesto adjudicado.
-- No crea linea base, snapshots, RQ, REAL ni control de cambios contractual.

begin;

alter table public.proyectos_adjudicados
  add column if not exists presupuesto_adjudicado_id uuid null;

alter table public.proyectos_adjudicados
  drop constraint if exists proyectos_adjudicados_presupuesto_adjudicado_fkey;

alter table public.proyectos_adjudicados
  add constraint proyectos_adjudicados_presupuesto_adjudicado_fkey
  foreign key (presupuesto_adjudicado_id)
  references public.cotizacion_presupuestos(id)
  on delete restrict;

create unique index if not exists proyectos_adjudicados_presupuesto_adjudicado_unique
  on public.proyectos_adjudicados (presupuesto_adjudicado_id)
  where presupuesto_adjudicado_id is not null;

create index if not exists proyectos_adjudicados_presupuesto_adjudicado_idx
  on public.proyectos_adjudicados (presupuesto_adjudicado_id);

create unique index if not exists cotizacion_presupuestos_unico_adjudicado_idx
  on public.cotizacion_presupuestos (cotizacion_id)
  where estado = 'ADJUDICADO';

create or replace function public.validate_proyecto_presupuesto_adjudicado()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_budget_cotizacion_id uuid;
  v_budget_estado text;
begin
  if new.presupuesto_adjudicado_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if current_user in ('anon', 'authenticated') then
      raise exception 'El presupuesto adjudicado solo puede vincularse mediante la confirmacion contractual controlada.';
    end if;
  elsif old.presupuesto_adjudicado_id is distinct from new.presupuesto_adjudicado_id
     or old.cotizacion_id is distinct from new.cotizacion_id then
    if current_user in ('anon', 'authenticated') then
      raise exception 'El presupuesto adjudicado solo puede vincularse mediante la confirmacion contractual controlada.';
    end if;
  end if;

  select cp.cotizacion_id, cp.estado
  into v_budget_cotizacion_id, v_budget_estado
  from public.cotizacion_presupuestos cp
  where cp.id = new.presupuesto_adjudicado_id;

  if v_budget_cotizacion_id is null then
    raise exception 'El presupuesto adjudicado seleccionado no existe.';
  end if;

  if new.cotizacion_id is not null and new.cotizacion_id is distinct from v_budget_cotizacion_id then
    raise exception 'El presupuesto adjudicado no pertenece a la cotizacion del proyecto adjudicado.';
  end if;

  if v_budget_estado <> 'ADJUDICADO' then
    raise exception 'El presupuesto vinculado al proyecto debe estar en estado ADJUDICADO.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_proyecto_presupuesto_adjudicado
  on public.proyectos_adjudicados;
create trigger validate_proyecto_presupuesto_adjudicado
before insert or update of presupuesto_adjudicado_id, cotizacion_id
on public.proyectos_adjudicados
for each row execute function public.validate_proyecto_presupuesto_adjudicado();

create or replace function public.validate_cotizacion_presupuesto_estado()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'ADJUDICADO' then
      raise exception 'No se puede eliminar un presupuesto adjudicado.';
    end if;

    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.creado_por_user_id is null then
      new.creado_por_user_id := auth.uid();
    end if;

    if new.creado_por_user_id is null then
      raise exception 'creado_por_user_id es obligatorio para crear presupuesto.';
    end if;

    if new.estado <> 'BORRADOR' then
      raise exception 'Un presupuesto nuevo debe iniciar en BORRADOR.';
    end if;

    return new;
  end if;

  if old.estado = 'ADJUDICADO' then
    raise exception 'No se puede modificar un presupuesto adjudicado.';
  end if;

  if old.estado is distinct from new.estado then
    if old.estado = 'BORRADOR' and new.estado = 'LISTO_PARA_ADJUDICAR' then
      if not public.cotizacion_presupuesto_estructura_valida(new.id) then
        raise exception 'El presupuesto no tiene estructura valida para pasar a LISTO_PARA_ADJUDICAR.';
      end if;
    elsif old.estado = 'LISTO_PARA_ADJUDICAR' and new.estado = 'BORRADOR' then
      null;
    elsif old.estado = 'LISTO_PARA_ADJUDICAR' and new.estado = 'ADJUDICADO' then
      if current_user in ('anon', 'authenticated') then
        raise exception 'Un presupuesto solo puede pasar a ADJUDICADO mediante la confirmacion contractual controlada.';
      end if;

      if not public.cotizacion_presupuesto_estructura_valida(new.id) then
        raise exception 'El presupuesto no tiene estructura valida para pasar a ADJUDICADO.';
      end if;
    else
      raise exception 'Transicion de estado de presupuesto no permitida: % -> %.', old.estado, new.estado;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.marcar_cotizacion_presupuesto_listo(
  p_presupuesto_id uuid
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
  v_budget public.cotizacion_presupuestos%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Usuario no autenticado para marcar presupuesto listo.';
  end if;

  if p_presupuesto_id is null then
    raise exception 'p_presupuesto_id es obligatorio.';
  end if;

  if not public.can_use_module('cotizaciones', 'edit') then
    raise exception 'No tienes permiso para editar presupuestos de cotizacion.';
  end if;

  select *
  into v_budget
  from public.cotizacion_presupuestos cp
  where cp.id = p_presupuesto_id
  for update;

  if v_budget.id is null then
    raise exception 'No se encontro el presupuesto.';
  end if;

  if v_budget.estado <> 'BORRADOR' then
    raise exception 'Solo un presupuesto en BORRADOR puede marcarse como LISTO_PARA_ADJUDICAR.';
  end if;

  if not public.cotizacion_presupuesto_estructura_valida(v_budget.id) then
    raise exception 'El presupuesto no tiene estructura valida para pasar a LISTO_PARA_ADJUDICAR.';
  end if;

  update public.cotizacion_presupuestos cp
  set estado = 'LISTO_PARA_ADJUDICAR'
  where cp.id = v_budget.id
  returning
    cp.id,
    cp.cotizacion_id,
    cp.revision,
    cp.estado,
    cp.moneda_codigo,
    cp.creado_por_user_id,
    cp.creado_at,
    cp.actualizado_at
  into
    id,
    cotizacion_id,
    revision,
    estado,
    moneda_codigo,
    creado_por_user_id,
    creado_at,
    actualizado_at;

  return next;
end;
$$;

create or replace function public.devolver_cotizacion_presupuesto_borrador(
  p_presupuesto_id uuid
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
  v_budget public.cotizacion_presupuestos%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Usuario no autenticado para devolver presupuesto a borrador.';
  end if;

  if p_presupuesto_id is null then
    raise exception 'p_presupuesto_id es obligatorio.';
  end if;

  if not public.can_use_module('cotizaciones', 'edit') then
    raise exception 'No tienes permiso para editar presupuestos de cotizacion.';
  end if;

  select *
  into v_budget
  from public.cotizacion_presupuestos cp
  where cp.id = p_presupuesto_id
  for update;

  if v_budget.id is null then
    raise exception 'No se encontro el presupuesto.';
  end if;

  if v_budget.estado <> 'LISTO_PARA_ADJUDICAR' then
    raise exception 'Solo un presupuesto LISTO_PARA_ADJUDICAR puede volver a BORRADOR.';
  end if;

  update public.cotizacion_presupuestos cp
  set estado = 'BORRADOR'
  where cp.id = v_budget.id
  returning
    cp.id,
    cp.cotizacion_id,
    cp.revision,
    cp.estado,
    cp.moneda_codigo,
    cp.creado_por_user_id,
    cp.creado_at,
    cp.actualizado_at
  into
    id,
    cotizacion_id,
    revision,
    estado,
    moneda_codigo,
    creado_por_user_id,
    creado_at,
    actualizado_at;

  return next;
end;
$$;

drop function if exists public.confirmar_adjudicacion_cotizacion(uuid, uuid, text);

create or replace function public.confirmar_adjudicacion_cotizacion(
  p_cotizacion_id uuid,
  p_presupuesto_id uuid,
  p_propuesta_tecnica_id uuid default null,
  p_event_message text default null
)
returns table (
  id text,
  anio integer,
  codigo_proyecto text,
  cotizacion text,
  oc text,
  cliente text,
  codigo_cliente text,
  unidad_trabajo text,
  codigo_unidad text,
  fecha_adjudicacion date,
  estado text,
  activo boolean,
  cotizacion_id uuid,
  propuesta_tecnica_id uuid,
  revision_adjudicada text,
  presupuesto_adjudicado_id uuid,
  fecha_confirmacion_adjudicacion timestamptz,
  confirmado_por_user_id uuid,
  confirmado_por_email text,
  adjudicacion_metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_cot public.cotizaciones%rowtype;
  v_budget public.cotizacion_presupuestos%rowtype;
  v_budget_previous_estado text;
  v_budget_result_estado text;
  v_project public.proyectos_adjudicados%rowtype;
  v_existing_id text;
  v_conflicting_project_id text;
  v_conflicting_budget_id uuid;
  v_pt record;
  v_revision text := null;
  v_estado_proyecto text;
  v_anio integer;
  v_codigo_cliente text;
  v_codigo_unidad text;
  v_codigo_proyecto text;
  v_max_project integer;
  v_event jsonb;
  v_requires_pt boolean;
  v_no_pt_justification text;
  v_no_pt_user_id uuid;
  v_no_pt_decided_at timestamptz;
  v_project_previous_budget_id uuid;
  v_project_had_same_budget boolean := false;
begin
  if v_actor_id is null then
    raise exception 'Usuario no autenticado para confirmar adjudicacion.';
  end if;

  if p_cotizacion_id is null then
    raise exception 'p_cotizacion_id es obligatorio.';
  end if;

  if p_presupuesto_id is null then
    raise exception 'p_presupuesto_id es obligatorio para confirmar adjudicacion.';
  end if;

  if not public.can_use_module('cotizaciones', 'edit') then
    raise exception 'No tienes permiso para confirmar adjudicaciones de cotizaciones.';
  end if;

  select up.email
  into v_actor_email
  from public.user_profiles up
  where up.id = v_actor_id
  limit 1;

  v_actor_email := coalesce(v_actor_email, auth.jwt() ->> 'email');

  select *
  into v_cot
  from public.cotizaciones c
  where c.id = p_cotizacion_id
    and c.deleted_at is null
  for update;

  if v_cot.id is null then
    raise exception 'No existe la cotizacion indicada.';
  end if;

  if lower(trim(coalesce(v_cot.estado, ''))) not in ('ganada', 'adjudicado') then
    raise exception 'La cotizacion debe estar en estado Ganada para confirmar adjudicacion.';
  end if;

  select *
  into v_budget
  from public.cotizacion_presupuestos cp
  where cp.id = p_presupuesto_id
  for update;

  if v_budget.id is null then
    raise exception 'El presupuesto adjudicado seleccionado no existe.';
  end if;

  if v_budget.cotizacion_id is distinct from v_cot.id then
    raise exception 'El presupuesto adjudicado seleccionado no pertenece a la cotizacion.';
  end if;

  v_budget_previous_estado := v_budget.estado;

  if not public.cotizacion_presupuesto_estructura_valida(v_budget.id) then
    raise exception 'El presupuesto adjudicado no tiene estructura valida.';
  end if;

  select pa.id
  into v_existing_id
  from public.proyectos_adjudicados pa
  where pa.cotizacion_id = v_cot.id
    and pa.activo = true
  order by pa.updated_at desc
  limit 1
  for update;

  if v_existing_id is null then
    select pa.id
    into v_existing_id
    from public.proyectos_adjudicados pa
    where pa.cotizacion_id is null
      and pa.activo = true
      and pa.cotizacion = v_cot.codigo
    order by pa.updated_at desc
    limit 1
    for update;
  end if;

  if v_existing_id is not null then
    select *
    into v_project
    from public.proyectos_adjudicados pa
    where pa.id = v_existing_id
    for update;

    v_project_previous_budget_id := v_project.presupuesto_adjudicado_id;

    if v_project.presupuesto_adjudicado_id is not null
       and v_project.presupuesto_adjudicado_id is distinct from v_budget.id then
      raise exception 'El proyecto adjudicado ya tiene un presupuesto adjudicado diferente. Use gestion de cambios contractual.';
    end if;

    v_project_had_same_budget := v_project.presupuesto_adjudicado_id is not null
      and v_project.presupuesto_adjudicado_id = v_budget.id;
  end if;

  select pa.id
  into v_conflicting_project_id
  from public.proyectos_adjudicados pa
  where pa.presupuesto_adjudicado_id = v_budget.id
    and (v_existing_id is null or pa.id <> v_existing_id)
  limit 1
  for update;

  if v_conflicting_project_id is not null then
    raise exception 'El presupuesto adjudicado ya esta vinculado a otro proyecto adjudicado.';
  end if;

  select cp.id
  into v_conflicting_budget_id
  from public.cotizacion_presupuestos cp
  where cp.cotizacion_id = v_cot.id
    and cp.estado = 'ADJUDICADO'
    and cp.id <> v_budget.id
  limit 1
  for update;

  if v_conflicting_budget_id is not null then
    raise exception 'La cotizacion ya tiene otro presupuesto adjudicado. Use gestion de cambios contractual.';
  end if;

  if v_project_had_same_budget then
    if v_budget.estado <> 'ADJUDICADO' then
      raise exception 'El proyecto ya referencia el presupuesto indicado, pero el presupuesto no esta ADJUDICADO.';
    end if;
  elsif v_budget.estado <> 'LISTO_PARA_ADJUDICAR' then
    raise exception 'El presupuesto debe estar en estado LISTO_PARA_ADJUDICAR para confirmar adjudicacion.';
  end if;

  v_requires_pt := coalesce(v_cot.requiere_propuesta_tecnica, true);
  v_no_pt_justification := nullif(trim(coalesce(v_cot.no_requiere_pt_justificacion, '')), '');
  v_no_pt_user_id := v_cot.no_requiere_pt_decidido_por_user_id;
  v_no_pt_decided_at := v_cot.no_requiere_pt_decidido_at;

  if p_propuesta_tecnica_id is not null then
    if not public.can_use_module('technical_proposals', 'view') then
      raise exception 'No tienes permiso para seleccionar propuestas tecnicas.';
    end if;

    select tp.id, tp.cotizacion_id, tp.cotizacion_codigo, tp.revision
    into v_pt
    from public.technical_proposals tp
    where tp.id = p_propuesta_tecnica_id
    for update;

    if v_pt.id is null then
      raise exception 'La propuesta tecnica seleccionada no existe.';
    end if;

    if v_pt.cotizacion_id is distinct from v_cot.id then
      raise exception 'La propuesta tecnica seleccionada no pertenece a la cotizacion.';
    end if;

    if v_pt.cotizacion_codigo is distinct from v_cot.codigo then
      raise exception 'La propuesta tecnica seleccionada no corresponde al codigo de cotizacion.';
    end if;

    v_revision := v_pt.revision;
  end if;

  if v_existing_id is not null
     and v_project.propuesta_tecnica_id is not null
     and p_propuesta_tecnica_id is not null
     and v_project.propuesta_tecnica_id is distinct from p_propuesta_tecnica_id then
    raise exception 'El proyecto adjudicado ya tiene una Propuesta Tecnica adjudicada diferente. Use gestion de cambios contractual.';
  end if;

  if v_requires_pt
     and p_propuesta_tecnica_id is null
     and (v_existing_id is null or v_project.propuesta_tecnica_id is null) then
    raise exception 'Esta cotizacion requiere una Propuesta Tecnica. Registre y seleccione la PT adjudicada antes de confirmar la adjudicacion.';
  end if;

  if not v_requires_pt
     and (v_no_pt_justification is null or v_no_pt_user_id is null or v_no_pt_decided_at is null) then
    raise exception 'La decision No requiere Propuesta Tecnica debe tener justificacion, usuario y fecha de decision.';
  end if;

  if not v_project_had_same_budget then
    update public.cotizacion_presupuestos cp
    set estado = 'ADJUDICADO'
    where cp.id = v_budget.id
    returning * into v_budget;
  end if;

  v_budget_result_estado := v_budget.estado;

  v_estado_proyecto := case
    when p_propuesta_tecnica_id is not null then 'Activo'
    when v_existing_id is not null and v_project.propuesta_tecnica_id is not null then 'Activo'
    when not v_requires_pt then 'Activo'
    else 'Pendiente de revisión adjudicada'
  end;

  if v_existing_id is not null then
    v_event := jsonb_build_object(
      'at', now(),
      'actor_id', v_actor_id,
      'actor_email', v_actor_email,
      'message', coalesce(p_event_message, 'Confirmacion de adjudicacion'),
      'previous', jsonb_build_object(
        'cotizacion_id', v_project.cotizacion_id,
        'propuesta_tecnica_id', v_project.propuesta_tecnica_id,
        'revision_adjudicada', v_project.revision_adjudicada,
        'presupuesto_adjudicado_id', v_project_previous_budget_id,
        'presupuesto_estado', v_budget_previous_estado,
        'estado', v_project.estado
      ),
      'next', jsonb_build_object(
        'cotizacion_id', v_cot.id,
        'propuesta_tecnica_id', coalesce(p_propuesta_tecnica_id, v_project.propuesta_tecnica_id),
        'revision_adjudicada', coalesce(v_revision, v_project.revision_adjudicada),
        'presupuesto_adjudicado_id', v_budget.id,
        'presupuesto_revision', v_budget.revision,
        'presupuesto_estado', v_budget_result_estado,
        'estado', v_estado_proyecto,
        'requiere_propuesta_tecnica', v_requires_pt,
        'no_requiere_pt_decidido_por_user_id', case when v_requires_pt then null else v_no_pt_user_id end,
        'no_requiere_pt_decidido_at', case when v_requires_pt then null else v_no_pt_decided_at end
      )
    );

    update public.proyectos_adjudicados pa
    set
      cotizacion_id = v_cot.id,
      cotizacion = v_cot.codigo,
      oc = coalesce(v_cot.oc, pa.oc, ''),
      cliente = coalesce(v_cot.cliente_nombre, pa.cliente, ''),
      unidad_trabajo = coalesce(v_cot.unidad_trabajo_nombre, pa.unidad_trabajo, ''),
      propuesta_tecnica_id = coalesce(p_propuesta_tecnica_id, pa.propuesta_tecnica_id),
      revision_adjudicada = coalesce(v_revision, pa.revision_adjudicada),
      presupuesto_adjudicado_id = v_budget.id,
      estado = v_estado_proyecto,
      fecha_confirmacion_adjudicacion = coalesce(pa.fecha_confirmacion_adjudicacion, now()),
      confirmado_por_user_id = coalesce(pa.confirmado_por_user_id, v_actor_id),
      confirmado_por_email = coalesce(pa.confirmado_por_email, v_actor_email),
      adjudicacion_metadata =
        coalesce(pa.adjudicacion_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'last_confirmed_at', now(),
          'last_confirmed_by', v_actor_email,
          'last_event_message', coalesce(p_event_message, 'Confirmacion de adjudicacion'),
          'legacy_text_match_promoted', pa.cotizacion_id is null,
          'requiere_propuesta_tecnica', v_requires_pt,
          'no_requiere_pt_justificacion', case when v_requires_pt then null else v_no_pt_justification end,
          'no_requiere_pt_decidido_por_user_id', case when v_requires_pt then null else v_no_pt_user_id end,
          'no_requiere_pt_decidido_at', case when v_requires_pt then null else v_no_pt_decided_at end,
          'presupuesto_adjudicado_id', v_budget.id,
          'presupuesto_revision', v_budget.revision
        )
        || jsonb_build_object(
          'events',
          coalesce(pa.adjudicacion_metadata -> 'events', '[]'::jsonb) || jsonb_build_array(v_event)
        )
    where pa.id = v_existing_id
    returning * into v_project;
  else
    v_anio := coalesce(
      extract(year from v_cot.fecha_oc)::integer,
      extract(year from v_cot.fecha_entregada)::integer,
      extract(year from v_cot.fecha_entrega)::integer,
      extract(year from current_date)::integer
    );

    v_codigo_cliente := nullif(trim(coalesce(v_cot.metadata ->> 'codigo_cliente', '')), '');
    if v_codigo_cliente is null then
      select ccc.codigo_cliente
      into v_codigo_cliente
      from public.catalog_codigo_clientes ccc
      where ccc.activo = true
        and lower(trim(ccc.cliente)) = lower(trim(coalesce(v_cot.cliente_nombre, '')))
      order by ccc.codigo_cliente
      limit 1;
    end if;

    v_codigo_unidad := nullif(trim(coalesce(v_cot.metadata ->> 'codigo_unidad', '')), '');
    if v_codigo_unidad is null then
      select cut.codigo_unidad
      into v_codigo_unidad
      from public.catalog_codigo_unidades_trabajo cut
      where cut.activo = true
        and lower(trim(cut.unidad_trabajo)) = lower(trim(coalesce(v_cot.unidad_trabajo_nombre, '')))
      order by cut.codigo_unidad
      limit 1;
    end if;

    if v_codigo_cliente is null or v_codigo_unidad is null then
      raise exception 'Faltan codigos maestros de cliente o unidad para crear el proyecto adjudicado.';
    end if;

    select coalesce(max(n), 0)
    into v_max_project
    from (
      select substring(upper(trim(pa.codigo_proyecto)) from '^P([0-9]{3})$')::integer as n
      from public.proyectos_adjudicados pa
      where pa.anio = v_anio
        and upper(trim(pa.codigo_proyecto)) ~ '^P[0-9]{3}$'
      union all
      select substring(upper(trim(r.codigo_proyecto_adjudicado)) from '^P([0-9]{3})$')::integer as n
      from public.requerimientos r
      where r.anio = v_anio
        and upper(trim(coalesce(r.codigo_proyecto_adjudicado, ''))) ~ '^P[0-9]{3}$'
      union all
      select substring(upper(trim(r.codigo)) from '^RQ-[0-9]{4}-[A-Z0-9]+-[A-Z0-9]+-P([0-9]{3})-[0-9]{3}$')::integer as n
      from public.requerimientos r
      where upper(trim(r.codigo)) ~ ('^RQ-' || v_anio::text || '-[A-Z0-9]+-[A-Z0-9]+-P[0-9]{3}-[0-9]{3}$')
    ) reserved
    where n is not null;

    v_codigo_proyecto := 'P' || lpad((v_max_project + 1)::text, 3, '0');

    v_event := jsonb_build_object(
      'at', now(),
      'actor_id', v_actor_id,
      'actor_email', v_actor_email,
      'message', coalesce(p_event_message, 'Confirmacion de adjudicacion'),
      'previous', jsonb_build_object(
        'cotizacion_id', null,
        'propuesta_tecnica_id', null,
        'revision_adjudicada', null,
        'presupuesto_adjudicado_id', null,
        'presupuesto_estado', v_budget_previous_estado,
        'estado', null
      ),
      'next', jsonb_build_object(
        'cotizacion_id', v_cot.id,
        'propuesta_tecnica_id', p_propuesta_tecnica_id,
        'revision_adjudicada', v_revision,
        'presupuesto_adjudicado_id', v_budget.id,
        'presupuesto_revision', v_budget.revision,
        'presupuesto_estado', v_budget_result_estado,
        'estado', v_estado_proyecto,
        'requiere_propuesta_tecnica', v_requires_pt,
        'no_requiere_pt_decidido_por_user_id', case when v_requires_pt then null else v_no_pt_user_id end,
        'no_requiere_pt_decidido_at', case when v_requires_pt then null else v_no_pt_decided_at end
      )
    );

    insert into public.proyectos_adjudicados (
      id,
      anio,
      codigo_proyecto,
      cotizacion,
      oc,
      cliente,
      codigo_cliente,
      unidad_trabajo,
      codigo_unidad,
      fecha_adjudicacion,
      estado,
      activo,
      cotizacion_id,
      propuesta_tecnica_id,
      revision_adjudicada,
      presupuesto_adjudicado_id,
      fecha_confirmacion_adjudicacion,
      confirmado_por_user_id,
      confirmado_por_email,
      adjudicacion_metadata
    )
    values (
      'pa-' || replace(gen_random_uuid()::text, '-', ''),
      v_anio,
      v_codigo_proyecto,
      v_cot.codigo,
      coalesce(v_cot.oc, ''),
      coalesce(v_cot.cliente_nombre, ''),
      v_codigo_cliente,
      coalesce(v_cot.unidad_trabajo_nombre, ''),
      v_codigo_unidad,
      coalesce(v_cot.fecha_oc, v_cot.fecha_entregada, v_cot.fecha_entrega, current_date),
      v_estado_proyecto,
      true,
      v_cot.id,
      p_propuesta_tecnica_id,
      v_revision,
      v_budget.id,
      now(),
      v_actor_id,
      v_actor_email,
      jsonb_build_object(
        'created_from', 'confirmar_adjudicacion_cotizacion',
        'created_at', now(),
        'created_by', v_actor_email,
        'event_message', coalesce(p_event_message, 'Confirmacion de adjudicacion'),
        'linea_base_creada', false,
        'requiere_propuesta_tecnica', v_requires_pt,
        'no_requiere_pt_justificacion', case when v_requires_pt then null else v_no_pt_justification end,
        'no_requiere_pt_decidido_por_user_id', case when v_requires_pt then null else v_no_pt_user_id end,
        'no_requiere_pt_decidido_at', case when v_requires_pt then null else v_no_pt_decided_at end,
        'presupuesto_adjudicado_id', v_budget.id,
        'presupuesto_revision', v_budget.revision,
        'events', jsonb_build_array(v_event)
      )
    )
    returning * into v_project;
  end if;

  return query
  select
    v_project.id,
    v_project.anio,
    v_project.codigo_proyecto,
    v_project.cotizacion,
    v_project.oc,
    v_project.cliente,
    v_project.codigo_cliente,
    v_project.unidad_trabajo,
    v_project.codigo_unidad,
    v_project.fecha_adjudicacion,
    v_project.estado,
    v_project.activo,
    v_project.cotizacion_id,
    v_project.propuesta_tecnica_id,
    v_project.revision_adjudicada,
    v_project.presupuesto_adjudicado_id,
    v_project.fecha_confirmacion_adjudicacion,
    v_project.confirmado_por_user_id,
    v_project.confirmado_por_email,
    v_project.adjudicacion_metadata,
    v_project.created_at,
    v_project.updated_at;
end;
$$;

revoke all on function public.validate_proyecto_presupuesto_adjudicado() from public;
revoke all on function public.validate_proyecto_presupuesto_adjudicado() from anon;
revoke all on function public.validate_proyecto_presupuesto_adjudicado() from authenticated;
revoke all on function public.validate_cotizacion_presupuesto_estado() from public;
revoke all on function public.validate_cotizacion_presupuesto_estado() from anon;
revoke all on function public.validate_cotizacion_presupuesto_estado() from authenticated;

revoke update on public.cotizacion_presupuestos from authenticated;

revoke all on function public.marcar_cotizacion_presupuesto_listo(uuid) from public;
revoke all on function public.marcar_cotizacion_presupuesto_listo(uuid) from anon;
revoke all on function public.marcar_cotizacion_presupuesto_listo(uuid) from service_role;
grant execute on function public.marcar_cotizacion_presupuesto_listo(uuid) to authenticated;

revoke all on function public.devolver_cotizacion_presupuesto_borrador(uuid) from public;
revoke all on function public.devolver_cotizacion_presupuesto_borrador(uuid) from anon;
revoke all on function public.devolver_cotizacion_presupuesto_borrador(uuid) from service_role;
grant execute on function public.devolver_cotizacion_presupuesto_borrador(uuid) to authenticated;

revoke all on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, uuid, text) from public;
revoke all on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, uuid, text) from anon;
revoke all on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, uuid, text) from service_role;
grant execute on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, uuid, text) to authenticated;

comment on column public.proyectos_adjudicados.presupuesto_adjudicado_id is
  'Presupuesto detallado adjudicado contractualmente para el proyecto. No es linea base ni snapshot.';

comment on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, uuid, text) is
  'Confirma adjudicacion contractual con PT AG-2B y presupuesto detallado AG-2C.2D en una transaccion. No crea linea base.';

comment on function public.marcar_cotizacion_presupuesto_listo(uuid) is
  'Transicion acotada BORRADOR -> LISTO_PARA_ADJUDICAR para presupuestos de cotizacion. No permite ADJUDICADO.';

comment on function public.devolver_cotizacion_presupuesto_borrador(uuid) is
  'Transicion acotada LISTO_PARA_ADJUDICAR -> BORRADOR para presupuestos de cotizacion. No permite ADJUDICADO.';

commit;
