-- MIG-PTE-1 - Identidad estable y reconciliacion idempotente PT -> presupuesto.
-- Esta migracion se prepara localmente. No presupone ejecucion remota durante QA.

begin;

-- -----------------------------------------------------------------------------
-- 1. Identidad estable y estado de sincronizacion
-- -----------------------------------------------------------------------------

alter table public.technical_proposal_items
  add column if not exists source_key text;

alter table public.technical_proposal_resources
  add column if not exists source_key text;

update public.technical_proposal_items
set source_key = 'legacy-item:' || id::text
where source_key is null or trim(source_key) = '';

update public.technical_proposal_resources
set source_key = 'legacy-resource:' || id::text
where source_key is null or trim(source_key) = '';

alter table public.technical_proposal_items
  alter column source_key set not null;

alter table public.technical_proposal_resources
  alter column source_key set not null;

alter table public.technical_proposal_items
  drop constraint if exists technical_proposal_items_source_key_not_blank;

alter table public.technical_proposal_items
  add constraint technical_proposal_items_source_key_not_blank
  check (length(trim(source_key)) > 0);

alter table public.technical_proposal_resources
  drop constraint if exists technical_proposal_resources_source_key_not_blank;

alter table public.technical_proposal_resources
  add constraint technical_proposal_resources_source_key_not_blank
  check (length(trim(source_key)) > 0);

create unique index if not exists technical_proposal_items_proposal_source_key_unique
  on public.technical_proposal_items (technical_proposal_id, source_key);

create unique index if not exists technical_proposal_resources_proposal_source_key_unique
  on public.technical_proposal_resources (technical_proposal_id, source_key);

-- source_key nace con la entidad y luego es inmutable. El fallback de INSERT
-- mantiene compatibles clientes desplegados antes de esta migracion que ya
-- persisten la identidad en metadata, sin regenerarla en cada guardado.
create or replace function public.enforce_technical_proposal_source_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.source_key is distinct from new.source_key then
    raise exception 'source_key es inmutable despues de persistirse.';
  end if;

  if tg_op = 'INSERT' and (new.source_key is null or pg_catalog.btrim(new.source_key) = '') then
    new.source_key := coalesce(
      nullif(pg_catalog.btrim(new.metadata ->> 'source_key'), ''),
      nullif(pg_catalog.btrim(new.metadata ->> 'local_id'), ''),
      nullif(pg_catalog.btrim(new.metadata ->> 'client_key'), ''),
      'generated:' || pg_catalog.gen_random_uuid()::text
    );
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb)
    || pg_catalog.jsonb_build_object('source_key', new.source_key);
  return new;
end;
$$;

drop trigger if exists enforce_technical_proposal_items_source_key
  on public.technical_proposal_items;
create trigger enforce_technical_proposal_items_source_key
before insert or update of source_key
on public.technical_proposal_items
for each row execute function public.enforce_technical_proposal_source_key();

drop trigger if exists enforce_technical_proposal_resources_source_key
  on public.technical_proposal_resources;
create trigger enforce_technical_proposal_resources_source_key
before insert or update of source_key
on public.technical_proposal_resources
for each row execute function public.enforce_technical_proposal_source_key();

revoke all on function public.enforce_technical_proposal_source_key() from public;
revoke all on function public.enforce_technical_proposal_source_key() from anon;
revoke all on function public.enforce_technical_proposal_source_key() from authenticated;
revoke all on function public.enforce_technical_proposal_source_key() from service_role;

alter table public.cotizacion_presupuesto_partidas
  add column if not exists pt_structure_key text,
  add column if not exists sync_status text,
  add column if not exists sync_reason text,
  add column if not exists sync_payload jsonb not null default '{}'::jsonb;

alter table public.cotizacion_presupuesto_recursos
  add column if not exists pt_resource_source_key text,
  add column if not exists sync_status text,
  add column if not exists sync_reason text,
  add column if not exists sync_payload jsonb not null default '{}'::jsonb;

alter table public.cotizacion_presupuesto_partidas
  drop constraint if exists cotizacion_presupuesto_partidas_sync_status_check;

alter table public.cotizacion_presupuesto_partidas
  add constraint cotizacion_presupuesto_partidas_sync_status_check
  check (sync_status is null or sync_status in ('SYNCED', 'REQUIRES_REVIEW', 'REMOVED_FROM_PT'));

alter table public.cotizacion_presupuesto_partidas
  drop constraint if exists cotizacion_presupuesto_partidas_sync_payload_object;

alter table public.cotizacion_presupuesto_partidas
  add constraint cotizacion_presupuesto_partidas_sync_payload_object
  check (jsonb_typeof(sync_payload) = 'object');

alter table public.cotizacion_presupuesto_recursos
  drop constraint if exists cotizacion_presupuesto_recursos_sync_status_check;

alter table public.cotizacion_presupuesto_recursos
  add constraint cotizacion_presupuesto_recursos_sync_status_check
  check (sync_status is null or sync_status in ('SYNCED', 'REQUIRES_REVIEW', 'REMOVED_FROM_PT'));

alter table public.cotizacion_presupuesto_recursos
  drop constraint if exists cotizacion_presupuesto_recursos_sync_payload_object;

alter table public.cotizacion_presupuesto_recursos
  add constraint cotizacion_presupuesto_recursos_sync_payload_object
  check (jsonb_typeof(sync_payload) = 'object');

-- Las claves sobreviven aunque la fila PT origen sea eliminada. La FK nullable
-- conserva la trazabilidad viva mientras existe el origen y libera la baja segura.
alter table public.cotizacion_presupuesto_partidas
  drop constraint if exists cotizacion_presupuesto_partidas_pt_item_fkey;

alter table public.cotizacion_presupuesto_partidas
  add constraint cotizacion_presupuesto_partidas_pt_item_fkey
  foreign key (propuesta_tecnica_item_id)
  references public.technical_proposal_items(id)
  on delete set null;

alter table public.cotizacion_presupuesto_recursos
  drop constraint if exists cotizacion_presupuesto_recursos_pt_recurso_fkey;

alter table public.cotizacion_presupuesto_recursos
  add constraint cotizacion_presupuesto_recursos_pt_recurso_fkey
  foreign key (propuesta_tecnica_recurso_id)
  references public.technical_proposal_resources(id)
  on delete set null;

-- -----------------------------------------------------------------------------
-- 2. Backfill determinista
-- -----------------------------------------------------------------------------

update public.cotizacion_presupuesto_partidas cpp
set
  pt_structure_key = 'item:' || tpi.source_key,
  sync_status = 'SYNCED',
  sync_reason = null,
  sync_payload = jsonb_build_object(
    'kind', 'item',
    'generated_observaciones', coalesce(tpi.technical_description, ''),
    'source_item_id', tpi.id,
    'source_key', tpi.source_key
  )
from public.technical_proposal_items tpi
where cpp.propuesta_tecnica_item_id = tpi.id
  and cpp.tipo <> 'GRUPO_RECURSOS'
  and (cpp.pt_structure_key is null or trim(cpp.pt_structure_key) = '');

update public.cotizacion_presupuesto_partidas cpp
set
  pt_structure_key = 'resource-group:' || tpi.source_key || ':' ||
    lower(regexp_replace(trim(coalesce((
      select tpr.resource_category
      from public.cotizacion_presupuesto_recursos cpr
      join public.technical_proposal_resources tpr
        on tpr.id = cpr.propuesta_tecnica_recurso_id
      where cpr.partida_id = cpp.id
      order by tpr.sort_order, tpr.id
      limit 1
    ), cpp.descripcion, 'recursos')), '[[:space:]]+', ' ', 'g')),
  sync_status = 'SYNCED',
  sync_reason = null,
  sync_payload = jsonb_build_object(
    'kind', 'resource_group',
    'generated_observaciones', 'Grupo economico generado desde recursos PT asociados a titulo/subtitulo.',
    'source_item_id', tpi.id,
    'source_key', tpi.source_key
  )
