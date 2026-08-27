-- AG-2C.2E - Trazabilidad PT estructurada -> presupuesto detallado.
-- Migracion local. No implementa REAL, RQ, linea base contractual ni cambios contractuales.

begin;

alter table public.cotizacion_presupuestos
  add column if not exists propuesta_tecnica_id uuid null;

alter table public.cotizacion_presupuestos
  drop constraint if exists cotizacion_presupuestos_propuesta_tecnica_fkey;

alter table public.cotizacion_presupuestos
  add constraint cotizacion_presupuestos_propuesta_tecnica_fkey
  foreign key (propuesta_tecnica_id)
  references public.technical_proposals(id)
  on delete restrict;

alter table public.cotizacion_presupuesto_partidas
  add column if not exists propuesta_tecnica_item_id uuid null;

alter table public.cotizacion_presupuesto_partidas
  drop constraint if exists cotizacion_presupuesto_partidas_pt_item_fkey;

alter table public.cotizacion_presupuesto_partidas
  add constraint cotizacion_presupuesto_partidas_pt_item_fkey
  foreign key (propuesta_tecnica_item_id)
  references public.technical_proposal_items(id)
  on delete restrict;

alter table public.cotizacion_presupuesto_recursos
  add column if not exists propuesta_tecnica_recurso_id uuid null;

alter table public.cotizacion_presupuesto_recursos
  add column if not exists codigo_recurso_snapshot text null,
  add column if not exists codigo_fabricante_snapshot text null,
  add column if not exists descripcion_snapshot text null,
  add column if not exists tipo_recurso_snapshot text null,
  add column if not exists unidad_snapshot text null,
  add column if not exists precio_unitario_ref_snapshot numeric(14,4) null,
  add column if not exists moneda_codigo_snapshot text null,
  add column if not exists proveedor_snapshot text null,
  add column if not exists marca_snapshot text null;

alter table public.cotizacion_presupuesto_recursos
  drop constraint if exists cotizacion_presupuesto_recursos_pt_recurso_fkey;

alter table public.cotizacion_presupuesto_recursos
  add constraint cotizacion_presupuesto_recursos_pt_recurso_fkey
  foreign key (propuesta_tecnica_recurso_id)
  references public.technical_proposal_resources(id)
  on delete restrict;

create unique index if not exists cotizacion_presupuestos_pt_revision_unique
  on public.cotizacion_presupuestos (propuesta_tecnica_id)
  where propuesta_tecnica_id is not null;

create index if not exists cotizacion_presupuesto_partidas_pt_item_idx
  on public.cotizacion_presupuesto_partidas (propuesta_tecnica_item_id)
  where propuesta_tecnica_item_id is not null;

create index if not exists cotizacion_presupuesto_recursos_pt_recurso_idx
  on public.cotizacion_presupuesto_recursos (propuesta_tecnica_recurso_id)
  where propuesta_tecnica_recurso_id is not null;

create unique index if not exists technical_proposals_cotizacion_revision_unique
  on public.technical_proposals (cotizacion_id, revision)
  where cotizacion_id is not null;

create unique index if not exists technical_proposals_code_unique
  on public.technical_proposals (code);

create or replace function public.enforce_cotizacion_presupuesto_partida_pt_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_budget_pt_id uuid;
  v_item_pt_id uuid;
begin
  if new.propuesta_tecnica_item_id is null then
    return new;
  end if;

  select cp.propuesta_tecnica_id
  into v_budget_pt_id
  from public.cotizacion_presupuestos cp
  where cp.id = new.presupuesto_id;

  if v_budget_pt_id is null then
    raise exception 'La partida presupuestal no puede apuntar a un item PT si el presupuesto no apunta a esa PT.';
  end if;

  select tpi.technical_proposal_id
  into v_item_pt_id
  from public.technical_proposal_items tpi
  where tpi.id = new.propuesta_tecnica_item_id;

  if v_item_pt_id is null then
    raise exception 'El item PT trazado no existe.';
  end if;

  if v_item_pt_id <> v_budget_pt_id then
    raise exception 'El item PT trazado no pertenece a la PT origen del presupuesto.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_cotizacion_presupuesto_partida_pt_integrity
  on public.cotizacion_presupuesto_partidas;
