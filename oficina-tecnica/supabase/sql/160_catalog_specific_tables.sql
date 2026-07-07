-- 160_catalog_specific_tables.sql
-- Tablas reales para Datos y catalogos.
--
-- Ejecutar despues de 100_clean_start_schema.sql y 150_app_catalog_items.sql.
-- Migra registros existentes desde app_catalog_items hacia tablas especificas.

begin;

create table if not exists public.catalog_tipos_recurso (
  id text primary key,
  nombre text not null,
  codigo text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  observaciones text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_unidades_medida (
  id text primary key,
  codigo text not null,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_marcas (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  observaciones text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_proveedores (
  id text primary key,
  nombre text not null,
  ruc text not null default '',
  contacto text not null default '',
  telefono text not null default '',
  email text not null default '',
  tiempo_entrega_ref text not null default '',
  activo boolean not null default true,
  observaciones text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_monedas (
  id text primary key,
  codigo text not null unique,
  simbolo text not null,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_estados_recurso (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_estado_detalle_rq (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_vb_economico (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_vb_tecnico (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_vb_atencion (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_logistica_compra (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_tipos_servicio (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_areas (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_solicitantes_rq (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_solicitantes_cotizacion (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_estados_cotizacion (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_codigo_clientes (
  id text primary key,
  cliente text not null,
  codigo_cliente text not null,
  estado text not null default 'Activo',
  observaciones text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_codigo_clientes_codigo_unique unique (codigo_cliente)
);

create table if not exists public.catalog_codigo_unidades_trabajo (
  id text primary key,
  unidad_trabajo text not null,
  codigo_unidad text not null,
  estado text not null default 'Activo',
  observaciones text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_codigo_unidades_trabajo_codigo_unique unique (codigo_unidad)
);

create table if not exists public.proyectos_adjudicados (
  id text primary key,
  anio integer not null,
  codigo_proyecto text not null,
  cotizacion text not null default '',
  oc text not null default '',
  cliente text not null default '',
  codigo_cliente text not null default '',
  unidad_trabajo text not null default '',
  codigo_unidad text not null default '',
  fecha_adjudicacion date,
  estado text not null default 'Activo',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proyectos_adjudicados_codigo_unique unique (anio, codigo_proyecto)
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'catalog_tipos_recurso',
    'catalog_unidades_medida',
    'catalog_marcas',
    'catalog_proveedores',
    'catalog_monedas',
    'catalog_estados_recurso',
    'catalog_estado_detalle_rq',
    'catalog_vb_economico',
    'catalog_vb_tecnico',
    'catalog_vb_atencion',
    'catalog_logistica_compra',
    'catalog_tipos_servicio',
    'catalog_areas',
    'catalog_solicitantes_rq',
    'catalog_solicitantes_cotizacion',
    'catalog_estados_cotizacion',
    'catalog_codigo_clientes',
    'catalog_codigo_unidades_trabajo',
    'proyectos_adjudicados'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t,
      t
    );
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_use_module(''datos'', ''view'') or public.can_use_module(''cotizaciones'', ''view'') or public.can_use_module(''requerimientos'', ''view'') or public.can_use_module(''recursos'', ''view''))',
      t || '_select',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_use_module(''datos'', ''create'') or public.can_use_module(''datos'', ''edit''))',
      t || '_insert',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_use_module(''datos'', ''edit'')) with check (public.can_use_module(''datos'', ''edit''))',
      t || '_update',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.can_use_module(''datos'', ''edit''))',
      t || '_delete',
      t
    );
  end loop;
end $$;

-- Migracion desde la tabla generica previa, si existe.
insert into public.catalog_tipos_recurso (id, nombre, codigo, activo, orden, observaciones)
select item_id, payload->>'nombre', payload->>'codigo', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0), coalesce(payload->>'observaciones', '')
from public.app_catalog_items where catalog_key = 'catalogTipoRecurso'
on conflict (id) do update set nombre = excluded.nombre, codigo = excluded.codigo, activo = excluded.activo, orden = excluded.orden, observaciones = excluded.observaciones;

insert into public.catalog_unidades_medida (id, codigo, nombre, activo, orden)
select item_id, payload->>'codigo', payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogUnidades'
on conflict (id) do update set codigo = excluded.codigo, nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_marcas (id, nombre, activo, observaciones)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce(payload->>'observaciones', '')
from public.app_catalog_items where catalog_key = 'catalogMarcas'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, observaciones = excluded.observaciones;

insert into public.catalog_proveedores (id, nombre, ruc, contacto, telefono, email, tiempo_entrega_ref, activo, observaciones)
select item_id, payload->>'nombre', coalesce(payload->>'ruc', ''), coalesce(payload->>'contacto', ''), coalesce(payload->>'telefono', ''), coalesce(payload->>'email', ''), coalesce(payload->>'tiempo_entrega_ref', ''), coalesce((payload->>'activo')::boolean, true), coalesce(payload->>'observaciones', '')
from public.app_catalog_items where catalog_key = 'catalogProveedores'
on conflict (id) do update set nombre = excluded.nombre, ruc = excluded.ruc, contacto = excluded.contacto, telefono = excluded.telefono, email = excluded.email, tiempo_entrega_ref = excluded.tiempo_entrega_ref, activo = excluded.activo, observaciones = excluded.observaciones;

insert into public.catalog_monedas (id, codigo, simbolo, nombre, activo)
select item_id, payload->>'codigo', payload->>'simbolo', payload->>'nombre', coalesce((payload->>'activo')::boolean, true)
from public.app_catalog_items where catalog_key = 'catalogMonedas'
on conflict (id) do update set codigo = excluded.codigo, simbolo = excluded.simbolo, nombre = excluded.nombre, activo = excluded.activo;

insert into public.catalog_estados_recurso (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogEstadosRecurso'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_estado_detalle_rq (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogEstadoDetalleRq'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_vb_economico (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogEq'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_vb_tecnico (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogLl'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_vb_atencion (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogHb'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_logistica_compra (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogLogisticaCompra'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_tipos_servicio (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogTipoServicio'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_areas (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogArea'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_solicitantes_rq (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogSolicitanteRq'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_solicitantes_cotizacion (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogSolicitanteCotizacion'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_estados_cotizacion (id, nombre, activo, orden)
select item_id, payload->>'nombre', coalesce((payload->>'activo')::boolean, true), coalesce((payload->>'orden')::integer, 0)
from public.app_catalog_items where catalog_key = 'catalogEstadoCotizacion'
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden;

insert into public.catalog_codigo_clientes (id, cliente, codigo_cliente, estado, observaciones, activo)
select item_id, payload->>'cliente', payload->>'codigo_cliente', coalesce(payload->>'estado', 'Activo'), coalesce(payload->>'observaciones', ''), coalesce((payload->>'activo')::boolean, true)
from public.app_catalog_items where catalog_key = 'catalogCodigoClientes'
on conflict (id) do update set cliente = excluded.cliente, codigo_cliente = excluded.codigo_cliente, estado = excluded.estado, observaciones = excluded.observaciones, activo = excluded.activo;

insert into public.catalog_codigo_unidades_trabajo (id, unidad_trabajo, codigo_unidad, estado, observaciones, activo)
select item_id, payload->>'unidad_trabajo', payload->>'codigo_unidad', coalesce(payload->>'estado', 'Activo'), coalesce(payload->>'observaciones', ''), coalesce((payload->>'activo')::boolean, true)
from public.app_catalog_items where catalog_key = 'catalogCodigoUnidadesTrabajo'
on conflict (id) do update set unidad_trabajo = excluded.unidad_trabajo, codigo_unidad = excluded.codigo_unidad, estado = excluded.estado, observaciones = excluded.observaciones, activo = excluded.activo;

insert into public.proyectos_adjudicados (id, anio, codigo_proyecto, cotizacion, oc, cliente, codigo_cliente, unidad_trabajo, codigo_unidad, fecha_adjudicacion, estado, activo)
select item_id, coalesce((payload->>'anio')::integer, extract(year from now())::integer), payload->>'codigo_proyecto', coalesce(payload->>'cotizacion', ''), coalesce(payload->>'oc', ''), coalesce(payload->>'cliente', ''), coalesce(payload->>'codigo_cliente', ''), coalesce(payload->>'unidad_trabajo', ''), coalesce(payload->>'codigo_unidad', ''), nullif(payload->>'fecha_adjudicacion', '')::date, coalesce(payload->>'estado', 'Activo'), coalesce((payload->>'activo')::boolean, true)
from public.app_catalog_items where catalog_key = 'proyectosAdjudicados'
on conflict (id) do update set anio = excluded.anio, codigo_proyecto = excluded.codigo_proyecto, cotizacion = excluded.cotizacion, oc = excluded.oc, cliente = excluded.cliente, codigo_cliente = excluded.codigo_cliente, unidad_trabajo = excluded.unidad_trabajo, codigo_unidad = excluded.codigo_unidad, fecha_adjudicacion = excluded.fecha_adjudicacion, estado = excluded.estado, activo = excluded.activo;

commit;
