-- AG-2C.2E.P1 - Historico de precios y revision de precios de presupuesto.
-- Migracion local. No implementa RQ, REAL, compras, linea base ni actualizacion automatica del precio maestro.

begin;

create or replace function public.can_view_module_prices(p_module text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and lower(amp.module_key) = lower(p_module)
    where up.id = (select auth.uid())
      and up.status = 'approved'
      and (
        up.is_super_admin is true
        or up.role in ('admin', 'gerencia')
        or amp.can_view_prices is true
      )
  );
$$;

create table if not exists public.recurso_precios_historicos (
  id uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references public.recursos(id) on delete restrict,
  precio_unitario numeric(14,4) not null,
  moneda_codigo text not null default 'PEN',
  fecha_precio date not null default current_date,
  proveedor_id text null references public.catalog_proveedores(id) on delete set null,
  proveedor_snapshot text null,
  fuente_tipo text not null default 'MANUAL',
  fuente_referencia text null,
  documento_soporte_url text null,
  cotizacion_id uuid null references public.cotizaciones(id) on delete set null,
  presupuesto_id uuid null references public.cotizacion_presupuestos(id) on delete set null,
  observaciones text null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint recurso_precios_historicos_precio_check
    check (precio_unitario >= 0),
  constraint recurso_precios_historicos_moneda_check
    check (moneda_codigo in ('PEN', 'USD')),
  constraint recurso_precios_historicos_fuente_tipo_check
    check (fuente_tipo in ('COTIZACION_PROVEEDOR', 'WEB', 'OC_HISTORICA', 'COMPRA_HISTORICA', 'MANUAL', 'OTRO'))
);

create index if not exists recurso_precios_historicos_recurso_fecha_idx
  on public.recurso_precios_historicos (recurso_id, fecha_precio desc, created_at desc);

create index if not exists recurso_precios_historicos_cotizacion_idx
  on public.recurso_precios_historicos (cotizacion_id)
  where cotizacion_id is not null;

create index if not exists recurso_precios_historicos_presupuesto_idx
  on public.recurso_precios_historicos (presupuesto_id)
  where presupuesto_id is not null;

alter table public.cotizacion_presupuesto_recursos
  add column if not exists precio_base_origen text not null default 'MANUAL',
  add column if not exists precio_historico_id uuid null,
  add column if not exists precio_revisado boolean not null default false,
  add column if not exists precio_revisado_at timestamptz null,
  add column if not exists precio_revisado_por uuid null,
  add column if not exists precio_revisado_nota text null;

alter table public.cotizacion_presupuesto_recursos
  drop constraint if exists cotizacion_presupuesto_recursos_precio_base_origen_check;

alter table public.cotizacion_presupuesto_recursos
  add constraint cotizacion_presupuesto_recursos_precio_base_origen_check
  check (precio_base_origen in ('MAESTRO', 'HISTORICO', 'NUEVO_PRECIO', 'MANUAL'));

alter table public.cotizacion_presupuesto_recursos
  drop constraint if exists cotizacion_presupuesto_recursos_precio_historico_fkey;

alter table public.cotizacion_presupuesto_recursos
  add constraint cotizacion_presupuesto_recursos_precio_historico_fkey
  foreign key (precio_historico_id)
  references public.recurso_precios_historicos(id)
  on delete restrict;

alter table public.cotizacion_presupuesto_recursos
  drop constraint if exists cotizacion_presupuesto_recursos_precio_revisado_por_fkey;

alter table public.cotizacion_presupuesto_recursos
  add constraint cotizacion_presupuesto_recursos_precio_revisado_por_fkey
  foreign key (precio_revisado_por)
  references public.user_profiles(id)
  on delete set null;

create index if not exists cotizacion_presupuesto_recursos_precio_historico_idx
  on public.cotizacion_presupuesto_recursos (precio_historico_id)
  where precio_historico_id is not null;

alter table public.recurso_precios_historicos enable row level security;