create trigger enforce_cotizacion_presupuesto_partida_pt_integrity
before insert or update of presupuesto_id, propuesta_tecnica_item_id
on public.cotizacion_presupuesto_partidas
for each row
execute function public.enforce_cotizacion_presupuesto_partida_pt_integrity();

create or replace function public.enforce_cotizacion_presupuesto_recurso_pt_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_budget_pt_id uuid;
  v_partida_pt_item_id uuid;
  v_resource_pt_id uuid;
  v_resource_item_id uuid;
  v_resource_master_id uuid;
begin
  if new.propuesta_tecnica_recurso_id is null then
    return new;
  end if;

  select cp.propuesta_tecnica_id, cpp.propuesta_tecnica_item_id
  into v_budget_pt_id, v_partida_pt_item_id
  from public.cotizacion_presupuesto_partidas cpp
  join public.cotizacion_presupuestos cp on cp.id = cpp.presupuesto_id
  where cpp.id = new.partida_id;

  if v_budget_pt_id is null or v_partida_pt_item_id is null then
    raise exception 'El recurso presupuestado no puede apuntar a un recurso PT si la partida/presupuesto no tiene trazabilidad PT.';
  end if;

  select tpr.technical_proposal_id, tpr.technical_proposal_item_id, tpr.resource_id
  into v_resource_pt_id, v_resource_item_id, v_resource_master_id
  from public.technical_proposal_resources tpr
  where tpr.id = new.propuesta_tecnica_recurso_id;

  if v_resource_pt_id is null then
    raise exception 'El recurso PT trazado no existe.';
  end if;

  if v_resource_pt_id <> v_budget_pt_id then
    raise exception 'El recurso PT trazado no pertenece a la PT origen del presupuesto.';
  end if;

  if v_resource_item_id <> v_partida_pt_item_id then
    raise exception 'El recurso PT trazado no pertenece a la partida PT origen de la partida presupuestal.';
  end if;

  if v_resource_master_id is null or v_resource_master_id <> new.recurso_id then
    raise exception 'El recurso maestro presupuestado no coincide con el recurso maestro trazado desde PT.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_cotizacion_presupuesto_recurso_pt_integrity
  on public.cotizacion_presupuesto_recursos;
create trigger enforce_cotizacion_presupuesto_recurso_pt_integrity
before insert or update of partida_id, recurso_id, propuesta_tecnica_recurso_id
on public.cotizacion_presupuesto_recursos
for each row
execute function public.enforce_cotizacion_presupuesto_recurso_pt_integrity();

