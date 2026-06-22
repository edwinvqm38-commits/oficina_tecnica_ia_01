# Mapeo de Datos — Supabase → Neon (PLAN EGRESO CERO)

**Este documento no contiene datos reales.** Es un inventario de
*estructura* (nombres de tabla, prioridad, estrategia), obtenido por
lectura de código (`supabase/sql/*.sql`, `lib/sgp/*Repository.ts`,
`lib/store/persistence.ts`) — no por consulta directa a Supabase.

## 0. Control de alcance (FUERA DE ALCANCE — leer primero)

Las siguientes tablas, módulos y funciones quedan **explícitamente FUERA
DEL ALCANCE** de MIGRATION-0 y de cualquier fase futura de migración,
**salvo aprobación expresa y por escrito del usuario** para cada una:

- **Requerimientos** y cualquier tabla relacionada.
- **Códigos RQ** y su lógica de generación/numeración.
- **Propuesta Técnica** (`technical_proposals` y sus tablas relacionadas).
- **Importación histórica** (`historical_import_batches`,
  `historical_import_issues` y su flujo).
- **Permisos globales** / `admin_module_permissions`.
- Las funciones `createRequerimientoFromCotizacion` y
  `createRequerimientoWithData`.
- **SISTEMA V2 / SGP-LITE** en su totalidad.
- **Datos reales de producción** (filas reales): nunca se exportan,
  copian ni versionan en esta documentación.

> **NO MIGRAR / NO TOCAR** ninguno de los elementos anteriores hasta
> confirmación explícita del usuario. Su aparición más abajo en este
> documento es **solo inventario informativo**, no una autorización para
> migrarlos o modificarlos.

## 1. Estado de confirmación de cada tabla

El inventario solicitado incluye 11 elementos. Tras revisar el código
(grep de `.from("...")` y los `CREATE TABLE` versionados en
`supabase/sql/`), el estado real es:

| Tabla solicitada | ¿Confirmada en código/SQL? | Notas |
|---|---|---|
| `users` / auth externo | Confirmada (Supabase Auth, `auth.users` interno) | Gestionado por Supabase Auth, no por una tabla de aplicación. |
| `user_profiles` | **Confirmada** (`supabase/sql/032_user_profiles_signup_trigger.sql` y uso extenso en código) | Tabla de aplicación real. |
| `recursos` | **Confirmada** (uso extenso en `lib/sgp/recursosRepository.ts`) | Sin `CREATE TABLE` versionado en `supabase/sql/` — creada fuera de control de versiones. |
| `proveedores` | **No confirmada como tabla propia** | No aparece ningún `.from("proveedores")` ni `CREATE TABLE proveedores`. Parece ser un campo/columna dentro de `recursos` (proveedor del recurso), no una tabla independiente. **Requiere verificación manual en el Dashboard de Supabase antes de asumir su existencia.** |
| `cotizaciones` | **Confirmada** (uso extenso en `lib/sgp/quotationsRepository.ts`) | Sin `CREATE TABLE` versionado — creada fuera de control de versiones. |
| `cotizacion_items` | **No confirmada** | No aparece ningún `.from("cotizacion_items")` ni `CREATE TABLE`. Posiblemente los ítems de cotización viven embebidos o bajo otro nombre. **Requiere verificación manual.** |
| `requerimientos` | **Confirmada** (`lib/sgp/requirementsRepository.ts`) | Sin `CREATE TABLE` versionado. |
| `requerimiento_items` | **Confirmada** (`lib/sgp/requirementItemsRepository.ts`) | Sin `CREATE TABLE` versionado. |
| `workspace_state` | **Confirmada** (`supabase/schema.sql`, `supabase/sql/034_roundtable_shared_chat.sql`, `035_workspace_state_grants.sql`) | Una sola fila con todo el `AppState` en JSONB — ver nota de riesgo abajo. |
| `notifications` | **No confirmada como tabla propia** | Las notificaciones viven actualmente *dentro* del JSON de `workspace_state` (`lib/store/types.ts`), no como tabla relacional. **Requiere decisión: ¿migrar tal cual (JSON) o normalizar en Neon?** |
| `audit_logs` | **No confirmada** | No se encontró ningún `CREATE TABLE audit_logs` ni `.from("audit_logs")`. Sí existen tablas relacionadas a auditoría de otros módulos (`historical_import_batches`, `historical_import_issues` en `012_*.sql`), pero no una tabla genérica de audit log. **Requiere verificación manual.** |

Tablas adicionales confirmadas en el código que **no estaban en la lista
del usuario** pero son relevantes para una migración completa:
`admin_module_permissions`, `entity_logos`, `technical_proposals` (+ 4
tablas relacionadas), `user_access_requests`, `agent_conversations_memories`
(`030_*.sql`), `historical_import_batches`/`historical_import_issues`.

> ⚠️ **NO MIGRAR / NO TOCAR hasta confirmación explícita del usuario.**
> Varias de estas tablas pertenecen a módulos sensibles marcados como
> fuera de alcance en la sección 0: `technical_proposals` (+ relacionadas)
> = **Propuesta Técnica**; `admin_module_permissions` = **permisos
> globales**; `historical_import_batches`/`historical_import_issues` =
> **importación histórica**. Se listan aquí únicamente como inventario
> informativo. No se modelan, copian ni migran sin aprobación expresa.

> Antes de iniciar MIGRATION-1, se recomienda exportar el schema real
> completo desde el Dashboard de Supabase (Database → Schema Visualizer o
> `pg_dump --schema-only`) para confirmar el inventario exacto, en lugar
> de inferirlo solo del código de la aplicación.

