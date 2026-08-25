-- AG-2C.2A - Esquema relacional de presupuesto detallado de cotizaciones.
-- No modifica cotizaciones.metadata.resumen_economico, RQ, adjudicacion ni linea base.

begin;

create or replace function public.set_cotizacion_presupuesto_actualizado_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_at = now();
  return new;
end;
$$;

create table if not exists public.cotizacion_presupuestos (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete restrict,
  revision integer not null default 1,
  estado text not null default 'BORRADOR',
  moneda_codigo text not null default 'PEN',
  creado_por_user_id uuid not null default auth.uid() references public.user_profiles(id) on delete restrict,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  constraint cotizacion_presupuestos_revision_check
    check (revision > 0),
  constraint cotizacion_presupuestos_estado_check
    check (estado in ('BORRADOR', 'LISTO_PARA_ADJUDICAR', 'ADJUDICADO')),
  constraint cotizacion_presupuestos_moneda_check
    check (moneda_codigo in ('PEN', 'USD')),
  constraint cotizacion_presupuestos_cotizacion_revision_unique
    unique (cotizacion_id, revision)
);

create table if not exists public.cotizacion_presupuesto_partidas (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references public.cotizacion_presupuestos(id) on delete restrict,
  parent_id uuid references public.cotizacion_presupuesto_partidas(id) on delete restrict,
  codigo text,
  tipo text not null,
  descripcion text not null,
  unidad text,
  cantidad numeric,
  orden integer not null default 0,
  observaciones text,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  constraint cotizacion_presupuesto_partidas_tipo_check
    check (tipo in ('CAPITULO', 'SUBCAPITULO', 'PARTIDA')),
  constraint cotizacion_presupuesto_partidas_descripcion_not_blank
    check (length(trim(descripcion)) > 0),
  constraint cotizacion_presupuesto_partidas_cantidad_check
    check (cantidad is null or cantidad > 0),
  constraint cotizacion_presupuesto_partidas_parent_not_self
    check (parent_id is null or parent_id <> id)
);

create table if not exists public.cotizacion_presupuesto_recursos (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.cotizacion_presupuesto_partidas(id) on delete restrict,
  recurso_id uuid not null references public.recursos(id) on delete restrict,
  cantidad_presupuestada numeric not null,
  precio_base_unitario numeric not null,
  precio_ofertado_unitario numeric not null,
  orden integer not null default 0,
  observaciones text,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  constraint cotizacion_presupuesto_recursos_cantidad_check
    check (cantidad_presupuestada > 0),
  constraint cotizacion_presupuesto_recursos_precio_base_check
    check (precio_base_unitario >= 0),
  constraint cotizacion_presupuesto_recursos_precio_ofertado_check
    check (precio_ofertado_unitario >= 0)
);