create or replace function public.save_full_technical_proposal(
  p_proposal jsonb,
  p_items jsonb,
  p_resources jsonb,
  p_files jsonb default '[]'::jsonb,
  p_event_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_proposal_id uuid;
  v_existing_id uuid;
  v_requested_id uuid;
  v_cotizacion_id uuid;
  v_resolved_cotizacion_id uuid;
  v_code text;
  v_cotizacion_codigo text;
  v_revision text;
  v_document_date date;
  v_item jsonb;
  v_resource jsonb;
  v_file jsonb;
  v_item_id uuid;
  v_parent_id uuid;
  v_parent_key text;
  v_client_key text;
  v_resource_item_key text;
  v_resource_item_id uuid;
  v_resource_id uuid;
  v_resource_snapshot_id uuid;
  v_item_map jsonb := '{}'::jsonb;
  v_items_count integer := 0;
  v_resources_count integer := 0;
  v_files_count integer := 0;
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if v_actor_id is null then
    raise exception 'Usuario no autenticado para guardar Propuesta Tecnica.';
  end if;

  if not public.can_manage_technical_proposals() then
    raise exception 'No tienes permiso para guardar Propuesta Tecnica.';
  end if;

  select up.email
  into v_actor_email
  from public.user_profiles up
  where up.id = v_actor_id
  limit 1;

  v_actor_email := coalesce(v_actor_email, auth.jwt() ->> 'email');

  if p_proposal is null or jsonb_typeof(p_proposal) <> 'object' then
    raise exception 'p_proposal debe ser un objeto JSON.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items debe ser un array JSON.';
  end if;

  if p_resources is null or jsonb_typeof(p_resources) <> 'array' then
    raise exception 'p_resources debe ser un array JSON.';
  end if;

  if p_files is null or jsonb_typeof(p_files) <> 'array' then
    raise exception 'p_files debe ser un array JSON.';
  end if;

  v_code := trim(coalesce(p_proposal ->> 'code', ''));
  v_cotizacion_codigo := trim(coalesce(p_proposal ->> 'cotizacion_codigo', ''));
  v_revision := trim(coalesce(p_proposal ->> 'revision', 'REV00'));

  if v_code = '' then
    raise exception 'p_proposal.code es obligatorio.';
  end if;

  if v_cotizacion_codigo = '' then
    raise exception 'p_proposal.cotizacion_codigo es obligatorio.';
  end if;

  if v_revision = '' then
    v_revision := 'REV00';
  end if;

  if nullif(p_proposal ->> 'id', '') is not null then
    if (p_proposal ->> 'id') ~* v_uuid_pattern then
      v_requested_id := (p_proposal ->> 'id')::uuid;
    else
      raise exception 'p_proposal.id debe ser UUID si se envia.';
    end if;
  end if;

  if nullif(p_proposal ->> 'cotizacion_id', '') is not null then
    if (p_proposal ->> 'cotizacion_id') ~* v_uuid_pattern then
      v_cotizacion_id := (p_proposal ->> 'cotizacion_id')::uuid;
    else
      raise exception 'p_proposal.cotizacion_id debe ser UUID si se envia.';
    end if;
  end if;

  if v_cotizacion_id is not null then
    select c.id
    into v_resolved_cotizacion_id
    from public.cotizaciones c
    where c.id = v_cotizacion_id
      and c.codigo = v_cotizacion_codigo
      and c.deleted_at is null
    for update;

    if v_resolved_cotizacion_id is null then
      raise exception 'p_proposal.cotizacion_id no coincide con p_proposal.cotizacion_codigo.';
    end if;
  else
    select c.id
    into v_resolved_cotizacion_id
    from public.cotizaciones c
    where c.codigo = v_cotizacion_codigo
      and c.deleted_at is null
    for update;

    if v_resolved_cotizacion_id is null then
      raise exception 'No existe una cotizacion activa para p_proposal.cotizacion_codigo.';
    end if;
  end if;

  v_cotizacion_id := v_resolved_cotizacion_id;
  v_document_date := nullif(p_proposal ->> 'document_date', '')::date;

  perform pg_advisory_xact_lock(hashtextextended('technical_proposal_revision:' || v_cotizacion_id::text || ':' || v_revision, 0));

  if v_requested_id is not null then
    select tp.id
    into v_existing_id
    from public.technical_proposals tp
    where tp.id = v_requested_id
    for update;

    if v_existing_id is null then
      raise exception 'p_proposal.id no corresponde a una propuesta tecnica existente.';
    end if;

    if not exists (
      select 1
      from public.technical_proposals tp
      where tp.id = v_existing_id
        and tp.cotizacion_id = v_cotizacion_id
        and tp.revision = v_revision
        and tp.code = v_code
    ) then
      raise exception 'p_proposal.id no corresponde a la cotizacion, revision y codigo solicitados.';
    end if;
  else
    select tp.id
    into v_existing_id
    from public.technical_proposals tp
    where tp.cotizacion_id = v_cotizacion_id
      and tp.revision = v_revision
    for update;

    if v_existing_id is not null then
      raise exception 'Ya existe una Propuesta Tecnica para esta cotizacion y revision. Recarga la revision antes de modificarla.';
    end if;

    if exists (
      select 1
      from public.technical_proposals tp
      where tp.code = v_code
    ) then
      raise exception 'p_proposal.code ya pertenece a otra Propuesta Tecnica.';
    end if;
  end if;

  if v_existing_id is not null then
    update public.technical_proposals
    set
      cotizacion_id = v_cotizacion_id,
      cotizacion_codigo = v_cotizacion_codigo,
      code = v_code,
      document_type = coalesce(nullif(p_proposal ->> 'document_type', ''), 'PT'),
      revision = v_revision,
      revision_folder = coalesce(nullif(p_proposal ->> 'revision_folder', ''), '02_PROPUESTA'),
      status = coalesce(nullif(p_proposal ->> 'status', ''), 'Borrador'),
      mode = coalesce(nullif(p_proposal ->> 'mode', ''), 'cliente'),
      work_status = coalesce(nullif(p_proposal ->> 'work_status', ''), 'Borrador'),
      document_date = v_document_date,
      company_logo_id = case
        when nullif(p_proposal ->> 'company_logo_id', '') is not null and (p_proposal ->> 'company_logo_id') ~* v_uuid_pattern
          then (p_proposal ->> 'company_logo_id')::uuid
        else null
      end,
      client_logo_id = case
        when nullif(p_proposal ->> 'client_logo_id', '') is not null and (p_proposal ->> 'client_logo_id') ~* v_uuid_pattern
          then (p_proposal ->> 'client_logo_id')::uuid
        else null
      end,
      header = coalesce(p_proposal -> 'header', '{}'::jsonb),
      recipient = coalesce(p_proposal -> 'recipient', '{}'::jsonb),
      presentation = coalesce(p_proposal -> 'presentation', '{}'::jsonb),
      commercial_terms = coalesce(p_proposal -> 'commercial_terms', '{}'::jsonb),
      metadata = coalesce(p_proposal -> 'metadata', '{}'::jsonb),
      updated_by = v_actor_id
    where id = v_existing_id
    returning id into v_proposal_id;
  else
    insert into public.technical_proposals (
      cotizacion_id,
      cotizacion_codigo,
      code,
      document_type,
      revision,
      revision_folder,
      status,
      mode,
      work_status,
      document_date,
      company_logo_id,
      client_logo_id,
      header,
      recipient,
      presentation,
      commercial_terms,
      metadata,
      created_by,
      updated_by
    ) values (
      v_cotizacion_id,
      v_cotizacion_codigo,
      v_code,
      coalesce(nullif(p_proposal ->> 'document_type', ''), 'PT'),
      v_revision,
      coalesce(nullif(p_proposal ->> 'revision_folder', ''), '02_PROPUESTA'),
      coalesce(nullif(p_proposal ->> 'status', ''), 'Borrador'),
      coalesce(nullif(p_proposal ->> 'mode', ''), 'cliente'),
      coalesce(nullif(p_proposal ->> 'work_status', ''), 'Borrador'),
      v_document_date,
      case
        when nullif(p_proposal ->> 'company_logo_id', '') is not null and (p_proposal ->> 'company_logo_id') ~* v_uuid_pattern
          then (p_proposal ->> 'company_logo_id')::uuid
        else null
      end,
      case
        when nullif(p_proposal ->> 'client_logo_id', '') is not null and (p_proposal ->> 'client_logo_id') ~* v_uuid_pattern
          then (p_proposal ->> 'client_logo_id')::uuid
        else null
      end,
      coalesce(p_proposal -> 'header', '{}'::jsonb),
      coalesce(p_proposal -> 'recipient', '{}'::jsonb),
      coalesce(p_proposal -> 'presentation', '{}'::jsonb),
      coalesce(p_proposal -> 'commercial_terms', '{}'::jsonb),
      coalesce(p_proposal -> 'metadata', '{}'::jsonb),
      v_actor_id,
      v_actor_id
    )
    returning id into v_proposal_id;
  end if;

  delete from public.technical_proposal_files
  where technical_proposal_id = v_proposal_id;

  delete from public.technical_proposal_resources
  where technical_proposal_id = v_proposal_id;

  delete from public.technical_proposal_items
  where technical_proposal_id = v_proposal_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Cada item de p_items debe ser un objeto JSON.';
    end if;

    v_client_key := trim(coalesce(v_item ->> 'client_key', v_item ->> 'id', ''));

    if v_client_key = '' then
      raise exception 'Cada item debe incluir client_key o id.';
    end if;

    if trim(coalesce(v_item ->> 'item_type', '')) = '' then
      raise exception 'Item % no tiene item_type.', v_client_key;
    end if;

    if trim(coalesce(v_item ->> 'item_number', '')) = '' then
      raise exception 'Item % no tiene item_number.', v_client_key;
    end if;

    if trim(coalesce(v_item ->> 'title', '')) = '' then
      raise exception 'Item % no tiene title.', v_client_key;
    end if;

    v_item_id := gen_random_uuid();
    v_parent_key := trim(coalesce(v_item ->> 'parent_client_key', ''));
    v_parent_id := null;

    if v_parent_key <> '' then
      v_parent_id := nullif(v_item_map ->> v_parent_key, '')::uuid;
      if v_parent_id is null then
        raise exception 'Item % referencia parent_client_key % no insertado.', v_client_key, v_parent_key;
      end if;
    elsif nullif(v_item ->> 'parent_id', '') is not null then
      if (v_item ->> 'parent_id') ~* v_uuid_pattern then
        v_parent_id := (v_item ->> 'parent_id')::uuid;
      else
        raise exception 'Item % tiene parent_id no UUID. Enviar parent_client_key para IDs temporales.', v_client_key;
      end if;
    end if;

    insert into public.technical_proposal_items (
      id,
      technical_proposal_id,
      parent_id,
      item_type,
      item_number,
      level,
      sort_order,
      title,
      technical_description,
      estimated_time_value,
      estimated_time_unit,
      is_complete,
      internal_comments,
      metadata
    ) values (
      v_item_id,
      v_proposal_id,
      v_parent_id,
      v_item ->> 'item_type',
      v_item ->> 'item_number',
      coalesce(nullif(v_item ->> 'level', '')::integer, 0),
      coalesce(nullif(v_item ->> 'sort_order', '')::integer, v_items_count),
      v_item ->> 'title',
      nullif(v_item ->> 'technical_description', ''),
      nullif(v_item ->> 'estimated_time_value', '')::numeric,
      nullif(v_item ->> 'estimated_time_unit', ''),
      coalesce(nullif(v_item ->> 'is_complete', '')::boolean, false),
      nullif(v_item ->> 'internal_comments', ''),
      coalesce(v_item -> 'metadata', '{}'::jsonb) || jsonb_build_object('client_key', v_client_key)
    );

    v_item_map := v_item_map || jsonb_build_object(v_client_key, v_item_id::text);
    v_items_count := v_items_count + 1;
  end loop;

  for v_resource in select value from jsonb_array_elements(p_resources)
  loop
    if jsonb_typeof(v_resource) <> 'object' then
      raise exception 'Cada resource de p_resources debe ser un objeto JSON.';
    end if;

    v_resource_item_key := trim(coalesce(v_resource ->> 'client_item_key', v_resource ->> 'technical_proposal_item_id', ''));

    if v_resource_item_key = '' then
      raise exception 'Cada resource debe incluir client_item_key o technical_proposal_item_id.';
    end if;

    if trim(coalesce(v_resource ->> 'resource_category', '')) = '' then
      raise exception 'Resource asociado a item % no tiene resource_category.', v_resource_item_key;
    end if;

    if trim(coalesce(v_resource ->> 'descripcion', '')) = '' then
      raise exception 'Resource asociado a item % no tiene descripcion.', v_resource_item_key;
    end if;

    v_resource_item_id := nullif(v_item_map ->> v_resource_item_key, '')::uuid;

    if v_resource_item_id is null then
      raise exception 'Resource referencia item % que no existe en p_items. Enviar client_item_key alineado con item.client_key.', v_resource_item_key;
    end if;

    v_resource_id := null;
    if nullif(v_resource ->> 'resource_id', '') is not null then
      if (v_resource ->> 'resource_id') ~* v_uuid_pattern then
        v_resource_id := (v_resource ->> 'resource_id')::uuid;
        if not exists (select 1 from public.recursos r where r.id = v_resource_id and r.deleted_at is null) then
          raise exception 'Resource resource_id % no existe o esta inactivo.', v_resource_id;
        end if;
      else
        raise exception 'Resource resource_id debe ser UUID si se envia.';
      end if;
    end if;

    insert into public.technical_proposal_resources (
      technical_proposal_id,
      technical_proposal_item_id,
      resource_id,
      resource_category,
      codigo_recurso,
      codigo_fabricante,
      tipo_recurso,
      descripcion,
      unidad,
      cantidad,
      tiempo,
      precio_unitario_ref,
      moneda_codigo,
      proveedor,
      marca,
      comentario,
      detalle_adicional,
      origin_status,
      metadata,
      sort_order
    ) values (
      v_proposal_id,
      v_resource_item_id,
      v_resource_id,
      v_resource ->> 'resource_category',
      nullif(v_resource ->> 'codigo_recurso', ''),
      nullif(v_resource ->> 'codigo_fabricante', ''),
      nullif(v_resource ->> 'tipo_recurso', ''),
      v_resource ->> 'descripcion',
      nullif(v_resource ->> 'unidad', ''),
      coalesce(nullif(v_resource ->> 'cantidad', '')::numeric, 1),
      nullif(v_resource ->> 'tiempo', '')::numeric,
      nullif(v_resource ->> 'precio_unitario_ref', '')::numeric,
      nullif(v_resource ->> 'moneda_codigo', ''),
      nullif(v_resource ->> 'proveedor', ''),
      nullif(v_resource ->> 'marca', ''),
      nullif(v_resource ->> 'comentario', ''),
      nullif(v_resource ->> 'detalle_adicional', ''),
      coalesce(nullif(v_resource ->> 'origin_status', ''), 'nuevo_por_formalizar'),
      coalesce(v_resource -> 'metadata', '{}'::jsonb) || jsonb_build_object('client_item_key', v_resource_item_key),
      coalesce(nullif(v_resource ->> 'sort_order', '')::integer, v_resources_count)
    );

    v_resources_count := v_resources_count + 1;
  end loop;

  for v_file in select value from jsonb_array_elements(p_files)
  loop
    if jsonb_typeof(v_file) <> 'object' then
      raise exception 'Cada file de p_files debe ser un objeto JSON.';
    end if;

    if trim(coalesce(v_file ->> 'file_type', '')) = '' then
      raise exception 'Cada file debe incluir file_type.';
    end if;

    v_resource_item_key := trim(coalesce(v_file ->> 'client_item_key', v_file ->> 'technical_proposal_item_id', ''));
    v_resource_item_id := null;
    v_resource_snapshot_id := null;

    if v_resource_item_key <> '' then
      v_resource_item_id := nullif(v_item_map ->> v_resource_item_key, '')::uuid;
      if v_resource_item_id is null then
        raise exception 'File referencia item % que no existe en p_items.', v_resource_item_key;
      end if;
    end if;

    if nullif(v_file ->> 'resource_snapshot_id', '') is not null then
      raise exception 'File resource_snapshot_id no se conserva al guardar/recrear snapshots de recursos.';
    end if;

    insert into public.technical_proposal_files (
      technical_proposal_id,
      technical_proposal_item_id,
      resource_snapshot_id,
      file_type,
      title,
      relation_label,
      storage_path,
      public_url,
      mime_type,
      file_size,
      metadata,
      created_by
    ) values (
      v_proposal_id,
      v_resource_item_id,
      v_resource_snapshot_id,
      v_file ->> 'file_type',
      nullif(v_file ->> 'title', ''),
      nullif(v_file ->> 'relation_label', ''),
      nullif(v_file ->> 'storage_path', ''),
      nullif(v_file ->> 'public_url', ''),
      nullif(v_file ->> 'mime_type', ''),
      nullif(v_file ->> 'file_size', '')::bigint,
      coalesce(v_file -> 'metadata', '{}'::jsonb),
      v_actor_id
    );

    v_files_count := v_files_count + 1;
  end loop;

  insert into public.technical_proposal_events (
    technical_proposal_id,
    event_type,
    event_message,
    actor_id,
    actor_email,
    metadata
  ) values (
    v_proposal_id,
    'full_saved',
    coalesce(p_event_message, 'Propuesta Tecnica guardada completamente por RPC.'),
    v_actor_id,
    v_actor_email,
    jsonb_build_object(
      'items_count', v_items_count,
      'resources_count', v_resources_count,
      'files_count', v_files_count,
      'uses_client_key_mapping', true,
      'revision_serialized', true
    )
  );

  return v_proposal_id;
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
  v_parent_budget_id uuid;
  v_budget_item_id uuid;
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
    join public.technical_proposal_items tpi on tpi.id = tpr.technical_proposal_item_id
    where tpr.technical_proposal_id = v_pt.id
      and tpi.technical_proposal_id = v_pt.id
      and tpi.item_type <> 'activity'
  ) then
    raise exception 'La PT contiene recursos asociados a titulo/subtitulo. Asociarlos a una partida antes de importar.';
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
    select tpr.*
    from public.technical_proposal_resources tpr
    join public.technical_proposal_items tpi on tpi.id = tpr.technical_proposal_item_id
    where tpr.technical_proposal_id = v_pt.id
      and tpi.technical_proposal_id = v_pt.id
      and tpi.item_type = 'activity'
    order by tpr.sort_order asc
  loop
    v_budget_item_id := nullif(v_item_map ->> v_resource.technical_proposal_item_id::text, '')::uuid;

    if v_budget_item_id is null then
      raise exception 'No se pudo resolver la partida presupuestal destino para un recurso PT.';
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