from public.technical_proposal_items tpi
where cpp.propuesta_tecnica_item_id = tpi.id
  and cpp.tipo = 'GRUPO_RECURSOS'
  and (cpp.pt_structure_key is null or trim(cpp.pt_structure_key) = '');

-- Si datos legacy contienen duplicados, se conserva una clave canonica y el resto
-- queda explicitamente marcado para revision en vez de impedir la migracion.
with ranked as (
  select
    cpp.id,
    row_number() over (
      partition by cpp.presupuesto_id, cpp.pt_structure_key
      order by cpp.creado_at, cpp.id
    ) as position
  from public.cotizacion_presupuesto_partidas cpp
  where cpp.pt_structure_key is not null
)
update public.cotizacion_presupuesto_partidas cpp
set
  pt_structure_key = 'legacy-duplicate:' || cpp.id::text,
  sync_status = 'REQUIRES_REVIEW',
  sync_reason = 'BACKFILL_DUPLICATE_STRUCTURE_KEY'
from ranked
where ranked.id = cpp.id
  and ranked.position > 1;

update public.cotizacion_presupuesto_recursos cpr
set
  pt_resource_source_key = tpr.source_key,
  sync_status = 'SYNCED',
  sync_reason = null,
  sync_payload = jsonb_build_object(
    'generated_observaciones', concat_ws(
      ' | ',
      nullif(tpr.comentario, ''),
      case when tpr.tiempo is not null then 'Tiempo PT: ' || tpr.tiempo::text else null end
    ),
    'source_resource_id', tpr.id,
    'source_key', tpr.source_key
  )
from public.technical_proposal_resources tpr
where cpr.propuesta_tecnica_recurso_id = tpr.id
  and (cpr.pt_resource_source_key is null or trim(cpr.pt_resource_source_key) = '');

with ranked as (
  select
    cpr.id,
    row_number() over (
      partition by cpr.propuesta_tecnica_recurso_id
      order by cpr.creado_at, cpr.id
    ) as position
  from public.cotizacion_presupuesto_recursos cpr
  where cpr.propuesta_tecnica_recurso_id is not null
)
update public.cotizacion_presupuesto_recursos cpr
set
  propuesta_tecnica_recurso_id = null,
  pt_resource_source_key = 'legacy-duplicate:' || cpr.id::text,
  sync_status = 'REQUIRES_REVIEW',
  sync_reason = 'BACKFILL_DUPLICATE_RESOURCE_TRACE'
from ranked
where ranked.id = cpr.id
  and ranked.position > 1;

create unique index if not exists cotizacion_presupuesto_partidas_pt_structure_key_unique
  on public.cotizacion_presupuesto_partidas (presupuesto_id, pt_structure_key)
  where pt_structure_key is not null;

create unique index if not exists cotizacion_presupuesto_recursos_pt_trace_unique
  on public.cotizacion_presupuesto_recursos (propuesta_tecnica_recurso_id)
  where propuesta_tecnica_recurso_id is not null;

create index if not exists cotizacion_presupuesto_recursos_pt_source_key_idx
  on public.cotizacion_presupuesto_recursos (pt_resource_source_key)
  where pt_resource_source_key is not null;

create index if not exists cotizacion_presupuesto_partidas_sync_status_idx
  on public.cotizacion_presupuesto_partidas (presupuesto_id, sync_status)
  where sync_status is not null;

-- -----------------------------------------------------------------------------
-- 3. RPC transaccional de reconciliacion
-- -----------------------------------------------------------------------------

