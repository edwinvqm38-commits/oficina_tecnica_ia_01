-- 120_resource_files_and_filters.sql
-- Mejora de recursos:
-- - RPC liviana para combos de filtros sin descargar toda public.recursos.
-- - Los archivos reales viven en Google Drive; Supabase solo guarda metadata.

begin;

create or replace function public.get_recursos_filter_options()
returns table (
  tipos text[],
  estados text[],
  monedas text[],
  proveedores text[],
  marcas text[]
)
language sql
stable
security invoker
as $$
  select
    coalesce(array_agg(distinct tipo_recurso_nombre order by tipo_recurso_nombre) filter (where tipo_recurso_nombre is not null and btrim(tipo_recurso_nombre) <> ''), '{}'::text[]) as tipos,
    coalesce(array_agg(distinct estado order by estado) filter (where estado is not null and btrim(estado) <> ''), '{}'::text[]) as estados,
    coalesce(array_agg(distinct moneda_codigo order by moneda_codigo) filter (where moneda_codigo is not null and btrim(moneda_codigo) <> ''), '{}'::text[]) as monedas,
    coalesce(array_agg(distinct proveedor_nombre order by proveedor_nombre) filter (where proveedor_nombre is not null and btrim(proveedor_nombre) <> ''), '{}'::text[]) as proveedores,
    coalesce(array_agg(distinct marca_nombre order by marca_nombre) filter (where marca_nombre is not null and btrim(marca_nombre) <> ''), '{}'::text[]) as marcas
  from public.recursos
  where deleted_at is null;
$$;

grant execute on function public.get_recursos_filter_options() to authenticated;

commit;
