-- 20260824090000_reconcile_technical_proposal_rpc.sql
-- Forward-only reconciliation for OFICINA_IA.
-- Creates the technical proposal RPCs that are missing in the remote schema.
-- Does not alter RLS policies or existing technical proposal tables.

begin;

create or replace function public.can_manage_technical_proposals()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select (select auth.uid()) is not null
    and (
      public.can_use_module('technical_proposals', 'edit')
      or public.can_use_module('technical_proposals', 'create')
    );
$$;

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
    limit 1;

    if v_resolved_cotizacion_id is null then
      raise exception 'p_proposal.cotizacion_id no coincide con p_proposal.cotizacion_codigo.';
    end if;
  else
    select c.id
    into v_resolved_cotizacion_id
    from public.cotizaciones c
    where c.codigo = v_cotizacion_codigo
      and c.deleted_at is null
    limit 1;

    if v_resolved_cotizacion_id is null then
      raise exception 'No existe una cotizacion activa para p_proposal.cotizacion_codigo.';
    end if;
  end if;

  v_cotizacion_id := v_resolved_cotizacion_id;
  v_document_date := nullif(p_proposal ->> 'document_date', '')::date;

  if v_requested_id is not null then
    select tp.id
    into v_existing_id
    from public.technical_proposals tp
    where tp.id = v_requested_id
      and (
        tp.code = v_code
        or (tp.cotizacion_id = v_cotizacion_id and tp.revision = v_revision)
      )
    limit 1;

    if v_existing_id is null then
      raise exception 'p_proposal.id no corresponde a la propuesta tecnica solicitada.';
    end if;
  end if;

  if v_existing_id is null then
    select tp.id
    into v_existing_id
    from public.technical_proposals tp
    where tp.cotizacion_id = v_cotizacion_id
      and tp.revision = v_revision
    limit 1;
  end if;

  if v_existing_id is null then
    select tp.id
    into v_existing_id
    from public.technical_proposals tp
    where tp.code = v_code
    limit 1;

    if v_existing_id is not null and not exists (
      select 1
      from public.technical_proposals tp
      where tp.id = v_existing_id
        and tp.cotizacion_id = v_cotizacion_id
        and tp.revision = v_revision
    ) then
      raise exception 'p_proposal.code ya pertenece a otra cotizacion o revision.';
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

    if nullif(v_item ->> 'id', '') is not null and (v_item ->> 'id') ~* v_uuid_pattern then
      v_item_id := (v_item ->> 'id')::uuid;
    else
      v_item_id := gen_random_uuid();
    end if;

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
      if v_resource_item_key ~* v_uuid_pattern then
        if exists (
          select 1
          from public.technical_proposal_items tpi
          where tpi.id = v_resource_item_key::uuid
            and tpi.technical_proposal_id = v_proposal_id
        ) then
          v_resource_item_id := v_resource_item_key::uuid;
        else
          raise exception 'Resource referencia item UUID % que no existe en p_items.', v_resource_item_key;
        end if;
      else
        raise exception 'Resource referencia item % que no existe en p_items. Enviar client_item_key alineado con item.client_key.', v_resource_item_key;
      end if;
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
      if v_resource_item_id is null and v_resource_item_key ~* v_uuid_pattern then
        v_resource_item_id := nullif(v_resource_item_key, '')::uuid;
      end if;
    end if;

    if nullif(v_file ->> 'resource_snapshot_id', '') is not null then
      if (v_file ->> 'resource_snapshot_id') ~* v_uuid_pattern then
        v_resource_snapshot_id := (v_file ->> 'resource_snapshot_id')::uuid;
        if not exists (
          select 1
          from public.technical_proposal_resources tpr
          where tpr.id = v_resource_snapshot_id
            and tpr.technical_proposal_id = v_proposal_id
        ) then
          raise exception 'File resource_snapshot_id % no pertenece a la propuesta tecnica actual.', v_resource_snapshot_id;
        end if;
      else
        raise exception 'File resource_snapshot_id debe ser UUID si se envia.';
      end if;
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
      'uses_client_key_mapping', true
    )
  );

  return v_proposal_id;
end;
$$;

revoke all on function public.can_manage_technical_proposals() from public;
revoke all on function public.can_manage_technical_proposals() from anon;
revoke all on function public.can_manage_technical_proposals() from service_role;
revoke all on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) from public;
revoke all on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) from anon;
revoke all on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) from service_role;

grant execute on function public.can_manage_technical_proposals() to authenticated;
grant execute on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) to authenticated;

comment on function public.can_manage_technical_proposals() is
  'Valida si el usuario autenticado puede crear o editar Propuestas Tecnicas segun can_use_module.';

comment on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) is
  'Guarda una Propuesta Tecnica completa de forma atomica. Valida usuario, permisos de modulo, cotizacion origen y payload; reemplaza hijos dentro de la RPC para evitar DELETE directo desde frontend.';

commit;
