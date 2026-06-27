# Supabase clean start plan

Este plan asume una cuenta Supabase nueva y limpia, sin migrar datos historicos
desde la cuenta anterior. La idea es empezar ordenado, con menos consumo de API
y lecturas mas controladas.

## Problema actual

La app ya tiene paginacion visual, pero varias pantallas cargan datos completos
desde Supabase y luego filtran o paginan en el navegador.

Patrones costosos encontrados:

- `listCotizaciones()` descarga todas las cotizaciones por lotes de 1000.
- `listRequerimientos()` descarga todos los requerimientos por lotes de 1000.
- `RecursosContent` llama `listAllRecursos()` y despues filtra/pagina en cliente.
- `loadCoreAppData()` trae cotizaciones + requerimientos completos en cada carga
  fria o refresh manual.
- Los dashboards y chats consultan tablas grandes directamente para resumen.

Esto consume mas REST requests, mas filas transferidas y mas CPU en cliente.

## Estrategia nueva

1. Crear una base limpia con `supabase/sql/100_clean_start_schema.sql`.
2. Crear usuarios de prueba desde Auth y aprobarlos desde `user_profiles`.
3. Cargar catalogos o datos iniciales minimos solo si hacen falta.
4. Cambiar la app a consultas paginadas server-side:
   - `cotizaciones`: `search_cotizaciones_page(...)`
   - `recursos`: `search_recursos_page(...)`
   - `requerimientos`: `search_requerimientos_page(...)`
5. Reservar lecturas completas solo para exportaciones o procesos batch.

## Arranque recomendado

1. Crear proyecto nuevo en Supabase.
2. Abrir SQL Editor.
3. Ejecutar completo `supabase/sql/100_clean_start_schema.sql`.
4. Crear el usuario administrador con correo `edwin.qm@outlook.com`.
5. Confirmar que `user_profiles` queda con `role = admin`,
   `status = approved` e `is_super_admin = true`.
6. Crear algunos registros manuales de prueba desde la app:
   - 1 recurso
   - 1 cotizacion
   - 1 requerimiento desde cotizacion ganada
   - 2 items de requerimiento
7. Revisar conteos y relaciones.

Storage:

- Bucket: `resource-files`
- Rutas esperadas:
  - `recursos/{resourceId}/image/{archivo}`
  - `recursos/{resourceId}/datasheet/{archivo}`
  - `recursos/{resourceId}/attachments/{archivo}`

## Validaciones despues de crear datos de prueba

```sql
select 'recursos' as table_name, count(*) from public.recursos
union all select 'cotizaciones', count(*) from public.cotizaciones
union all select 'requerimientos', count(*) from public.requerimientos
union all select 'requerimiento_items', count(*) from public.requerimiento_items
union all select 'technical_proposals', count(*) from public.technical_proposals;

select
  c.codigo,
  count(r.id) as requerimientos
from public.cotizaciones c
left join public.requerimientos r on r.cotizacion_id = c.id and r.deleted_at is null
where c.deleted_at is null
group by c.codigo
order by c.codigo desc
limit 20;

select
  r.codigo,
  count(ri.id) as items,
  coalesce(sum(ri.costo_total_presupuestado), 0) as total_items
from public.requerimientos r
left join public.requerimiento_items ri on ri.requerimiento_id = r.id and ri.deleted_at is null
where r.deleted_at is null
group by r.codigo
order by r.codigo desc
limit 20;
```

Validar RPC paginadas:

```sql
select * from public.search_cotizaciones_page(null, null, 20, 0);
select * from public.search_recursos_page(null, null, null, 20, 0);
select * from public.search_requerimientos_page(null, null, 20, 0);
```

## Cambios recomendados en la app

Prioridad 1:

- Reemplazar `listAllRecursos()` en `RecursosContent` por `listRecursos(params)`.
- Reemplazar `listCotizaciones()` por una version paginada.
- Reemplazar `listRequerimientos()` por una version paginada.
- Mantener detalles por demanda: `requerimiento_items` solo por RQ abierto.

Prioridad 2:

- Usar vistas resumen para tablas principales.
- Usar RPCs con `limit` maximo 100.
- Cache de 5 minutos solo para resultados de pagina/filtro, no para tablas completas.
- Invalidar cache despues de guardar.

Prioridad 3:

- Dashboard con RPC de metricas agregadas, no leyendo listas completas.
- Busqueda global con RPC que devuelva maximo 20 resultados por entidad.
- Realtime solo en `workspace_state`, pendientes de usuario y sala activa.

## Regla operativa

Nada de `select("*")` ni `fetchAll` para pantallas principales. Si una pantalla
muestra 12, 20 o 50 filas, Supabase debe devolver solo esas filas.