revoke all on public.recurso_precios_historicos from public;
revoke all on public.recurso_precios_historicos from anon;
revoke all on public.recurso_precios_historicos from authenticated;
grant select on public.recurso_precios_historicos to authenticated;

drop policy if exists recurso_precios_historicos_select_by_price_permission
  on public.recurso_precios_historicos;
create policy recurso_precios_historicos_select_by_price_permission
on public.recurso_precios_historicos
for select to authenticated
using (
  public.can_use_module('cotizaciones', 'view')
  and public.can_view_module_prices('cotizaciones')
);

drop policy if exists recurso_precios_historicos_insert_by_quotation_price_permission
  on public.recurso_precios_historicos;

create or replace function public.inicializar_precio_recurso_presupuesto()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_master record;
begin
  if new.recurso_id is null then
    return new;
  end if;

  if coalesce(new.precio_base_unitario, 0) = 0
    and coalesce(new.precio_ofertado_unitario, 0) = 0
  then
    select
      r.precio_unitario_ref,
      r.moneda_codigo,
      r.proveedor_nombre
    into v_master
    from public.recursos r
    where r.id = new.recurso_id
      and r.deleted_at is null;

    if v_master.precio_unitario_ref is not null and v_master.precio_unitario_ref >= 0 then
      new.precio_base_unitario := v_master.precio_unitario_ref;
      new.precio_ofertado_unitario := v_master.precio_unitario_ref;
      new.precio_base_origen := 'MAESTRO';
      new.precio_historico_id := null;
      new.precio_revisado := false;
      new.precio_unitario_ref_snapshot := v_master.precio_unitario_ref;
      new.moneda_codigo_snapshot := case when coalesce(v_master.moneda_codigo, 'PEN') = 'USD' then 'USD' else 'PEN' end;
      new.proveedor_snapshot := coalesce(new.proveedor_snapshot, v_master.proveedor_nombre);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inicializar_precio_recurso_presupuesto
  on public.cotizacion_presupuesto_recursos;
create trigger inicializar_precio_recurso_presupuesto
before insert on public.cotizacion_presupuesto_recursos
for each row
execute function public.inicializar_precio_recurso_presupuesto();