create or replace function public.reconcile_budget_from_technical_proposal(
  p_propuesta_tecnica_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_pt public.technical_proposals%rowtype;
  v_budget public.cotizacion_presupuestos%rowtype;
  v_item record;
  v_group record;
  v_resource record;
  v_stale_resource record;
  v_stale_part record;
  v_budget_item_id uuid;
  v_parent_budget_id uuid;
  v_destination_id uuid;
  v_structure_key text;
  v_group_key text;
  v_resource_key text;
  v_generated_observaciones text;
  v_transition_part_id uuid;
  v_rows_changed integer := 0;
  v_existing_resource record;
  v_master_changed boolean := false;
  v_resource_sync_status text;
  v_resource_sync_reason text;
  v_resource_sync_payload jsonb;
  v_target_base_price numeric;
  v_target_offer_price numeric;
  v_target_price_origin text;
  v_target_reference_price numeric;
  v_item_map jsonb := '{}'::jsonb;
  v_group_map jsonb := '{}'::jsonb;
  v_desired_part_keys text[] := '{}'::text[];
  v_desired_resource_keys text[] := '{}'::text[];
  v_inserted_parts integer := 0;
  v_updated_parts integer := 0;
  v_deleted_parts integer := 0;
  v_review_parts integer := 0;
  v_inserted_resources integer := 0;
  v_updated_resources integer := 0;
  v_deleted_resources integer := 0;
  v_review_resources integer := 0;
  v_has_manual_economics boolean;
begin
  if v_actor_id is null then
    raise exception 'Usuario no autenticado para reconciliar presupuesto desde PT.';
  end if;

  if p_propuesta_tecnica_id is null then
    raise exception 'p_propuesta_tecnica_id es obligatorio.';
  end if;

  if not public.can_use_module('cotizaciones', 'edit') then
    raise exception 'No tienes permiso para reconciliar presupuestos de cotizacion.';
  end if;

  if not public.can_use_module('technical_proposals', 'view') then
    raise exception 'No tienes permiso para leer Propuestas Tecnicas.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pt_budget_reconcile:' || p_propuesta_tecnica_id::text, 0));

  select *
  into v_pt
  from public.technical_proposals tp
  where tp.id = p_propuesta_tecnica_id
  for update;

  if v_pt.id is null then
    raise exception 'No existe la Propuesta Tecnica indicada.';
  end if;

  if coalesce(v_pt.work_status, '') <> 'Completado' then
    raise exception 'Solo una Propuesta Tecnica completada puede reconciliarse con presupuesto.';
  end if;

  select *
  into v_budget
  from public.cotizacion_presupuestos cp
  where cp.propuesta_tecnica_id = v_pt.id
  for update;

  if v_budget.id is null then
    raise exception 'La Propuesta Tecnica no tiene un presupuesto vinculado.';
  end if;

  if v_budget.estado <> 'BORRADOR' then
    raise exception 'Solo un presupuesto BORRADOR puede reconciliarse automaticamente. Estado actual: %.', v_budget.estado;
  end if;

  if exists (
    select 1
    from public.technical_proposal_resources tpr
    where tpr.technical_proposal_id = v_pt.id
      and tpr.resource_id is null
  ) then
    raise exception 'La PT contiene recursos sin recurso_id del catalogo maestro.';
  end if;

  -- Un PARTIDA con recursos directos no puede convertirse a CAPITULO/SUBCAPITULO
  -- por el trigger jerarquico vigente. Reubicamos primero sus dependencias en un
  -- grupo transitorio valido; mas adelante cada recurso va a su grupo definitivo
  -- y el grupo transitorio se elimina o queda REQUIRES_REVIEW si conserva datos.
  for v_group in
    select
      tpi.id as item_id,
      tpi.source_key as item_source_key,
      tpi.item_number,
      tpi.sort_order as item_sort_order,
      cpp.id as budget_item_id
    from public.technical_proposal_items tpi
    join public.cotizacion_presupuesto_partidas cpp
      on cpp.presupuesto_id = v_budget.id
     and cpp.pt_structure_key = 'item:' || tpi.source_key
    where tpi.technical_proposal_id = v_pt.id
      and tpi.item_type <> 'activity'
      and cpp.tipo = 'PARTIDA'
      and exists (
        select 1
        from public.cotizacion_presupuesto_recursos cpr
        where cpr.partida_id = cpp.id
      )
    order by tpi.sort_order, tpi.id
  loop
    v_group_key := 'transition-resource-group:' || v_group.item_source_key;

    select cpp.id
    into v_transition_part_id
    from public.cotizacion_presupuesto_partidas cpp
    where cpp.presupuesto_id = v_budget.id
      and cpp.pt_structure_key = v_group_key
    for update;

    if v_transition_part_id is null then
      insert into public.cotizacion_presupuesto_partidas (
        presupuesto_id, parent_id, codigo, tipo, descripcion, unidad, cantidad,
        orden, observaciones, propuesta_tecnica_item_id, pt_structure_key,
        sync_status, sync_reason, sync_payload
      ) values (
        v_budget.id,
        v_group.budget_item_id,
        concat_ws('.', v_group.item_number, 'RT'),
        'GRUPO_RECURSOS',
        'RECURSOS EN TRANSICION PT',
        null,
        null,
        coalesce(v_group.item_sort_order, 0) * 1000 + 999,
        'Grupo transitorio para cambio seguro de tipo estructural PT.',
        v_group.item_id,
        v_group_key,
        'SYNCED',
        null,
        jsonb_build_object(
          'kind', 'transition_resource_group',
          'generated_observaciones', 'Grupo transitorio para cambio seguro de tipo estructural PT.',
          'source_item_id', v_group.item_id,
          'source_key', v_group.item_source_key
        )
      )
      returning id into v_transition_part_id;
      v_inserted_parts := v_inserted_parts + 1;
    end if;

    update public.cotizacion_presupuesto_recursos
    set partida_id = v_transition_part_id
    where partida_id = v_group.budget_item_id;
    get diagnostics v_rows_changed = row_count;
    v_updated_resources := v_updated_resources + v_rows_changed;
  end loop;

  -- Nodos estructurales. La clave no depende de nombre, orden ni padre.
  for v_item in
    select tpi.*
    from public.technical_proposal_items tpi
    where tpi.technical_proposal_id = v_pt.id
    order by tpi.level asc, tpi.sort_order asc, tpi.id asc
  loop
    v_structure_key := 'item:' || v_item.source_key;
    v_desired_part_keys := array_append(v_desired_part_keys, v_structure_key);
    v_parent_budget_id := null;

    if v_item.parent_id is not null then
      v_parent_budget_id := nullif(v_item_map ->> v_item.parent_id::text, '')::uuid;
      if v_parent_budget_id is null then
        raise exception 'No se pudo resolver el padre presupuestal del item PT %.', v_item.id;
      end if;
    end if;

    select cpp.id
    into v_budget_item_id
    from public.cotizacion_presupuesto_partidas cpp
    where cpp.presupuesto_id = v_budget.id
      and cpp.pt_structure_key = v_structure_key
    for update;

    if v_budget_item_id is null then
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
        propuesta_tecnica_item_id,
        pt_structure_key,
        sync_status,
        sync_reason,
        sync_payload
      ) values (
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
        case
          when v_item.item_type = 'activity' and v_item.estimated_time_value > 0 then v_item.estimated_time_value
          else null
        end,
        v_item.sort_order,
        v_item.technical_description,
        v_item.id,
        v_structure_key,
        'SYNCED',
        null,
        jsonb_build_object(
          'kind', 'item',
          'generated_observaciones', coalesce(v_item.technical_description, ''),
          'source_item_id', v_item.id,
          'source_key', v_item.source_key
        )
      )
      returning id into v_budget_item_id;
      v_inserted_parts := v_inserted_parts + 1;
    else
      update public.cotizacion_presupuesto_partidas
      set
        parent_id = v_parent_budget_id,
        codigo = v_item.item_number,
        tipo = case
          when v_item.item_type = 'group' then 'CAPITULO'
          when v_item.item_type = 'subgroup' then 'SUBCAPITULO'
          else 'PARTIDA'
        end,
        descripcion = v_item.title,
        unidad = case when v_item.item_type = 'activity' then v_item.estimated_time_unit else null end,
        cantidad = case
          when v_item.item_type = 'activity' and v_item.estimated_time_value > 0 then v_item.estimated_time_value
          else null
        end,
        orden = v_item.sort_order,
        propuesta_tecnica_item_id = v_item.id,
        sync_status = 'SYNCED',
        sync_reason = null,
        sync_payload = jsonb_build_object(
          'kind', 'item',
          'generated_observaciones', coalesce(v_item.technical_description, ''),
          'source_item_id', v_item.id,
          'source_key', v_item.source_key
        )
      where id = v_budget_item_id
        and row(
          parent_id, codigo, tipo, descripcion, unidad, cantidad, orden,
          propuesta_tecnica_item_id, sync_status, sync_reason, sync_payload
        ) is distinct from row(
          v_parent_budget_id,
          v_item.item_number,
          case
            when v_item.item_type = 'group' then 'CAPITULO'
            when v_item.item_type = 'subgroup' then 'SUBCAPITULO'
            else 'PARTIDA'
          end,
          v_item.title,
          case when v_item.item_type = 'activity' then v_item.estimated_time_unit else null end,
          case
            when v_item.item_type = 'activity' and v_item.estimated_time_value > 0 then v_item.estimated_time_value
            else null
          end,
          v_item.sort_order,
          v_item.id,
          'SYNCED',
          null::text,
          jsonb_build_object(
            'kind', 'item',
            'generated_observaciones', coalesce(v_item.technical_description, ''),
            'source_item_id', v_item.id,
            'source_key', v_item.source_key
          )
        );
      get diagnostics v_rows_changed = row_count;
      v_updated_parts := v_updated_parts + v_rows_changed;
    end if;

    v_item_map := v_item_map || jsonb_build_object(v_item.id::text, v_budget_item_id::text);
  end loop;

  -- Grupos economicos para recursos asociados directamente a titulo/subtitulo.
  for v_group in
    select
      tpi.id as item_id,
      tpi.source_key as item_source_key,
      tpi.item_number,
      tpi.sort_order as item_sort_order,
      tpr.resource_category,
      min(tpr.sort_order) as first_resource_order
    from public.technical_proposal_resources tpr
    join public.technical_proposal_items tpi on tpi.id = tpr.technical_proposal_item_id
    where tpr.technical_proposal_id = v_pt.id
      and tpi.item_type <> 'activity'
    group by tpi.id, tpi.source_key, tpi.item_number, tpi.sort_order, tpr.resource_category
    order by tpi.sort_order, min(tpr.sort_order), tpr.resource_category
  loop
    v_group_key := 'resource-group:' || v_group.item_source_key || ':' ||
      lower(regexp_replace(trim(v_group.resource_category), '[[:space:]]+', ' ', 'g'));
    v_desired_part_keys := array_append(v_desired_part_keys, v_group_key);
    v_parent_budget_id := nullif(v_item_map ->> v_group.item_id::text, '')::uuid;

    if v_parent_budget_id is null then
      raise exception 'No se pudo resolver el item padre del grupo de recursos %.', v_group_key;
    end if;

    select cpp.id
    into v_budget_item_id
    from public.cotizacion_presupuesto_partidas cpp
    where cpp.presupuesto_id = v_budget.id
      and cpp.pt_structure_key = v_group_key
    for update;

    if v_budget_item_id is null then
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
        propuesta_tecnica_item_id,
        pt_structure_key,
        sync_status,
        sync_reason,
        sync_payload
      ) values (
        v_budget.id,
        v_parent_budget_id,
        concat_ws('.', v_group.item_number, 'R'),
        'GRUPO_RECURSOS',
        upper(v_group.resource_category),
        null,
        null,
        coalesce(v_group.item_sort_order, 0) * 1000 + coalesce(v_group.first_resource_order, 0),
        'Grupo economico generado desde recursos PT asociados a titulo/subtitulo.',
        v_group.item_id,
        v_group_key,
        'SYNCED',
        null,
        jsonb_build_object(
          'kind', 'resource_group',
          'generated_observaciones', 'Grupo economico generado desde recursos PT asociados a titulo/subtitulo.',
          'source_item_id', v_group.item_id,
          'source_key', v_group.item_source_key,
          'resource_category', v_group.resource_category
        )
      )
      returning id into v_budget_item_id;
      v_inserted_parts := v_inserted_parts + 1;
    else
      update public.cotizacion_presupuesto_partidas
      set
        parent_id = v_parent_budget_id,
        codigo = concat_ws('.', v_group.item_number, 'R'),
        tipo = 'GRUPO_RECURSOS',
        descripcion = upper(v_group.resource_category),
        unidad = null,
        cantidad = null,
        orden = coalesce(v_group.item_sort_order, 0) * 1000 + coalesce(v_group.first_resource_order, 0),
        propuesta_tecnica_item_id = v_group.item_id,
        sync_status = 'SYNCED',
        sync_reason = null,
        sync_payload = jsonb_build_object(
          'kind', 'resource_group',
          'generated_observaciones', 'Grupo economico generado desde recursos PT asociados a titulo/subtitulo.',
          'source_item_id', v_group.item_id,
          'source_key', v_group.item_source_key,
          'resource_category', v_group.resource_category
        )
      where id = v_budget_item_id
        and row(
          parent_id, codigo, tipo, descripcion, unidad, cantidad, orden,
          propuesta_tecnica_item_id, sync_status, sync_reason, sync_payload
        ) is distinct from row(
          v_parent_budget_id,
          concat_ws('.', v_group.item_number, 'R'),
          'GRUPO_RECURSOS',
          upper(v_group.resource_category),
          null::text,
          null::numeric,
          coalesce(v_group.item_sort_order, 0) * 1000 + coalesce(v_group.first_resource_order, 0),
          v_group.item_id,
          'SYNCED',
          null::text,
          jsonb_build_object(
            'kind', 'resource_group',
            'generated_observaciones', 'Grupo economico generado desde recursos PT asociados a titulo/subtitulo.',
            'source_item_id', v_group.item_id,
            'source_key', v_group.item_source_key,
            'resource_category', v_group.resource_category
          )
        );
      get diagnostics v_rows_changed = row_count;
      v_updated_parts := v_updated_parts + v_rows_changed;
    end if;

    v_group_map := v_group_map || jsonb_build_object(v_group_key, v_budget_item_id::text);
  end loop;

  -- Recursos: identidad por instancia PT, nunca por recurso_id maestro.
  for v_resource in
    select
      tpr.*,
      tpi.item_type,
      tpi.source_key as item_source_key
    from public.technical_proposal_resources tpr
    join public.technical_proposal_items tpi on tpi.id = tpr.technical_proposal_item_id
    where tpr.technical_proposal_id = v_pt.id
    order by tpi.sort_order, tpr.sort_order, tpr.id
  loop
    v_resource_key := v_resource.source_key;
    v_desired_resource_keys := array_append(v_desired_resource_keys, v_resource_key);

    if v_resource.item_type = 'activity' then
      v_destination_id := nullif(v_item_map ->> v_resource.technical_proposal_item_id::text, '')::uuid;
    else
      v_group_key := 'resource-group:' || v_resource.item_source_key || ':' ||
        lower(regexp_replace(trim(v_resource.resource_category), '[[:space:]]+', ' ', 'g'));
      v_destination_id := nullif(v_group_map ->> v_group_key, '')::uuid;
    end if;

    if v_destination_id is null then
      raise exception 'No se pudo resolver el destino presupuestal del recurso PT %.', v_resource.id;
    end if;

    v_generated_observaciones := concat_ws(
      ' | ',
      nullif(v_resource.comentario, ''),
      case when v_resource.tiempo is not null then 'Tiempo PT: ' || v_resource.tiempo::text else null end
    );

    select cpr.*
    into v_existing_resource
    from public.cotizacion_presupuesto_recursos cpr
    join public.cotizacion_presupuesto_partidas cpp on cpp.id = cpr.partida_id
    where cpp.presupuesto_id = v_budget.id
      and cpr.pt_resource_source_key = v_resource_key
    for update of cpr;

    if v_existing_resource.id is null then
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
        marca_snapshot,
        pt_resource_source_key,
        sync_status,
        sync_reason,
        sync_payload
      ) values (
        v_destination_id,
        v_resource.resource_id,
        greatest(coalesce(v_resource.cantidad, 1), 0.0001),
        0,
        0,
        v_resource.sort_order,
        v_generated_observaciones,
        v_resource.id,
        v_resource.codigo_recurso,
        v_resource.codigo_fabricante,
        v_resource.descripcion,
        v_resource.tipo_recurso,
        v_resource.unidad,
        v_resource.precio_unitario_ref,
        v_resource.moneda_codigo,
        v_resource.proveedor,
        v_resource.marca,
        v_resource_key,
        'SYNCED',
        null,
        jsonb_build_object(
          'generated_observaciones', coalesce(v_generated_observaciones, ''),
          'source_resource_id', v_resource.id,
          'source_key', v_resource.source_key
        )
      );
      v_inserted_resources := v_inserted_resources + 1;
    else
      v_master_changed := v_existing_resource.recurso_id is distinct from v_resource.resource_id;
      v_has_manual_economics :=
        coalesce(v_existing_resource.precio_revisado, false)
        or v_existing_resource.precio_revisado_at is not null
        or v_existing_resource.precio_revisado_por is not null
        or coalesce(trim(v_existing_resource.precio_revisado_nota), '') <> ''
        or v_existing_resource.precio_historico_id is not null
        or (
          coalesce(v_existing_resource.precio_base_origen, 'MANUAL') <> 'MAESTRO'
          and not (
            coalesce(v_existing_resource.precio_base_origen, 'MANUAL') = 'MANUAL'
            and coalesce(v_existing_resource.precio_base_unitario, 0) = 0
            and coalesce(v_existing_resource.precio_ofertado_unitario, 0) = 0
          )
        )
        or abs(
          coalesce(v_existing_resource.precio_base_unitario, 0)
          - coalesce(v_existing_resource.precio_unitario_ref_snapshot, v_existing_resource.precio_base_unitario, 0)
        ) > 0.0001
        or abs(
          coalesce(v_existing_resource.precio_ofertado_unitario, 0)
          - coalesce(v_existing_resource.precio_base_unitario, 0)
        ) > 0.0001
        or coalesce(trim(v_existing_resource.observaciones), '') <>
          coalesce(trim(v_existing_resource.sync_payload ->> 'generated_observaciones'), '');

      v_target_base_price := v_existing_resource.precio_base_unitario;
      v_target_offer_price := v_existing_resource.precio_ofertado_unitario;
      v_target_price_origin := v_existing_resource.precio_base_origen;
      v_target_reference_price := v_existing_resource.precio_unitario_ref_snapshot;

      if v_master_changed and not v_has_manual_economics then
        v_target_base_price := greatest(coalesce(v_resource.precio_unitario_ref, 0), 0);
        v_target_offer_price := greatest(coalesce(v_resource.precio_unitario_ref, 0), 0);
        v_target_price_origin := 'MAESTRO';
        v_target_reference_price := v_resource.precio_unitario_ref;
      end if;

      if (v_master_changed and v_has_manual_economics)
        or v_existing_resource.sync_reason = 'RESOURCE_MASTER_CHANGED_WITH_ECONOMICS'
      then
        v_resource_sync_status := 'REQUIRES_REVIEW';
        v_resource_sync_reason := 'RESOURCE_MASTER_CHANGED_WITH_ECONOMICS';
        v_resource_sync_payload := jsonb_build_object(
          'generated_observaciones', coalesce(v_generated_observaciones, ''),
          'source_resource_id', v_resource.id,
          'source_key', v_resource.source_key,
          'previous_resource_id', coalesce(
            v_existing_resource.sync_payload ->> 'previous_resource_id',
            v_existing_resource.recurso_id::text
          ),
          'current_resource_id', v_resource.resource_id
        );
      else
        v_resource_sync_status := 'SYNCED';
        v_resource_sync_reason := null;
        v_resource_sync_payload := jsonb_build_object(
          'generated_observaciones', coalesce(v_generated_observaciones, ''),
          'source_resource_id', v_resource.id,
          'source_key', v_resource.source_key
        );
      end if;

      update public.cotizacion_presupuesto_recursos
      set
        partida_id = v_destination_id,
        recurso_id = v_resource.resource_id,
        cantidad_presupuestada = greatest(coalesce(v_resource.cantidad, 1), 0.0001),
        precio_base_unitario = v_target_base_price,
        precio_ofertado_unitario = v_target_offer_price,
        precio_base_origen = v_target_price_origin,
        orden = v_resource.sort_order,
        propuesta_tecnica_recurso_id = v_resource.id,
        codigo_recurso_snapshot = v_resource.codigo_recurso,
        codigo_fabricante_snapshot = v_resource.codigo_fabricante,
        descripcion_snapshot = v_resource.descripcion,
        tipo_recurso_snapshot = v_resource.tipo_recurso,
        unidad_snapshot = v_resource.unidad,
        precio_unitario_ref_snapshot = v_target_reference_price,
        moneda_codigo_snapshot = v_resource.moneda_codigo,
        proveedor_snapshot = v_resource.proveedor,
        marca_snapshot = v_resource.marca,
        sync_status = v_resource_sync_status,
        sync_reason = v_resource_sync_reason,
        sync_payload = v_resource_sync_payload
      where id = v_existing_resource.id
        and row(
          partida_id, recurso_id, cantidad_presupuestada, precio_base_unitario,
          precio_ofertado_unitario, precio_base_origen, orden,
          propuesta_tecnica_recurso_id, codigo_recurso_snapshot,
          codigo_fabricante_snapshot, descripcion_snapshot,
          tipo_recurso_snapshot, unidad_snapshot, precio_unitario_ref_snapshot,
          moneda_codigo_snapshot, proveedor_snapshot, marca_snapshot,
          sync_status, sync_reason, sync_payload
        ) is distinct from row(
          v_destination_id,
          v_resource.resource_id,
          greatest(coalesce(v_resource.cantidad, 1), 0.0001),
          v_target_base_price,
          v_target_offer_price,
          v_target_price_origin,
          v_resource.sort_order,
          v_resource.id,
          v_resource.codigo_recurso,
          v_resource.codigo_fabricante,
          v_resource.descripcion,
          v_resource.tipo_recurso,
          v_resource.unidad,
          v_target_reference_price,
          v_resource.moneda_codigo,
          v_resource.proveedor,
          v_resource.marca,
          v_resource_sync_status,
          v_resource_sync_reason,
          v_resource_sync_payload
        );
      get diagnostics v_rows_changed = row_count;
      v_updated_resources := v_updated_resources + v_rows_changed;
    end if;
  end loop;

  -- Bajas de recursos. Se elimina solo cuando no existe evidencia economica manual.
  for v_stale_resource in
    select cpr.*
    from public.cotizacion_presupuesto_recursos cpr
    join public.cotizacion_presupuesto_partidas cpp on cpp.id = cpr.partida_id
    where cpp.presupuesto_id = v_budget.id
      and cpr.pt_resource_source_key is not null
      and not (cpr.pt_resource_source_key = any(v_desired_resource_keys))
    for update of cpr
  loop
    v_has_manual_economics :=
      coalesce(v_stale_resource.precio_revisado, false)
      or v_stale_resource.precio_revisado_at is not null
      or v_stale_resource.precio_revisado_por is not null
      or coalesce(trim(v_stale_resource.precio_revisado_nota), '') <> ''
      or v_stale_resource.precio_historico_id is not null
      or (
        coalesce(v_stale_resource.precio_base_origen, 'MANUAL') <> 'MAESTRO'
        and not (
          coalesce(v_stale_resource.precio_base_origen, 'MANUAL') = 'MANUAL'
          and coalesce(v_stale_resource.precio_base_unitario, 0) = 0
          and coalesce(v_stale_resource.precio_ofertado_unitario, 0) = 0
        )
      )
      or abs(
        coalesce(v_stale_resource.precio_base_unitario, 0)
        - coalesce(v_stale_resource.precio_unitario_ref_snapshot, v_stale_resource.precio_base_unitario, 0)
      ) > 0.0001
      or abs(
        coalesce(v_stale_resource.precio_ofertado_unitario, 0)
        - coalesce(v_stale_resource.precio_base_unitario, 0)
      ) > 0.0001
      or coalesce(trim(v_stale_resource.observaciones), '') <>
        coalesce(trim(v_stale_resource.sync_payload ->> 'generated_observaciones'), '');

    if v_has_manual_economics then
      update public.cotizacion_presupuesto_recursos
      set
        propuesta_tecnica_recurso_id = null,
        sync_status = 'REQUIRES_REVIEW',
        sync_reason = 'REMOVED_FROM_PT_WITH_MANUAL_ECONOMICS'
      where id = v_stale_resource.id
        and row(propuesta_tecnica_recurso_id, sync_status, sync_reason)
          is distinct from row(null::uuid, 'REQUIRES_REVIEW', 'REMOVED_FROM_PT_WITH_MANUAL_ECONOMICS');
      get diagnostics v_rows_changed = row_count;
      v_review_resources := v_review_resources + v_rows_changed;
    else
      delete from public.cotizacion_presupuesto_recursos
      where id = v_stale_resource.id;
      v_deleted_resources := v_deleted_resources + 1;
    end if;
  end loop;

  -- Bajas estructurales, de abajo hacia arriba. Filas con observaciones manuales
  -- o descendencia preservada quedan para revision y no se pierden.
  for v_stale_part in
    with recursive budget_tree as (
      select cpp.id, cpp.parent_id, 0 as depth
      from public.cotizacion_presupuesto_partidas cpp
      where cpp.presupuesto_id = v_budget.id
        and cpp.parent_id is null

      union all

      select child.id, child.parent_id, parent.depth + 1
      from budget_tree parent
      join public.cotizacion_presupuesto_partidas child on child.parent_id = parent.id
      where child.presupuesto_id = v_budget.id
    )
    select cpp.*, budget_tree.depth
    from public.cotizacion_presupuesto_partidas cpp
    join budget_tree on budget_tree.id = cpp.id
    where cpp.presupuesto_id = v_budget.id
      and cpp.pt_structure_key is not null
      and not (cpp.pt_structure_key = any(v_desired_part_keys))
    order by budget_tree.depth desc, cpp.orden desc, cpp.id
  loop
    if coalesce(trim(v_stale_part.observaciones), '') <>
      coalesce(trim(v_stale_part.sync_payload ->> 'generated_observaciones'), '')
      or exists (
        select 1 from public.cotizacion_presupuesto_partidas child where child.parent_id = v_stale_part.id
      )
      or exists (
        select 1 from public.cotizacion_presupuesto_recursos cpr where cpr.partida_id = v_stale_part.id
      )
    then
      update public.cotizacion_presupuesto_partidas
      set
        propuesta_tecnica_item_id = null,
        sync_status = 'REQUIRES_REVIEW',
        sync_reason = 'REMOVED_FROM_PT_WITH_MANUAL_OR_DEPENDENT_DATA'
      where id = v_stale_part.id
        and row(propuesta_tecnica_item_id, sync_status, sync_reason)
          is distinct from row(null::uuid, 'REQUIRES_REVIEW', 'REMOVED_FROM_PT_WITH_MANUAL_OR_DEPENDENT_DATA');
      get diagnostics v_rows_changed = row_count;
      v_review_parts := v_review_parts + v_rows_changed;
    else
      delete from public.cotizacion_presupuesto_partidas
      where id = v_stale_part.id;
      v_deleted_parts := v_deleted_parts + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'technical_proposal_id', v_pt.id,
    'budget_id', v_budget.id,
    'budget_state', v_budget.estado,
    'parts_inserted', v_inserted_parts,
    'parts_updated', v_updated_parts,
    'parts_deleted', v_deleted_parts,
    'parts_requiring_review', v_review_parts,
    'resources_inserted', v_inserted_resources,
    'resources_updated', v_updated_resources,
    'resources_deleted', v_deleted_resources,
    'resources_requiring_review', v_review_resources
  );