revoke all on function public.enforce_cotizacion_presupuesto_partida_pt_integrity() from public;
revoke all on function public.enforce_cotizacion_presupuesto_partida_pt_integrity() from anon;
revoke all on function public.enforce_cotizacion_presupuesto_partida_pt_integrity() from authenticated;
revoke all on function public.enforce_cotizacion_presupuesto_partida_pt_integrity() from service_role;

revoke all on function public.enforce_cotizacion_presupuesto_recurso_pt_integrity() from public;
revoke all on function public.enforce_cotizacion_presupuesto_recurso_pt_integrity() from anon;
revoke all on function public.enforce_cotizacion_presupuesto_recurso_pt_integrity() from authenticated;
revoke all on function public.enforce_cotizacion_presupuesto_recurso_pt_integrity() from service_role;

revoke all on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) from public;
revoke all on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) from anon;
revoke all on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) from service_role;
grant execute on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) to authenticated;

comment on column public.cotizacion_presupuestos.propuesta_tecnica_id is
  'Revision de Propuesta Tecnica origen del presupuesto. Null para presupuestos manuales.';

comment on column public.cotizacion_presupuesto_partidas.propuesta_tecnica_item_id is
  'Item estructural PT origen del nodo presupuestal. Null para nodos manuales.';

comment on column public.cotizacion_presupuesto_recursos.propuesta_tecnica_recurso_id is
  'Recurso PT origen del recurso presupuestado. Null para recursos manuales.';

