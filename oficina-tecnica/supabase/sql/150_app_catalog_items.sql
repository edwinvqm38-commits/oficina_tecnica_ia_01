-- 150_app_catalog_items.sql
-- Persistencia de Datos y catalogos en Supabase.
--
-- Ejecutar en Supabase SQL Editor para que la pantalla Datos deje de usar
-- memoria temporal del navegador.

begin;

create table if not exists public.app_catalog_items (
  catalog_key text not null,
  item_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  primary key (catalog_key, item_id),
  constraint app_catalog_items_catalog_key_not_blank check (length(trim(catalog_key)) > 0),
  constraint app_catalog_items_item_id_not_blank check (length(trim(item_id)) > 0),
  constraint app_catalog_items_payload_object check (jsonb_typeof(payload) = 'object')
);

create index if not exists app_catalog_items_catalog_key_idx on public.app_catalog_items(catalog_key);
create index if not exists app_catalog_items_payload_activo_idx on public.app_catalog_items((payload ->> 'activo'));

drop trigger if exists set_app_catalog_items_updated_at on public.app_catalog_items;
create trigger set_app_catalog_items_updated_at
before update on public.app_catalog_items
for each row execute function public.set_updated_at();

alter table public.app_catalog_items enable row level security;

grant select, insert, update, delete on public.app_catalog_items to authenticated;

drop policy if exists app_catalog_items_select_datos on public.app_catalog_items;
create policy app_catalog_items_select_datos on public.app_catalog_items
for select to authenticated
using (
  public.can_use_module('datos', 'view')
  or public.can_use_module('cotizaciones', 'view')
  or public.can_use_module('requerimientos', 'view')
  or public.can_use_module('recursos', 'view')
);

drop policy if exists app_catalog_items_insert_datos on public.app_catalog_items;
create policy app_catalog_items_insert_datos on public.app_catalog_items
for insert to authenticated
with check (public.can_use_module('datos', 'create') or public.can_use_module('datos', 'edit'));

drop policy if exists app_catalog_items_update_datos on public.app_catalog_items;
create policy app_catalog_items_update_datos on public.app_catalog_items
for update to authenticated
using (public.can_use_module('datos', 'edit'))
with check (public.can_use_module('datos', 'edit'));

drop policy if exists app_catalog_items_delete_datos on public.app_catalog_items;
create policy app_catalog_items_delete_datos on public.app_catalog_items
for delete to authenticated
using (public.can_use_module('datos', 'edit'));

commit;
