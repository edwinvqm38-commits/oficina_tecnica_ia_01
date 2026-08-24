-- AG-2B.R1 - Control contractual de Propuesta Tecnica obligatoria.
-- Correccion incremental sobre AG-2B. No crea linea base, RQ ni clasificacion de cambios.

begin;

alter table public.cotizaciones
  add column if not exists requiere_propuesta_tecnica boolean not null default true,
  add column if not exists no_requiere_pt_justificacion text null,
  add column if not exists no_requiere_pt_decidido_por_user_id uuid null references public.user_profiles(id) on delete set null,
  add column if not exists no_requiere_pt_decidido_por_email text null,
  add column if not exists no_requiere_pt_decidido_at timestamptz null;

create or replace function public.set_cotizacion_no_requiere_pt_audit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text;
begin
  if new.requiere_propuesta_tecnica is distinct from false then
    new.no_requiere_pt_justificacion := null;
    new.no_requiere_pt_decidido_por_user_id := null;
    new.no_requiere_pt_decidido_por_email := null;
    new.no_requiere_pt_decidido_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.requiere_propuesta_tecnica = false and new.requiere_propuesta_tecnica = false then
    new.no_requiere_pt_decidido_por_user_id := old.no_requiere_pt_decidido_por_user_id;
    new.no_requiere_pt_decidido_por_email := old.no_requiere_pt_decidido_por_email;
    new.no_requiere_pt_decidido_at := old.no_requiere_pt_decidido_at;
    return new;
  end if;

  new.no_requiere_pt_decidido_por_user_id := coalesce(new.no_requiere_pt_decidido_por_user_id, v_actor_id);
  new.no_requiere_pt_decidido_at := coalesce(new.no_requiere_pt_decidido_at, now());

  if nullif(trim(coalesce(new.no_requiere_pt_decidido_por_email, '')), '') is null
     and new.no_requiere_pt_decidido_por_user_id is not null then
    select up.email
    into v_actor_email
    from public.user_profiles up
    where up.id = new.no_requiere_pt_decidido_por_user_id
    limit 1;

    new.no_requiere_pt_decidido_por_email := coalesce(v_actor_email, auth.jwt() ->> 'email');
  end if;

  return new;
end;
$$;

drop trigger if exists set_cotizaciones_no_requiere_pt_audit on public.cotizaciones;
create trigger set_cotizaciones_no_requiere_pt_audit
before insert or update of requiere_propuesta_tecnica, no_requiere_pt_justificacion, no_requiere_pt_decidido_por_user_id, no_requiere_pt_decidido_por_email, no_requiere_pt_decidido_at
on public.cotizaciones
for each row execute function public.set_cotizacion_no_requiere_pt_audit();

alter table public.cotizaciones
  drop constraint if exists cotizaciones_no_requiere_pt_justificacion_required;

alter table public.cotizaciones
  add constraint cotizaciones_no_requiere_pt_justificacion_required
  check (
    (
      requiere_propuesta_tecnica = true
      and no_requiere_pt_justificacion is null
      and no_requiere_pt_decidido_por_user_id is null
      and no_requiere_pt_decidido_por_email is null
      and no_requiere_pt_decidido_at is null
    )
    or (
      requiere_propuesta_tecnica = false
      and length(trim(coalesce(no_requiere_pt_justificacion, ''))) > 0
      and no_requiere_pt_decidido_por_user_id is not null
      and no_requiere_pt_decidido_at is not null
    )
  );

create index if not exists cotizaciones_requiere_propuesta_tecnica_idx
  on public.cotizaciones (requiere_propuesta_tecnica)
  where deleted_at is null;