create or replace function public.aplicar_revision_precio_recurso_presupuesto(
  p_presupuesto_id uuid,
  p_recurso_id uuid,
  p_accion text,
  p_precio_historico_id uuid default null,
  p_precio_unitario numeric default null,
  p_moneda_codigo text default null,
  p_fecha_precio date default null,
  p_proveedor_id text default null,
  p_proveedor_snapshot text default null,
  p_fuente_tipo text default null,
  p_fuente_referencia text default null,
  p_documento_soporte_url text default null,
  p_observaciones text default null,
  p_manual_offer_override_resource_ids uuid[] default '{}'::uuid[]
)
returns table (
  precio_historico_id uuid,
  filas_actualizadas integer,
  precio_base_unitario numeric,
  precio_base_origen text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_action text := upper(trim(coalesce(p_accion, '')));
  v_budget record;
  v_price numeric;
  v_currency text;
  v_origin text;
  v_history_id uuid;
  v_rows integer := 0;
  v_provider_snapshot text;
  v_master record;
  v_manual_ids uuid[] := coalesce(p_manual_offer_override_resource_ids, '{}'::uuid[]);
begin
  if v_actor_id is null then
    raise exception 'Usuario no autenticado para revisar precios.';
  end if;

  if p_presupuesto_id is null or p_recurso_id is null then
    raise exception 'p_presupuesto_id y p_recurso_id son obligatorios.';
  end if;

  if not public.can_use_module('cotizaciones', 'edit') then
    raise exception 'No tienes permiso para editar cotizaciones.';
  end if;

  if not public.can_view_module_prices('cotizaciones') then
    raise exception 'No tienes permiso economico para revisar precios.';
  end if;

  select cp.id, cp.cotizacion_id, cp.estado, cp.moneda_codigo
  into v_budget
  from public.cotizacion_presupuestos cp
  where cp.id = p_presupuesto_id
  for update;

  if v_budget.id is null then
    raise exception 'No existe el presupuesto indicado.';
  end if;

  if v_budget.estado <> 'BORRADOR' then
    raise exception 'La revision de precios solo esta permitida en presupuestos BORRADOR.';
  end if;

  if not exists (
    select 1
    from public.cotizacion_presupuesto_recursos cpr
    join public.cotizacion_presupuesto_partidas cpp on cpp.id = cpr.partida_id
    where cpp.presupuesto_id = p_presupuesto_id
      and cpr.recurso_id = p_recurso_id
  ) then
    raise exception 'El recurso no pertenece al presupuesto indicado.';
  end if;

  if exists (
    select 1
    from unnest(v_manual_ids) as manual_id
    where not exists (
      select 1
      from public.cotizacion_presupuesto_recursos cpr
      join public.cotizacion_presupuesto_partidas cpp on cpp.id = cpr.partida_id
      where cpp.presupuesto_id = p_presupuesto_id
        and cpr.recurso_id = p_recurso_id
        and cpr.id = manual_id
    )
  ) then
    raise exception 'Los overrides manuales enviados no pertenecen al recurso/presupuesto indicado.';
  end if;

  if v_action = 'MANTENER' then
    update public.cotizacion_presupuesto_recursos cpr
    set
      precio_revisado = true,
      precio_revisado_at = now(),
      precio_revisado_por = v_actor_id,
      precio_revisado_nota = coalesce(nullif(p_observaciones, ''), precio_revisado_nota)
    from public.cotizacion_presupuesto_partidas cpp
    where cpp.id = cpr.partida_id
      and cpp.presupuesto_id = p_presupuesto_id
      and cpr.recurso_id = p_recurso_id;

    get diagnostics v_rows = row_count;

    return query
    select null::uuid, v_rows, null::numeric, 'MANUAL'::text;
    return;
  end if;

  if v_action = 'MAESTRO' then
    select r.precio_unitario_ref, r.moneda_codigo, r.proveedor_nombre
    into v_master
    from public.recursos r
    where r.id = p_recurso_id
      and r.deleted_at is null;

    if v_master.precio_unitario_ref is null or v_master.precio_unitario_ref < 0 then
      raise exception 'El recurso maestro no tiene precio referencial valido.';
    end if;

    v_price := v_master.precio_unitario_ref;
    v_currency := case when coalesce(v_master.moneda_codigo, v_budget.moneda_codigo) = 'USD' then 'USD' else 'PEN' end;
    v_origin := 'MAESTRO';
    v_history_id := null;
    v_provider_snapshot := v_master.proveedor_nombre;
  elsif v_action = 'HISTORICO' then
    select rph.id, rph.precio_unitario, rph.moneda_codigo, rph.proveedor_snapshot
    into v_history_id, v_price, v_currency, v_provider_snapshot
    from public.recurso_precios_historicos rph
    where rph.id = p_precio_historico_id
      and rph.recurso_id = p_recurso_id;

    if v_history_id is null then
      raise exception 'El historico indicado no pertenece al recurso.';
    end if;

    v_origin := 'HISTORICO';
  elsif v_action = 'NUEVO_PRECIO' then
    if p_precio_unitario is null or p_precio_unitario < 0 then
      raise exception 'p_precio_unitario debe ser mayor o igual que cero.';
    end if;

    v_currency := case when coalesce(p_moneda_codigo, v_budget.moneda_codigo, 'PEN') = 'USD' then 'USD' else 'PEN' end;
    v_price := p_precio_unitario;
    v_origin := 'NUEVO_PRECIO';
    v_provider_snapshot := nullif(p_proveedor_snapshot, '');

    insert into public.recurso_precios_historicos (
      recurso_id,
      precio_unitario,
      moneda_codigo,
      fecha_precio,
      proveedor_id,
      proveedor_snapshot,
      fuente_tipo,
      fuente_referencia,
      documento_soporte_url,
      cotizacion_id,
      presupuesto_id,
      observaciones,
      created_by
    ) values (
      p_recurso_id,
      v_price,
      v_currency,
      coalesce(p_fecha_precio, current_date),
      nullif(p_proveedor_id, ''),
      v_provider_snapshot,
      coalesce(nullif(upper(trim(p_fuente_tipo)), ''), 'MANUAL'),
      nullif(p_fuente_referencia, ''),
      nullif(p_documento_soporte_url, ''),
      v_budget.cotizacion_id,
      p_presupuesto_id,
      nullif(p_observaciones, ''),
      v_actor_id
    )
    returning id into v_history_id;
  else
    raise exception 'Accion de revision de precios no soportada: %.', v_action;
  end if;

  update public.cotizacion_presupuesto_recursos cpr
  set
    precio_base_unitario = v_price,
    precio_ofertado_unitario = case
      when cpr.id = any(v_manual_ids) then cpr.precio_ofertado_unitario
      when cpr.precio_base_unitario > 0 then round(v_price * cpr.precio_ofertado_unitario / cpr.precio_base_unitario, 4)
      else v_price
    end,
    precio_base_origen = v_origin,
    precio_historico_id = v_history_id,
    precio_revisado = true,
    precio_revisado_at = now(),
    precio_revisado_por = v_actor_id,
    precio_revisado_nota = nullif(p_observaciones, ''),
    precio_unitario_ref_snapshot = case when v_origin = 'MAESTRO' then v_price else cpr.precio_unitario_ref_snapshot end,
    moneda_codigo_snapshot = coalesce(v_currency, cpr.moneda_codigo_snapshot),
    proveedor_snapshot = coalesce(v_provider_snapshot, cpr.proveedor_snapshot)
  from public.cotizacion_presupuesto_partidas cpp
  where cpp.id = cpr.partida_id
    and cpp.presupuesto_id = p_presupuesto_id
    and cpr.recurso_id = p_recurso_id;

  get diagnostics v_rows = row_count;

  return query
  select v_history_id, v_rows, v_price, v_origin;
end;
$$;

revoke all on function public.can_view_module_prices(text) from public;
revoke all on function public.can_view_module_prices(text) from anon;
grant execute on function public.can_view_module_prices(text) to authenticated;

revoke all on function public.inicializar_precio_recurso_presupuesto() from public;
revoke all on function public.inicializar_precio_recurso_presupuesto() from anon;
revoke all on function public.inicializar_precio_recurso_presupuesto() from authenticated;
revoke all on function public.inicializar_precio_recurso_presupuesto() from service_role;

revoke all on function public.aplicar_revision_precio_recurso_presupuesto(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[]
) from public;
revoke all on function public.aplicar_revision_precio_recurso_presupuesto(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[]
) from anon;
revoke all on function public.aplicar_revision_precio_recurso_presupuesto(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[]
) from service_role;
grant execute on function public.aplicar_revision_precio_recurso_presupuesto(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[]
) to authenticated;

comment on table public.recurso_precios_historicos is
  'Historico inmutable de precios unitarios observados para recursos maestros. No actualiza automaticamente recursos.precio_unitario_ref.';

comment on column public.cotizacion_presupuesto_recursos.precio_base_origen is
  'Origen del precio_base_unitario vigente en esta revision presupuestal: MAESTRO, HISTORICO, NUEVO_PRECIO o MANUAL.';

comment on column public.cotizacion_presupuesto_recursos.precio_historico_id is
  'Historico usado para snapshotear el precio base. El precio_base_unitario sigue siendo la fuente contractual del presupuesto.';

comment on function public.aplicar_revision_precio_recurso_presupuesto(uuid, uuid, text, uuid, numeric, text, date, text, text, text, text, text, text, uuid[]) is
  'Aplica revision de precio por recurso_id solo dentro de un presupuesto BORRADOR. Puede mantener, usar maestro, usar historico o registrar nuevo historico.';

commit;