comment on column public.cotizacion_presupuesto_recursos.codigo_recurso_snapshot is
  'Codigo historico del recurso al momento de incorporarlo al presupuesto. No se refresca desde recursos.';

comment on column public.cotizacion_presupuesto_recursos.descripcion_snapshot is
  'Descripcion historica del recurso al momento de incorporarlo al presupuesto. No se refresca desde recursos.';

comment on column public.cotizacion_presupuesto_recursos.tipo_recurso_snapshot is
  'Tipo historico del recurso al momento de incorporarlo al presupuesto. No se refresca desde recursos.';

comment on column public.cotizacion_presupuesto_recursos.unidad_snapshot is
  'Unidad historica del recurso al momento de incorporarlo al presupuesto. No se refresca desde recursos.';

comment on column public.cotizacion_presupuesto_recursos.precio_unitario_ref_snapshot is
  'Precio referencial historico del catalogo/PT al momento de incorporarlo al presupuesto. No reemplaza precio_base_unitario ni se refresca desde recursos.';

comment on function public.crear_presupuesto_desde_propuesta_tecnica(uuid) is
  'Crea atomica y explicitamente una nueva revision de presupuesto BORRADOR desde una PT completada, preservando recurso_id, trazabilidad PT y snapshot historico del recurso.';

comment on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) is
  'Guarda una PT completa con serializacion por cotizacion/revision. Crear nueva revision sin id no sobrescribe una revision existente.';

comment on function public.enforce_cotizacion_presupuesto_partida_pt_integrity() is
  'Valida que una partida presupuestal trazada apunte a un item de la misma PT origen del presupuesto.';

comment on function public.enforce_cotizacion_presupuesto_recurso_pt_integrity() is
  'Valida que un recurso presupuestado trazado apunte a un recurso de la misma PT, partida PT y recurso maestro.';

commit;