create or replace function public.confirmar_adjudicacion_cotizacion(
  p_cotizacion_id uuid,
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
  v_project public.proyectos_adjudicados%rowtype;
  v_existing_id text;
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
begin
  if v_actor_id is null then
    raise exception 'Usuario no autenticado para confirmar adjudicacion.';
  end if;

  if p_cotizacion_id is null then
    raise exception 'p_cotizacion_id es obligatorio.';
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
  limit 1;

  if v_cot.id is null then
    raise exception 'No existe la cotizacion indicada.';
  end if;

  if lower(trim(coalesce(v_cot.estado, ''))) not in ('ganada', 'adjudicado') then
    raise exception 'La cotizacion debe estar en estado Ganada para confirmar adjudicacion.';
  end if;

  v_requires_pt := coalesce(v_cot.requiere_propuesta_tecnica, true);
  v_no_pt_justification := nullif(trim(coalesce(v_cot.no_requiere_pt_justificacion, '')), '');
  v_no_pt_user_id := v_cot.no_requiere_pt_decidido_por_user_id;
  v_no_pt_decided_at := v_cot.no_requiere_pt_decidido_at;

  select pa.id
  into v_existing_id
  from public.proyectos_adjudicados pa
  where pa.cotizacion_id = v_cot.id
    and pa.activo = true
  order by pa.updated_at desc
  limit 1;

  if v_existing_id is null then
    select pa.id
    into v_existing_id
    from public.proyectos_adjudicados pa
    where pa.cotizacion_id is null
      and pa.activo = true
      and pa.cotizacion = v_cot.codigo
    order by pa.updated_at desc
    limit 1;
  end if;

  if p_propuesta_tecnica_id is not null then
    if not public.can_use_module('technical_proposals', 'view') then
      raise exception 'No tienes permiso para seleccionar propuestas tecnicas.';
    end if;

    select tp.id, tp.cotizacion_id, tp.cotizacion_codigo, tp.revision
    into v_pt
    from public.technical_proposals tp
    where tp.id = p_propuesta_tecnica_id
    limit 1;

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

  if v_existing_id is null and v_requires_pt and p_propuesta_tecnica_id is null then
    raise exception 'Esta cotizacion requiere una Propuesta Tecnica. Registre y seleccione la PT adjudicada antes de confirmar la adjudicacion.';
  end if;

  if v_existing_id is null
     and not v_requires_pt
     and (v_no_pt_justification is null or v_no_pt_user_id is null or v_no_pt_decided_at is null) then
    raise exception 'La decision No requiere Propuesta Tecnica debe tener justificacion, usuario y fecha de decision.';
  end if;

  v_estado_proyecto := case
    when p_propuesta_tecnica_id is not null then 'Activo'
    when not v_requires_pt then 'Activo'
    else 'Pendiente de revisión adjudicada'
  end;

  if v_existing_id is not null then
    select *
    into v_project
    from public.proyectos_adjudicados pa
    where pa.id = v_existing_id
    for update;

    v_event := jsonb_build_object(
      'at', now(),
      'actor_id', v_actor_id,
      'actor_email', v_actor_email,
      'message', coalesce(p_event_message, 'Confirmacion de adjudicacion'),
      'previous', jsonb_build_object(
        'cotizacion_id', v_project.cotizacion_id,
        'propuesta_tecnica_id', v_project.propuesta_tecnica_id,
        'revision_adjudicada', v_project.revision_adjudicada,
        'estado', v_project.estado
      ),
      'next', jsonb_build_object(
        'cotizacion_id', v_cot.id,
        'propuesta_tecnica_id', coalesce(p_propuesta_tecnica_id, v_project.propuesta_tecnica_id),
        'revision_adjudicada', coalesce(v_revision, v_project.revision_adjudicada),
        'estado', case
          when coalesce(p_propuesta_tecnica_id, v_project.propuesta_tecnica_id) is not null then 'Activo'
          when not v_requires_pt then 'Activo'
          else 'Pendiente de revisión adjudicada'
        end,
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
      estado = case
        when coalesce(p_propuesta_tecnica_id, pa.propuesta_tecnica_id) is not null then 'Activo'
        when not v_requires_pt then 'Activo'
        else 'Pendiente de revisión adjudicada'
      end,
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
          'no_requiere_pt_decidido_at', case when v_requires_pt then null else v_no_pt_decided_at end
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
        'no_requiere_pt_decidido_at', case when v_requires_pt then null else v_no_pt_decided_at end
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
    v_project.fecha_confirmacion_adjudicacion,
    v_project.confirmado_por_user_id,
    v_project.confirmado_por_email,
    v_project.adjudicacion_metadata,
    v_project.created_at,
    v_project.updated_at;
end;
$$;

revoke all on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, text) from public;
revoke all on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, text) from anon;
revoke all on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, text) from service_role;
grant execute on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, text) to authenticated;

comment on function public.confirmar_adjudicacion_cotizacion(uuid, uuid, text) is
  'Confirma adjudicacion contractual AG-2B.R1: PT obligatoria por defecto, excepcion auditable sin PT y sin crear linea base.';

commit;