end;
$$;

revoke all on function public.reconcile_budget_from_technical_proposal(uuid) from public;
revoke all on function public.reconcile_budget_from_technical_proposal(uuid) from anon;
revoke all on function public.reconcile_budget_from_technical_proposal(uuid) from service_role;
grant execute on function public.reconcile_budget_from_technical_proposal(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Guardado PT por upsert, conservando IDs y trazas
-- -----------------------------------------------------------------------------

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
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_proposal_id uuid;
  v_existing_id uuid;
  v_requested_id uuid;
  v_cotizacion_id uuid;
  v_resolved_cotizacion_id uuid;
  v_linked_budget_id uuid;
  v_linked_budget_state text;
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
  v_source_key text;
  v_resource_source_key text;
  v_resource_item_key text;
  v_resource_item_id uuid;
  v_resource_id uuid;
  v_resource_snapshot_id uuid;
  v_item_map jsonb := '{}'::jsonb;
  v_seen_item_ids uuid[] := '{}'::uuid[];
  v_seen_resource_ids uuid[] := '{}'::uuid[];
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

  if v_code = '' then raise exception 'p_proposal.code es obligatorio.'; end if;
  if v_cotizacion_codigo = '' then raise exception 'p_proposal.cotizacion_codigo es obligatorio.'; end if;
  if v_revision = '' then v_revision := 'REV00'; end if;

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
    select c.id into v_resolved_cotizacion_id
    from public.cotizaciones c
    where c.id = v_cotizacion_id
      and c.codigo = v_cotizacion_codigo
      and c.deleted_at is null;
    if v_resolved_cotizacion_id is null then
      raise exception 'p_proposal.cotizacion_id no coincide con p_proposal.cotizacion_codigo.';
    end if;
  else
    select c.id into v_resolved_cotizacion_id
    from public.cotizaciones c
    where c.codigo = v_cotizacion_codigo
      and c.deleted_at is null;
    if v_resolved_cotizacion_id is null then
      raise exception 'No existe una cotizacion activa para p_proposal.cotizacion_codigo.';
    end if;
  end if;

  v_cotizacion_id := v_resolved_cotizacion_id;
  v_document_date := nullif(p_proposal ->> 'document_date', '')::date;

  perform pg_advisory_xact_lock(hashtextextended('technical_proposal_revision:' || v_cotizacion_id::text || ':' || v_revision, 0));

  if v_requested_id is not null then
    -- Mantiene el mismo orden de locks que reconcile/crear para evitar un ciclo
    -- entre el lock de la fila PT y el lock logico PT -> presupuesto.
    perform pg_advisory_xact_lock(hashtextextended('pt_budget_reconcile:' || v_requested_id::text, 0));

    select tp.id into v_existing_id
    from public.technical_proposals tp
    where tp.id = v_requested_id
    for update;
    if v_existing_id is null then
      raise exception 'p_proposal.id no corresponde a una propuesta tecnica existente.';
    end if;
    if not exists (
      select 1 from public.technical_proposals tp
      where tp.id = v_existing_id
        and tp.cotizacion_id = v_cotizacion_id
        and tp.revision = v_revision
        and tp.code = v_code
    ) then
      raise exception 'p_proposal.id no corresponde a la cotizacion, revision y codigo solicitados.';
    end if;
  else
    select tp.id into v_existing_id
    from public.technical_proposals tp
    where tp.cotizacion_id = v_cotizacion_id
      and tp.revision = v_revision
    for update;
    if v_existing_id is not null then
      raise exception 'Ya existe una Propuesta Tecnica para esta cotizacion y revision. Recarga la revision antes de modificarla.';
    end if;
    if exists (select 1 from public.technical_proposals tp where tp.code = v_code) then
      raise exception 'p_proposal.code ya pertenece a otra Propuesta Tecnica.';
    end if;
  end if;

  if v_existing_id is not null then
    select cp.id, cp.estado
    into v_linked_budget_id, v_linked_budget_state
    from public.cotizacion_presupuestos cp
    where cp.propuesta_tecnica_id = v_existing_id
    for update;

    if v_linked_budget_id is not null and v_linked_budget_state <> 'BORRADOR' then
      raise exception 'La PT tiene un presupuesto % y no admite guardado estructural automatico.', v_linked_budget_state;
    end if;

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
      company_logo_id = case when nullif(p_proposal ->> 'company_logo_id', '') is not null and (p_proposal ->> 'company_logo_id') ~* v_uuid_pattern then (p_proposal ->> 'company_logo_id')::uuid else null end,
      client_logo_id = case when nullif(p_proposal ->> 'client_logo_id', '') is not null and (p_proposal ->> 'client_logo_id') ~* v_uuid_pattern then (p_proposal ->> 'client_logo_id')::uuid else null end,
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
      cotizacion_id, cotizacion_codigo, code, document_type, revision,
      revision_folder, status, mode, work_status, document_date,
      company_logo_id, client_logo_id, header, recipient, presentation,
      commercial_terms, metadata, created_by, updated_by
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
      case when nullif(p_proposal ->> 'company_logo_id', '') is not null and (p_proposal ->> 'company_logo_id') ~* v_uuid_pattern then (p_proposal ->> 'company_logo_id')::uuid else null end,
      case when nullif(p_proposal ->> 'client_logo_id', '') is not null and (p_proposal ->> 'client_logo_id') ~* v_uuid_pattern then (p_proposal ->> 'client_logo_id')::uuid else null end,
      coalesce(p_proposal -> 'header', '{}'::jsonb),
      coalesce(p_proposal -> 'recipient', '{}'::jsonb),
      coalesce(p_proposal -> 'presentation', '{}'::jsonb),
      coalesce(p_proposal -> 'commercial_terms', '{}'::jsonb),
      coalesce(p_proposal -> 'metadata', '{}'::jsonb),
      v_actor_id,
      v_actor_id
    ) returning id into v_proposal_id;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) entry
    group by trim(coalesce(entry ->> 'source_key', entry ->> 'client_key', entry ->> 'id', ''))
    having count(*) > 1
  ) then
    raise exception 'p_items contiene identidades estructurales duplicadas.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_resources) entry
    group by trim(coalesce(
      entry ->> 'source_key',
      entry ->> 'client_key',
      entry #>> '{metadata,local_id}',
      entry ->> 'id',
      ''
    ))
    having count(*) > 1
  ) then
    raise exception 'p_resources contiene identidades de instancia duplicadas.';
  end if;

  -- Libera temporalmente la numeracion para permitir intercambios/reordenamientos
  -- sin colisionar con el unique (technical_proposal_id, item_number).
  update public.technical_proposal_items
  set item_number = '__sync__' || replace(id::text, '-', '')
  where technical_proposal_id = v_proposal_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Cada item de p_items debe ser un objeto JSON.';
    end if;

    v_client_key := trim(coalesce(v_item ->> 'client_key', v_item ->> 'id', ''));
    v_source_key := trim(coalesce(v_item ->> 'source_key', v_client_key, ''));
    if v_client_key = '' or v_source_key = '' then
      raise exception 'Cada item debe incluir client_key o source_key.';
    end if;
    if trim(coalesce(v_item ->> 'item_type', '')) = '' then raise exception 'Item % no tiene item_type.', v_client_key; end if;
    if trim(coalesce(v_item ->> 'item_number', '')) = '' then raise exception 'Item % no tiene item_number.', v_client_key; end if;
    if trim(coalesce(v_item ->> 'title', '')) = '' then raise exception 'Item % no tiene title.', v_client_key; end if;

    select tpi.id, tpi.source_key
    into v_item_id, v_source_key
    from public.technical_proposal_items tpi
    where tpi.technical_proposal_id = v_proposal_id
      and (
        tpi.source_key = v_source_key
        or tpi.id::text = v_client_key
        or tpi.metadata ->> 'client_key' = v_client_key
        or tpi.metadata ->> 'local_id' = v_client_key
      )
    order by case
      when tpi.source_key = v_source_key then 0
      when tpi.id::text = v_client_key then 1
      when tpi.metadata ->> 'client_key' = v_client_key then 2
      else 3
    end
    limit 1
    for update;

    if v_item_id is null then
      v_item_id := gen_random_uuid();
      v_source_key := trim(coalesce(v_item ->> 'source_key', v_client_key));
    end if;

    v_parent_key := trim(coalesce(v_item ->> 'parent_client_key', ''));
    v_parent_id := null;
    if v_parent_key <> '' then
      v_parent_id := nullif(v_item_map ->> v_parent_key, '')::uuid;
      if v_parent_id is null then
        raise exception 'Item % referencia parent_client_key % no insertado.', v_client_key, v_parent_key;
      end if;
    end if;

    insert into public.technical_proposal_items (
      id, technical_proposal_id, source_key, parent_id, item_type, item_number,
      level, sort_order, title, technical_description, estimated_time_value,
      estimated_time_unit, is_complete, internal_comments, metadata
    ) values (
      v_item_id,
      v_proposal_id,
      v_source_key,
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
    )
    on conflict (id) do update set
      parent_id = excluded.parent_id,
      item_type = excluded.item_type,
      item_number = excluded.item_number,
      level = excluded.level,
      sort_order = excluded.sort_order,
      title = excluded.title,
      technical_description = excluded.technical_description,
      estimated_time_value = excluded.estimated_time_value,
      estimated_time_unit = excluded.estimated_time_unit,
      is_complete = excluded.is_complete,
      internal_comments = excluded.internal_comments,
      metadata = excluded.metadata;

    v_item_map := v_item_map || jsonb_build_object(v_client_key, v_item_id::text);
    v_seen_item_ids := array_append(v_seen_item_ids, v_item_id);
    v_items_count := v_items_count + 1;
    v_item_id := null;
  end loop;

  for v_resource in select value from jsonb_array_elements(p_resources)
  loop
    if jsonb_typeof(v_resource) <> 'object' then
      raise exception 'Cada resource de p_resources debe ser un objeto JSON.';
    end if;

    v_resource_item_key := trim(coalesce(v_resource ->> 'client_item_key', v_resource ->> 'technical_proposal_item_id', ''));
    v_resource_source_key := trim(coalesce(
      v_resource ->> 'source_key',
      v_resource ->> 'client_key',
      v_resource #>> '{metadata,local_id}',
      v_resource ->> 'id',
      ''
    ));
    if v_resource_item_key = '' then raise exception 'Cada resource debe incluir client_item_key.'; end if;
    if v_resource_source_key = '' then raise exception 'Cada resource debe incluir una identidad local estable.'; end if;
    if trim(coalesce(v_resource ->> 'resource_category', '')) = '' then raise exception 'Resource asociado a item % no tiene resource_category.', v_resource_item_key; end if;
    if trim(coalesce(v_resource ->> 'descripcion', '')) = '' then raise exception 'Resource asociado a item % no tiene descripcion.', v_resource_item_key; end if;

    v_resource_item_id := nullif(v_item_map ->> v_resource_item_key, '')::uuid;
    if v_resource_item_id is null then
      raise exception 'Resource referencia item % que no existe en p_items.', v_resource_item_key;
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

    select tpr.id, tpr.source_key
    into v_resource_snapshot_id, v_resource_source_key
    from public.technical_proposal_resources tpr
    where tpr.technical_proposal_id = v_proposal_id
      and (
        tpr.source_key = v_resource_source_key
        or tpr.id::text = v_resource_source_key
        or tpr.metadata ->> 'local_id' = v_resource_source_key
      )
    order by case
      when tpr.source_key = v_resource_source_key then 0
      when tpr.id::text = v_resource_source_key then 1
      else 2
    end
    limit 1
    for update;

    if v_resource_snapshot_id is null then
      v_resource_snapshot_id := gen_random_uuid();
      v_resource_source_key := trim(coalesce(
        v_resource ->> 'source_key',
        v_resource ->> 'client_key',
        v_resource #>> '{metadata,local_id}',
        v_resource ->> 'id'
      ));
    end if;

    insert into public.technical_proposal_resources (
      id, technical_proposal_id, source_key, technical_proposal_item_id,
      resource_id, resource_category, codigo_recurso, codigo_fabricante,
      tipo_recurso, descripcion, unidad, cantidad, tiempo, precio_unitario_ref,
      moneda_codigo, proveedor, marca, comentario, detalle_adicional,
      origin_status, metadata, sort_order
    ) values (
      v_resource_snapshot_id,
      v_proposal_id,
      v_resource_source_key,
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
    )
    on conflict (id) do update set
      technical_proposal_item_id = excluded.technical_proposal_item_id,
      resource_id = excluded.resource_id,
      resource_category = excluded.resource_category,
      codigo_recurso = excluded.codigo_recurso,
      codigo_fabricante = excluded.codigo_fabricante,
      tipo_recurso = excluded.tipo_recurso,
      descripcion = excluded.descripcion,
      unidad = excluded.unidad,
      cantidad = excluded.cantidad,
      tiempo = excluded.tiempo,
      precio_unitario_ref = excluded.precio_unitario_ref,
      moneda_codigo = excluded.moneda_codigo,
      proveedor = excluded.proveedor,
      marca = excluded.marca,
      comentario = excluded.comentario,
      detalle_adicional = excluded.detalle_adicional,
      origin_status = excluded.origin_status,
      metadata = excluded.metadata,
      sort_order = excluded.sort_order;

    v_seen_resource_ids := array_append(v_seen_resource_ids, v_resource_snapshot_id);
    v_resources_count := v_resources_count + 1;
    v_resource_snapshot_id := null;
  end loop;

  delete from public.technical_proposal_files
  where technical_proposal_id = v_proposal_id;

  delete from public.technical_proposal_resources
  where technical_proposal_id = v_proposal_id
    and not (id = any(v_seen_resource_ids));

  delete from public.technical_proposal_items
  where technical_proposal_id = v_proposal_id
    and not (id = any(v_seen_item_ids));

  for v_file in select value from jsonb_array_elements(p_files)
  loop
    if jsonb_typeof(v_file) <> 'object' then raise exception 'Cada file de p_files debe ser un objeto JSON.'; end if;
    if trim(coalesce(v_file ->> 'file_type', '')) = '' then raise exception 'Cada file debe incluir file_type.'; end if;

    v_resource_item_key := trim(coalesce(v_file ->> 'client_item_key', v_file ->> 'technical_proposal_item_id', ''));
    v_resource_item_id := null;
    if v_resource_item_key <> '' then
      v_resource_item_id := nullif(v_item_map ->> v_resource_item_key, '')::uuid;
      if v_resource_item_id is null then raise exception 'File referencia item % que no existe en p_items.', v_resource_item_key; end if;
    end if;

    insert into public.technical_proposal_files (
      technical_proposal_id, technical_proposal_item_id, resource_snapshot_id,
      file_type, title, relation_label, storage_path, public_url, mime_type,
      file_size, metadata, created_by
    ) values (
      v_proposal_id,
      v_resource_item_id,
      null,
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

  if v_linked_budget_id is not null then
    perform public.reconcile_budget_from_technical_proposal(v_proposal_id);
  end if;

  insert into public.technical_proposal_events (
    technical_proposal_id, event_type, event_message, actor_id, actor_email, metadata
  ) values (
    v_proposal_id,
    'full_saved',
    coalesce(p_event_message, 'Propuesta Tecnica guardada por upsert y reconciliacion estable.'),
    v_actor_id,
    v_actor_email,
    jsonb_build_object(
      'items_count', v_items_count,
      'resources_count', v_resources_count,
      'files_count', v_files_count,
      'uses_stable_source_key', true,
      'linked_budget_reconciled', v_linked_budget_id is not null
    )
  );

  return v_proposal_id;
end;
$$;

revoke all on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) from public;
revoke all on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) from anon;
revoke all on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) from service_role;
grant execute on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Creacion idempotente: crea una vez y luego reconcilia
-- -----------------------------------------------------------------------------

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
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_pt public.technical_proposals%rowtype;
  v_cot public.cotizaciones%rowtype;
  v_budget public.cotizacion_presupuestos%rowtype;
  v_next_revision integer;