### Nota de seguridad — uso de `pg_dump --schema-only`

El uso de `pg_dump --schema-only` (cuando llegue ese momento, no en esta
fase) está sujeto a estas reglas estrictas:

- Solo se permite para exportar **estructura** (DDL), **nunca datos**
  (no usar `--data-only` ni un dump completo sobre tablas reales).
- Debe ejecutarse con **credenciales controladas por el usuario**, no
  embebidas en el repo ni en este entorno.
- Debe ejecutarse **fuera del repositorio** (en `/backups/` o `/exports/`,
  ya cubiertos por `.gitignore`, o fuera del árbol de trabajo).
- El resultado **no debe versionarse en Git** bajo ninguna circunstancia.
- No debe incluir datos reales.
- No debe incluir credenciales, *connection strings*, `anon key` ni
  `service_role key`.
- Cualquier archivo temporal generado debe quedar **fuera de Git** y estar
  cubierto por `.gitignore`.
- Antes de usar el schema exportado para MIGRATION-1, debe **revisarse
  manualmente** (que no contenga secretos, datos ni objetos fuera de
  alcance).

## 2. Matriz de migración

| Tabla origen (Supabase) | Tabla destino (Neon) | Prioridad | Estrategia de migración | Riesgo | Validación |
|---|---|---|---|---|---|
| `auth.users` | Proveedor de auth a definir (Neon no incluye Auth gestionado) | Alta | Requiere decidir reemplazo de Auth (Supabase Auth seguiría existiendo, o migrar a otra solución) — **fuera de alcance de MIGRATION-0** | Alto (afecta login de todos los usuarios) | Conteo de usuarios, pruebas de login en entorno de prueba |
| `user_profiles` | `user_profiles` | Alta | Copia directa (mismo schema), columnas explícitas ya identificadas en `userProfilesRepository.ts` | Medio | Comparar conteo de filas y `status`/`role` por usuario |
| `recursos` | `recursos` | Alta | Copia directa; documentar schema real primero (no versionado hoy) | Medio | Comparar conteo, totales agregados (ej. suma de costos) |
| `proveedores` | A definir | Baja (pendiente confirmar existencia) | N/A hasta confirmar si existe como tabla | Bajo (si no existe, no aplica) | Confirmar en Supabase Dashboard antes de planear |
| `cotizaciones` | `cotizaciones` | Alta | Copia directa; documentar schema real primero | Alto (datos de negocio activos) | Comparar conteo, totales por estado, código de cotización único |
| `cotizacion_items` | A definir | Baja (pendiente confirmar existencia) | N/A hasta confirmar si existe / cómo está modelado | Bajo | Confirmar en Supabase Dashboard antes de planear |
| `requerimientos` | `requerimientos` | Alta | Copia directa; documentar schema real primero | Alto (datos de negocio activos) | Comparar conteo, integridad referencial con `cotizaciones` |
| `requerimiento_items` | `requerimiento_items` | Alta | Copia directa; documentar schema real primero | Alto | Comparar conteo, integridad referencial con `requerimientos` |
| `workspace_state` | A normalizar (no copiar tal cual) | Media | **No migrar 1:1.** Esta tabla es la causa raíz del egress alto (un solo JSON gigante leído por poll+Realtime). Aprovechar la migración para normalizar: tablas separadas para `chats`, `knowledge`, `projects`, `skills`, `notifications` en vez de un blob único | Alto si se copia tal cual (perpetúa el problema de egress en Neon) | Validar que cada sub-recurso normalizado reproduce el contenido actual del JSON antes de cortar |
| `notifications` | Tabla propia nueva (`notifications`) | Media | Extraer desde el JSON de `workspace_state` hacia una tabla relacional real, con `user_id`, `read_at`, `created_at` | Medio | Comparar cantidad de notificaciones extraídas vs las visibles en la UI actual |
| `audit_logs` | A definir | Baja (pendiente confirmar necesidad real) | Si no existe hoy, decidir si se crea desde cero en Neon (auditoría de cambios) o se descarta del alcance | Bajo | Definir con el usuario si es un requisito real o aspiracional |

## 3. Orden recomendado de migración (por dependencias)

1. `user_profiles` (no depende de nada más, todo lo demás referencia
   usuarios por id/email).
2. `recursos` (catálogo, baja dependencia).
3. `cotizaciones` (depende de `user_profiles` vía responsable/cliente).
4. `requerimientos` (depende de `cotizaciones`).
5. `requerimiento_items` (depende de `requerimientos` y `recursos`).
6. `workspace_state` → normalización (depende de tener ya `user_profiles`
   migrado, para poder asociar `notifications`/`chats` a usuarios reales).
7. Tablas adicionales descubiertas (`technical_proposals` y relacionadas,
   `admin_module_permissions`, etc.) — a planear en una matriz ampliada
   una vez confirmado el inventario completo desde el Dashboard.

## 4. Nota sobre `workspace_state` y egress

Esta migración es una oportunidad para resolver de raíz el problema
identificado en la Fase 0/1A del PLAN EGRESO CERO: `workspace_state`
guarda **todo** el estado de la app en una sola fila JSONB, leída
completa en cada poll/Realtime. Migrar esto "tal cual" a Neon trasladaría
el mismo problema de egress a la nueva base. Se recomienda usar
MIGRATION-1 para diseñar un schema normalizado en `db/schema/` en lugar
de replicar la estructura actual.