create or replace function public.assert_cotizacion_presupuesto_mutable(p_presupuesto_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
begin
  select cp.estado
  into v_estado
  from public.cotizacion_presupuestos cp
  where cp.id = p_presupuesto_id;

  if v_estado = 'ADJUDICADO' then
    raise exception 'No se puede modificar un presupuesto adjudicado.';
  end if;
end;
$$;

create or replace function public.cotizacion_presupuesto_estructura_valida(p_presupuesto_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_presupuesto_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.cotizacion_presupuesto_partidas p
    where p.presupuesto_id = p_presupuesto_id
      and p.tipo = 'PARTIDA'
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.cotizacion_presupuesto_recursos r
    join public.cotizacion_presupuesto_partidas p on p.id = r.partida_id
    where p.presupuesto_id = p_presupuesto_id
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.cotizacion_presupuesto_partidas child
    left join public.cotizacion_presupuesto_partidas parent on parent.id = child.parent_id
    where child.presupuesto_id = p_presupuesto_id
      and (
        (child.tipo = 'CAPITULO' and child.parent_id is not null)
        or (child.tipo = 'SUBCAPITULO' and (
          child.parent_id is null
          or parent.id is null
          or parent.presupuesto_id is distinct from child.presupuesto_id
          or parent.tipo <> 'CAPITULO'
        ))
        or (child.tipo = 'PARTIDA' and (
          child.parent_id is null
          or parent.id is null
          or parent.presupuesto_id is distinct from child.presupuesto_id
          or parent.tipo not in ('CAPITULO', 'SUBCAPITULO')
        ))
      )
  ) then
    return false;
  end if;

  if exists (
    with recursive chain(root_id, id, parent_id, path, cycle, depth) as (
      select p.id, p.id, p.parent_id, array[p.id], false, 1
      from public.cotizacion_presupuesto_partidas p
      where p.presupuesto_id = p_presupuesto_id

      union all

      select chain.root_id, parent.id, parent.parent_id, chain.path || parent.id, parent.id = any(chain.path), chain.depth + 1
      from chain
      join public.cotizacion_presupuesto_partidas parent on parent.id = chain.parent_id
      where not chain.cycle
        and chain.depth < 20
    )
    select 1
    from chain
    where cycle
       or depth >= 20
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.cotizacion_presupuesto_partidas p
    where p.presupuesto_id = p_presupuesto_id
      and p.tipo = 'PARTIDA'
      and not exists (
        select 1
        from public.cotizacion_presupuesto_recursos r
        where r.partida_id = p.id
      )
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.cotizacion_presupuesto_recursos r
    join public.cotizacion_presupuesto_partidas p on p.id = r.partida_id
    where p.presupuesto_id = p_presupuesto_id
      and (
        p.tipo <> 'PARTIDA'
        or r.recurso_id is null
        or r.cantidad_presupuestada <= 0
        or r.precio_base_unitario < 0
        or r.precio_ofertado_unitario < 0
      )
  ) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.validate_cotizacion_presupuesto_estado()
returns trigger
language plpgsql
security definer
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

  if new.tipo in ('SUBCAPITULO', 'PARTIDA') and new.parent_id is null then
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

  if new.tipo <> 'PARTIDA' and exists (
    select 1
    from public.cotizacion_presupuesto_recursos r
    where r.partida_id = new.id
  ) then
    raise exception 'Solo una PARTIDA puede tener recursos presupuestados.';
  end if;

  if new.tipo = 'PARTIDA' and exists (
    select 1
    from public.cotizacion_presupuesto_partidas child
    where child.parent_id = new.id
  ) then
    raise exception 'Una PARTIDA no puede tener partidas hijas.';
  end if;

  if new.tipo = 'SUBCAPITULO' and exists (
    select 1
    from public.cotizacion_presupuesto_partidas child
    where child.parent_id = new.id
      and child.tipo <> 'PARTIDA'
  ) then
    raise exception 'Un SUBCAPITULO solo puede contener PARTIDAS.';
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

  if v_partida_tipo is distinct from 'PARTIDA' then
    raise exception 'Los recursos presupuestados solo pueden asociarse a PARTIDAS.';
  end if;

  perform public.assert_cotizacion_presupuesto_mutable(v_presupuesto_id);
  return new;
end;
$$;

drop trigger if exists set_cotizacion_presupuestos_actualizado_at
  on public.cotizacion_presupuestos;
create trigger set_cotizacion_presupuestos_actualizado_at
before update on public.cotizacion_presupuestos
for each row execute function public.set_cotizacion_presupuesto_actualizado_at();

drop trigger if exists validate_cotizacion_presupuesto_estado
  on public.cotizacion_presupuestos;
create trigger validate_cotizacion_presupuesto_estado
before insert or update or delete on public.cotizacion_presupuestos
for each row execute function public.validate_cotizacion_presupuesto_estado();

drop trigger if exists set_cotizacion_presupuesto_partidas_actualizado_at
  on public.cotizacion_presupuesto_partidas;
create trigger set_cotizacion_presupuesto_partidas_actualizado_at
before update on public.cotizacion_presupuesto_partidas
for each row execute function public.set_cotizacion_presupuesto_actualizado_at();

drop trigger if exists validate_cotizacion_presupuesto_partida
  on public.cotizacion_presupuesto_partidas;
create trigger validate_cotizacion_presupuesto_partida
before insert or update or delete on public.cotizacion_presupuesto_partidas
for each row execute function public.validate_cotizacion_presupuesto_partida();

drop trigger if exists set_cotizacion_presupuesto_recursos_actualizado_at
  on public.cotizacion_presupuesto_recursos;
create trigger set_cotizacion_presupuesto_recursos_actualizado_at
before update on public.cotizacion_presupuesto_recursos
for each row execute function public.set_cotizacion_presupuesto_actualizado_at();

drop trigger if exists validate_cotizacion_presupuesto_recurso
  on public.cotizacion_presupuesto_recursos;
create trigger validate_cotizacion_presupuesto_recurso
before insert or update or delete on public.cotizacion_presupuesto_recursos
for each row execute function public.validate_cotizacion_presupuesto_recurso();

create unique index if not exists cotizacion_presupuestos_unico_adjudicado_idx
  on public.cotizacion_presupuestos (cotizacion_id)
  where estado = 'ADJUDICADO';

create index if not exists cotizacion_presupuesto_partidas_presupuesto_idx
  on public.cotizacion_presupuesto_partidas (presupuesto_id);

create index if not exists cotizacion_presupuesto_partidas_parent_idx
  on public.cotizacion_presupuesto_partidas (parent_id);

create index if not exists cotizacion_presupuesto_recursos_partida_idx
  on public.cotizacion_presupuesto_recursos (partida_id);

create index if not exists cotizacion_presupuesto_recursos_recurso_idx
  on public.cotizacion_presupuesto_recursos (recurso_id);

alter table public.cotizacion_presupuestos enable row level security;
alter table public.cotizacion_presupuesto_partidas enable row level security;
alter table public.cotizacion_presupuesto_recursos enable row level security;

grant select, insert, update, delete on public.cotizacion_presupuestos to authenticated;
grant select, insert, update, delete on public.cotizacion_presupuesto_partidas to authenticated;
grant select, insert, update, delete on public.cotizacion_presupuesto_recursos to authenticated;

drop policy if exists cotizacion_presupuestos_select_by_cotizaciones_permission
  on public.cotizacion_presupuestos;
create policy cotizacion_presupuestos_select_by_cotizaciones_permission
on public.cotizacion_presupuestos
for select to authenticated
using (public.can_use_module('cotizaciones', 'view'));

drop policy if exists cotizacion_presupuestos_insert_by_cotizaciones_permission
  on public.cotizacion_presupuestos;
create policy cotizacion_presupuestos_insert_by_cotizaciones_permission
on public.cotizacion_presupuestos
for insert to authenticated
with check (
  public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('cotizaciones', 'create')
);

drop policy if exists cotizacion_presupuestos_update_by_cotizaciones_permission
  on public.cotizacion_presupuestos;
create policy cotizacion_presupuestos_update_by_cotizaciones_permission
on public.cotizacion_presupuestos
for update to authenticated
using (public.can_use_module('cotizaciones', 'edit'))
with check (public.can_use_module('cotizaciones', 'edit'));

drop policy if exists cotizacion_presupuestos_delete_by_cotizaciones_permission
  on public.cotizacion_presupuestos;
create policy cotizacion_presupuestos_delete_by_cotizaciones_permission
on public.cotizacion_presupuestos
for delete to authenticated
using (public.can_use_module('cotizaciones', 'edit'));

drop policy if exists cotizacion_presupuesto_partidas_select_by_cotizaciones_permission
  on public.cotizacion_presupuesto_partidas;
create policy cotizacion_presupuesto_partidas_select_by_cotizaciones_permission
on public.cotizacion_presupuesto_partidas
for select to authenticated
using (public.can_use_module('cotizaciones', 'view'));

drop policy if exists cotizacion_presupuesto_partidas_insert_by_cotizaciones_permission
  on public.cotizacion_presupuesto_partidas;
create policy cotizacion_presupuesto_partidas_insert_by_cotizaciones_permission
on public.cotizacion_presupuesto_partidas
for insert to authenticated
with check (
  public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('cotizaciones', 'create')
);

drop policy if exists cotizacion_presupuesto_partidas_update_by_cotizaciones_permission
  on public.cotizacion_presupuesto_partidas;
create policy cotizacion_presupuesto_partidas_update_by_cotizaciones_permission
on public.cotizacion_presupuesto_partidas
for update to authenticated
using (public.can_use_module('cotizaciones', 'edit'))
with check (public.can_use_module('cotizaciones', 'edit'));

drop policy if exists cotizacion_presupuesto_partidas_delete_by_cotizaciones_permission
  on public.cotizacion_presupuesto_partidas;
create policy cotizacion_presupuesto_partidas_delete_by_cotizaciones_permission
on public.cotizacion_presupuesto_partidas
for delete to authenticated
using (public.can_use_module('cotizaciones', 'edit'));

drop policy if exists cotizacion_presupuesto_recursos_select_by_cotizaciones_permission
  on public.cotizacion_presupuesto_recursos;
create policy cotizacion_presupuesto_recursos_select_by_cotizaciones_permission
on public.cotizacion_presupuesto_recursos
for select to authenticated
using (public.can_use_module('cotizaciones', 'view'));

drop policy if exists cotizacion_presupuesto_recursos_insert_by_cotizaciones_permission
  on public.cotizacion_presupuesto_recursos;
create policy cotizacion_presupuesto_recursos_insert_by_cotizaciones_permission
on public.cotizacion_presupuesto_recursos
for insert to authenticated
with check (
  public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('cotizaciones', 'create')
);

drop policy if exists cotizacion_presupuesto_recursos_update_by_cotizaciones_permission
  on public.cotizacion_presupuesto_recursos;
create policy cotizacion_presupuesto_recursos_update_by_cotizaciones_permission
on public.cotizacion_presupuesto_recursos
for update to authenticated
using (public.can_use_module('cotizaciones', 'edit'))
with check (public.can_use_module('cotizaciones', 'edit'));

drop policy if exists cotizacion_presupuesto_recursos_delete_by_cotizaciones_permission
  on public.cotizacion_presupuesto_recursos;
create policy cotizacion_presupuesto_recursos_delete_by_cotizaciones_permission
on public.cotizacion_presupuesto_recursos
for delete to authenticated
using (public.can_use_module('cotizaciones', 'edit'));

revoke all on function public.set_cotizacion_presupuesto_actualizado_at() from public;
revoke all on function public.set_cotizacion_presupuesto_actualizado_at() from anon;
revoke all on function public.set_cotizacion_presupuesto_actualizado_at() from authenticated;
revoke all on function public.assert_cotizacion_presupuesto_mutable(uuid) from public;
revoke all on function public.assert_cotizacion_presupuesto_mutable(uuid) from anon;
revoke all on function public.assert_cotizacion_presupuesto_mutable(uuid) from authenticated;
revoke all on function public.cotizacion_presupuesto_estructura_valida(uuid) from public;
revoke all on function public.cotizacion_presupuesto_estructura_valida(uuid) from anon;
revoke all on function public.cotizacion_presupuesto_estructura_valida(uuid) from authenticated;
revoke all on function public.validate_cotizacion_presupuesto_estado() from public;
revoke all on function public.validate_cotizacion_presupuesto_estado() from anon;
revoke all on function public.validate_cotizacion_presupuesto_estado() from authenticated;
revoke all on function public.validate_cotizacion_presupuesto_partida() from public;
revoke all on function public.validate_cotizacion_presupuesto_partida() from anon;
revoke all on function public.validate_cotizacion_presupuesto_partida() from authenticated;
revoke all on function public.validate_cotizacion_presupuesto_recurso() from public;
revoke all on function public.validate_cotizacion_presupuesto_recurso() from anon;
revoke all on function public.validate_cotizacion_presupuesto_recurso() from authenticated;

comment on table public.cotizacion_presupuestos is
  'Cabecera de presupuesto detallado de cotizacion para BASE y OFERTADO. No almacena REAL ni linea base contractual.';

comment on table public.cotizacion_presupuesto_partidas is
  'Jerarquia de presupuesto de cotizacion: CAPITULO, SUBCAPITULO y PARTIDA.';

comment on table public.cotizacion_presupuesto_recursos is
  'Recursos normalizados presupuestados por partida. Guarda cantidades y precios propios del presupuesto, no el precio referencial del catalogo.';

comment on column public.cotizacion_presupuestos.creado_por_user_id is
  'Usuario creador del presupuesto. Se inicializa desde auth.uid() y referencia public.user_profiles(id).';

comment on column public.cotizacion_presupuesto_recursos.precio_base_unitario is
  'Costo interno presupuestado unitario. No se deriva automaticamente de recursos.precio_unitario_ref.';

comment on column public.cotizacion_presupuesto_recursos.precio_ofertado_unitario is
  'Valor comercial ofertado unitario.';

commit;