begin
  if v_actor_id is null then raise exception 'Usuario no autenticado para crear presupuesto desde PT.'; end if;
  if p_propuesta_tecnica_id is null then raise exception 'p_propuesta_tecnica_id es obligatorio.'; end if;
  if not public.can_use_module('cotizaciones', 'edit') then raise exception 'No tienes permiso para crear presupuestos de cotizacion.'; end if;
  if not public.can_use_module('technical_proposals', 'view') then raise exception 'No tienes permiso para leer Propuestas Tecnicas.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('pt_budget_reconcile:' || p_propuesta_tecnica_id::text, 0));

  select * into v_pt
  from public.technical_proposals tp
  where tp.id = p_propuesta_tecnica_id
  for update;

  if v_pt.id is null then raise exception 'No existe la Propuesta Tecnica indicada.'; end if;
  if v_pt.cotizacion_id is null then raise exception 'La Propuesta Tecnica no esta vinculada a una cotizacion real.'; end if;
  if coalesce(v_pt.work_status, '') <> 'Completado' then raise exception 'Solo una Propuesta Tecnica completada puede importarse a presupuesto.'; end if;

  select * into v_cot
  from public.cotizaciones c
  where c.id = v_pt.cotizacion_id
    and c.deleted_at is null
  for update;

  if v_cot.id is null then raise exception 'No existe la cotizacion asociada a la Propuesta Tecnica.'; end if;
  if exists (
    select 1 from public.technical_proposal_resources tpr
    where tpr.technical_proposal_id = v_pt.id and tpr.resource_id is null
  ) then
    raise exception 'La PT contiene recursos sin recurso_id del catalogo maestro.';
  end if;

  select * into v_budget
  from public.cotizacion_presupuestos cp
  where cp.propuesta_tecnica_id = v_pt.id
  for update;

  if v_budget.id is null then
    select coalesce(max(cp.revision), 0) + 1 into v_next_revision
    from public.cotizacion_presupuestos cp
    where cp.cotizacion_id = v_cot.id;

    insert into public.cotizacion_presupuestos (
      cotizacion_id, revision, estado, moneda_codigo, creado_por_user_id, propuesta_tecnica_id
    ) values (
      v_cot.id,
      v_next_revision,
      'BORRADOR',
      case when coalesce(v_cot.moneda_codigo, 'PEN') = 'USD' then 'USD' else 'PEN' end,
      v_actor_id,
      v_pt.id
    ) returning * into v_budget;
  elsif v_budget.estado <> 'BORRADOR' then
    raise exception 'El presupuesto vinculado ya existe y no esta en BORRADOR: %.', v_budget.estado;
  end if;

  perform public.reconcile_budget_from_technical_proposal(v_pt.id);

  select * into v_budget
  from public.cotizacion_presupuestos cp
  where cp.id = v_budget.id;

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

comment on column public.technical_proposal_items.source_key is
  'Identidad estable del nodo PT. No cambia por renombrado, reordenamiento ni movimiento.';

comment on column public.technical_proposal_resources.source_key is
  'Identidad estable de la instancia de recurso PT; no equivale a resource_id y soporta repeticiones del mismo maestro.';

comment on column public.cotizacion_presupuesto_partidas.pt_structure_key is
  'Clave estable del nodo economico generado desde PT: item:<source_key> o resource-group:<source_key>:<categoria>.';

comment on column public.cotizacion_presupuesto_recursos.pt_resource_source_key is
  'Clave estable de la instancia de recurso PT que originó la fila economica.';

comment on column public.cotizacion_presupuesto_partidas.sync_status is
  'Estado de reconciliacion PT: SYNCED, REQUIRES_REVIEW o REMOVED_FROM_PT. NULL identifica filas manuales no gestionadas por PT.';

comment on column public.cotizacion_presupuesto_recursos.sync_status is
  'Estado de reconciliacion PT: SYNCED, REQUIRES_REVIEW o REMOVED_FROM_PT. NULL identifica filas manuales no gestionadas por PT.';

comment on function public.reconcile_budget_from_technical_proposal(uuid) is
  'Reconcilia idempotentemente una PT completada con su presupuesto BORRADOR, preservando economia manual y marcando bajas conflictivas.';

comment on function public.save_full_technical_proposal(jsonb, jsonb, jsonb, jsonb, text) is
  'Guarda PT por upsert con source_key estable, conserva IDs, elimina ausencias y reconcilia el presupuesto BORRADOR vinculado.';

comment on function public.crear_presupuesto_desde_propuesta_tecnica(uuid) is
  'Crea idempotentemente el presupuesto BORRADOR de una PT completada o reconcilia el ya vinculado.';

commit;
