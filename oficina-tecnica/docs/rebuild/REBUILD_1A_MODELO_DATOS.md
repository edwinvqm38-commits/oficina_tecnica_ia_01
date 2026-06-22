# REBUILD-1A — Modelo de datos limpio (validación de diseño)

**Fase actual: REBUILD-1A (diseño documental).**
**No se ha creado SQL, schema en código, migración real, ni conexión a
ningún servicio. No se ha tocado Supabase. No se ha modificado código
funcional.**

> Continúa `docs/migration/REBUILD_0_ARQUITECTURA.md`. REBUILD-0 propuso
> el principio ("rebuild paralelo, sin tocar Supabase") y un primer
> boceto de tablas con prefijo `rebuild_`. Este documento (REBUILD-1A) lo
> reemplaza con un modelo más completo y validado, sin el prefijo
> `rebuild_` (se usan nombres en inglés, en minúsculas, estilo
> convencional de tabla), e incorpora proveedores, precios, logs de
> actividad y adjuntos que REBUILD-0 no cubría.

## 1. Diagnóstico de decisión

### Por qué se inicia un modelo nuevo
El proyecto Supabase (`sistema-cotizaciones-mvp`, plan FREE) dejó de
responder durante MIGRATION-1A: timeout en conexión directa (`pg_dump`),
timeout al resetear la contraseña de base de datos, y el SQL Editor del
Dashboard tampoco devuelve resultados. Esto es consistente con un
proyecto FREE pausado por inactividad, sin vía de reactivación
confirmada dentro de esta sesión. Mientras eso no se resuelva, el negocio
no puede esperar para seguir registrando cotizaciones y recursos nuevos.

### Por qué Supabase queda congelado
No hay urgencia que justifique forzar su recuperación ahora (no se
reportan usuarios bloqueados por la pausa, y las mitigaciones de egress
ya aplicadas en código — commits `6fb7928`/`459339c` — siguen vigentes).
Se prioriza no tocar un sistema en estado desconocido: cero `SELECT`,
cero `pg_dump`, cero intentos de reset adicionales como parte de este
rebuild. Supabase queda como **fuente histórica congelada**, a evaluar
en una fase separada y futura.

### Por qué no se migran datos antiguos ahora
Migrar datos reales requiere: (a) que Supabase vuelva a responder, (b)
un backup verificado, y (c) el schema real confirmado (`pg_dump
--schema-only` o equivalente) — ninguna de las tres condiciones está
disponible hoy. Forzar una migración sin esas condiciones violaría los
principios ya acordados en `MIGRATION_NEON_PLAN.md` (`§2`: "nunca se
mueven datos reales sin backup verificado primero"). La migración
histórica queda pendiente, no cancelada.

### Por qué no se copian tablas malas tal cual
El inventario de `DATA_MAPPING.md` ya identificó problemas estructurales
en el modelo de Supabase que no conviene heredar:
- `workspace_state`: una sola fila JSONB con todo el estado de la app,
  causa raíz del exceso de egress (189% de cuota). Copiarla tal cual
  trasladaría el mismo problema a cualquier base nueva.
- `cotizacion_items`, `proveedores`, `audit_logs`: nunca se confirmaron
  como tablas reales (no hay `CREATE TABLE` ni `.from(...)` en código)
  — no hay nada concreto que "copiar tal cual" para esos tres casos.
- Varias tablas (`recursos`, `cotizaciones`, `requerimientos`,
  `requerimiento_items`) nunca tuvieron un `CREATE TABLE` versionado en
  `supabase/sql/`, es decir, se crearon fuera de control de versiones —
  no hay una definición canónica confiable que replicar 1:1 aunque se
  quisiera.
Por eso el modelo nuevo se diseña desde los requisitos de negocio
(cotizar, registrar recursos y proveedores, llevar requerimientos
básicos), no desde una copia del esquema legacy.

## 2. Principios de diseño

1. **Bajo consumo.** Ninguna tabla almacena blobs ni JSON masivo leído
   completo en cada request; los adjuntos se modelan como metadata
   (referencia a almacenamiento externo), nunca como contenido binario
   en una columna.
2. **Normalización suficiente.** Se separan entidades con identidad
   propia (clientes, proyectos, proveedores, recursos) de sus relaciones
   (ítems, precios), evitando tanto la sobre-normalización innecesaria
   como el antipatrón "todo en un JSON" de `workspace_state`.
3. **Trazabilidad.** Toda tabla de negocio lleva `created_at`,
   `updated_at` y, donde aplique, un registro de quién hizo el cambio.
   `activity_logs` complementa esto a nivel de auditoría ligera entre
   entidades.
4. **Compatibilidad futura.** Los nombres de tabla/campo son
   equivalentes conceptuales a los de Supabase (ver matriz §6), de forma
   que una migración histórica futura sea un mapeo razonable, no una
   reescritura.
5. **Separación de módulos.** El modelo nuevo no reimplementa
   Requerimientos legacy (con código RQ), Propuesta Técnica, permisos
   globales, ni SISTEMA V2/SGP-LITE. Donde el negocio necesite algo
   equivalente, se modela una versión mínima nueva, desacoplada del
   código legacy.
6. **Sin datos reales en Git.** Este y los documentos relacionados nunca
   contienen filas reales, credenciales, ni *connection strings* — solo
   estructura.
7. **Sin archivos pesados en base de datos.** `attachments` almacena
   metadata (nombre, tipo, tamaño, referencia externa); el contenido del
   archivo vive en un storage externo a definir (§8), no en una columna
   `bytea`/`blob`.

## 3. Modelo funcional propuesto

| Módulo | Tabla propuesta | Propósito | Prioridad | Estado | Observaciones |
|---|---|---|---|---|---|
| Clientes | `clients` | Catálogo de clientes para cotizaciones/proyectos | Alta | Propuesta nueva | Equivalente conceptual parcial a datos hoy embebidos como texto libre en `cotizaciones` (`client_name`) |
| Proyectos | `projects` | Agrupar cotizaciones/requerimientos bajo un mismo proyecto de cliente | Media | Propuesta nueva | No existe como tabla en Supabase; se introduce para mejor organización, opcional para MVP |
| Proveedores | `suppliers` | Catálogo de proveedores de recursos | Media | Propuesta nueva | En Supabase, `proveedores` **nunca se confirmó** como tabla propia (parecía campo dentro de `recursos`) |
| Recursos | `resources` | Catálogo de recursos/insumos cotizables | Alta | Equivalente a `recursos` | `recursos` en Supabase está confirmado en código pero sin `CREATE TABLE` versionado |
| Precios de recursos | `resource_prices` | Histórico de precios de un recurso, opcionalmente por proveedor | Media | Propuesta nueva | No existía en Supabase; resuelve la necesidad de versionar precios sin sobrescribir el recurso |
| Cotizaciones | `quotes` | Cotizaciones nuevas | Alta | Equivalente a `cotizaciones` | Numeración propia, no reutiliza códigos de Supabase (ver §8) |
| Ítems de cotización | `quote_items` | Líneas de detalle de cada cotización | Alta | Equivalente conceptual a `cotizacion_items` (nunca confirmada) | Se modela explícito desde el inicio, a diferencia de Supabase |
| Requerimientos (básico) | `requirements` | Versión mínima de requerimiento, sin lógica RQ | Media | Equivalente *parcial* a `requerimientos`, **fuera de alcance hasta aprobación** | Ver exclusión en §7; no se implementa en REBUILD-1B sin luz verde explícita |
| Ítems de requerimiento | `requirement_items` | Líneas de detalle de un requerimiento básico | Media | Equivalente parcial a `requerimiento_items` | Misma condición que `requirements` |
| Auditoría ligera | `activity_logs` | Registro simple de acciones sobre entidades (creación, cambio de estado) | Baja | Reemplaza a `audit_logs` (nunca confirmada en Supabase) | Tabla genérica, no un sistema de auditoría completo |
| Adjuntos | `attachments` | Metadata de archivos asociados a cotizaciones/requerimientos/recursos | Baja | Propuesta nueva | Solo metadata; sin storage real conectado todavía (ver §8) |

## 4. Relaciones principales

- **Cliente → Proyectos**: un `client` tiene cero o más `projects`
  (`projects.client_id` → `clients.id`).
- **Proyecto → Cotizaciones**: un `project` tiene cero o más `quotes`
  (`quotes.project_id` → `projects.id`, nullable: una cotización puede
  no pertenecer a ningún proyecto en el MVP).
- **Cotización → Ítems**: una `quote` tiene una o más `quote_items`
  (`quote_items.quote_id` → `quotes.id`, `ON DELETE CASCADE` conceptual).
- **Recurso → Precios**: un `resource` tiene cero o más
  `resource_prices` a lo largo del tiempo (`resource_prices.resource_id`
  → `resources.id`).
- **Proveedor → Precios**: un `supplier` puede estar asociado a cero o
  más `resource_prices` (`resource_prices.supplier_id` → `suppliers.id`,
  nullable: un precio puede no tener proveedor asignado).
- **Cotización aprobada → Requerimiento nuevo**: cuando una `quote`
  cambia a estado `approved`, puede originar un `requirement`
  (`requirements.quote_id` → `quotes.id`, nullable). Esta relación es
  **conceptual y de diseño únicamente** — la lógica real de creación
  pertenece a REBUILD-1B/1C y está condicionada a la aprobación de §7.
- **Requerimiento → Ítems**: un `requirement` tiene una o más
  `requirement_items` (`requirement_items.requirement_id` →
  `requirements.id`).
- **Entidad → Actividad**: `activity_logs` referencia genéricamente
  cualquier entidad mediante `entity_type` (texto: `"quote"`,
  `"requirement"`, `"resource"`, etc.) + `entity_id`, sin FK fuerte (para
  no acoplar la tabla de logs a cada tabla de negocio).
- **Entidad → Adjuntos**: `attachments` referencia genéricamente
  cualquier entidad mediante `entity_type` + `entity_id`, igual que
  `activity_logs`.

## 5. Campos sugeridos por tabla (diseño, sin SQL)

### `clients`
- `id` (PK)
- Principales: `name`, `tax_id` (opcional), `email`, `phone`
- `created_at`, `updated_at`
- `status` (`active` | `inactive`)
- Soft delete: `deleted_at` (nullable)
- Observaciones: `tax_id` opcional porque no todos los clientes actuales tienen identificación fiscal registrada hoy

### `projects`
- `id` (PK)
- Principales: `client_id` (FK), `name`, `description`
- `created_at`, `updated_at`
- `status` (`active` | `closed` | `on_hold`)
- Soft delete: `deleted_at` (nullable)
- Observaciones: opcional para MVP; si el negocio no agrupa por proyecto todavía, puede diferirse a REBUILD-1B

### `suppliers`
- `id` (PK)
- Principales: `name`, `contact_name`, `email`, `phone`
- `created_at`, `updated_at`
- `status` (`active` | `inactive`)
- Soft delete: `deleted_at` (nullable)
- Observaciones: sin equivalente confirmado en Supabase; validar con el usuario si realmente se necesita como tabla independiente en el MVP

### `resources`
- `id` (PK)
- Principales: `name`, `unit` (unidad de medida), `category` (opcional), `default_supplier_id` (FK nullable a `suppliers`)
- `created_at`, `updated_at`
- `status` (`active` | `inactive`)
- Soft delete: `deleted_at` (nullable)
- Observaciones: `category` queda abierto, a definir junto al usuario qué categorías usa el negocio

### `resource_prices`
- `id` (PK)
- Principales: `resource_id` (FK), `supplier_id` (FK nullable), `price`, `currency`, `valid_from`
- `created_at`
- Estado: no aplica estado propio (es un registro histórico inmutable)
- Soft delete: no aplica (se versiona agregando filas nuevas, no se borra histórico de precios)
- Observaciones: `currency` depende de la decisión pendiente en §8

### `quotes`
- `id` (PK)
- Principales: `code` (numeración propia, ver §8), `client_id` (FK), `project_id` (FK nullable), `title`, `total_amount`, `currency`
- `created_at`, `updated_at`
- `status` (`draft` | `sent` | `approved` | `rejected`, a validar con el usuario)
- Soft delete: `deleted_at` (nullable)
- Observaciones: `total_amount` puede calcularse desde `quote_items` o almacenarse desnormalizado por performance — decisión de REBUILD-1B

### `quote_items`
- `id` (PK)
- Principales: `quote_id` (FK), `resource_id` (FK nullable, para ítems libres no catalogados), `description`, `quantity`, `unit_price`, `subtotal`
- `created_at`
- Estado: no aplica estado propio
- Soft delete: no aplica (se elimina con la cotización completa, o se reemplaza la línea)
- Observaciones: `resource_id` nullable para permitir ítems ad-hoc sin forzar catalogación previa

### `requirements` (⚠️ fuera de alcance de implementación hasta aprobación — ver §7)
- `id` (PK)
- Principales: `quote_id` (FK nullable), `project_id` (FK nullable), `title`, `code` (numeración propia nueva, ver §8)
- `created_at`, `updated_at`
- `status` (a definir)
- Soft delete: `deleted_at` (nullable)
- Observaciones: deliberadamente sin lógica RQ ni relación con `requerimientos` legacy

### `requirement_items` (misma condición que `requirements`)
- `id` (PK)
- Principales: `requirement_id` (FK), `resource_id` (FK nullable), `description`, `quantity`
- `created_at`
- Observaciones: misma condición que `quote_items`

### `activity_logs`
- `id` (PK)
- Principales: `entity_type`, `entity_id`, `action` (`created` | `status_changed` | `updated`, etc.), `actor` (identidad mínima: texto/email, sin FK a auth nuevo), `details` (texto corto o JSON pequeño, **no** el estado completo de la entidad)
- `created_at`
- Observaciones: deliberadamente simple; no reemplaza un sistema de auditoría completo, solo traza eventos clave

### `attachments`
- `id` (PK)
- Principales: `entity_type`, `entity_id`, `file_name`, `mime_type`, `size_bytes`, `storage_reference` (URL o key externa, no el archivo en sí)
- `created_at`
- Soft delete: `deleted_at` (nullable, para "ocultar" sin borrar la referencia)
- Observaciones: storage real a definir en REBUILD-1B/1C (ver decisión pendiente §8); en REBUILD-1A esta tabla es solo metadata, sin ningún archivo conectado

## 6. Matriz de compatibilidad antigua → nueva

| Origen (Supabase) | Destino (modelo nuevo) | Estado origen | Notas |
|---|---|---|---|
| `cotizaciones` | `quotes` | Confirmada en código | Copia conceptual, no 1:1; numeración nueva e independiente |
| `cotizacion_items` | `quote_items` | **Nunca confirmada** en Supabase | El modelo nuevo la define explícita desde el inicio, a diferencia del legacy |
| `recursos` | `resources` | Confirmada en código, sin `CREATE TABLE` versionado | Se rediseña con `resource_prices` separado para versionar precios |
| `proveedores` | `suppliers` | **Nunca confirmada** como tabla propia | En el modelo nuevo se define como catálogo independiente, validar necesidad real con el usuario |
| `requerimientos` (legacy, con códigos RQ) | — | Confirmada en código | **Fuera de alcance hasta aprobación explícita** (ver §7); `requirements` nuevo es una entidad *distinta*, no un reemplazo automático |
| `technical_proposals` (+ relacionadas) | — | Confirmada en código | **Fuera de alcance**, sin equivalente en el modelo nuevo |
| `admin_module_permissions` | — | Confirmada en código | **Fuera de alcance**, sin equivalente en el modelo nuevo |
| `notifications` (embebidas en `workspace_state`) | — | No es tabla propia hoy | **No se incluye en el MVP** del modelo nuevo |
| `audit_logs` | `activity_logs` | **Nunca confirmada** en Supabase | Se reemplaza por una versión simple, no un sistema de auditoría completo |

## 7. Tablas/módulos excluidos por ahora (NO TOCAR / NO MIGRAR)

- **Requerimientos antiguos** (tabla `requerimientos` legacy y su lógica).
- **Códigos RQ históricos** y su generación/numeración.
- **Propuesta Técnica** (`technical_proposals` y tablas relacionadas).
- **Importación histórica** (`historical_import_batches`,
  `historical_import_issues`).
- **Permisos globales** (`admin_module_permissions`).
- **SISTEMA V2 / SGP-LITE**, en su totalidad.
- **Datos reales de Supabase** (ninguna fila se lee, copia ni exporta en
  esta fase).
- **Auth productiva** (`auth.users`, `user_profiles`, login, middleware
  de sesión) — no se diseña ni se toca un sistema de autenticación
  nuevo en REBUILD-1A.

> La tabla `requirements`/`requirement_items` propuesta en §3 y §5 es
> **diseño documental únicamente**. No se implementa en REBUILD-1B sin
> aprobación explícita y separada del usuario, precisamente para no
> confundirla con el módulo legacy excluido arriba.

## 8. Decisiones pendientes

| Decisión pendiente | Opciones | Recomendación | Impacto | Requiere aprobación |
|---|---|---|---|---|
| Motor de base de datos | Neon PostgreSQL / PostgreSQL local / SQLite temporal | PostgreSQL local primero (sin costo, sin egress, permite iterar el schema rápido); evaluar Neon recién en una fase de "base real" posterior, con límites de consumo definidos antes de conectar | Alto — afecta toda la infraestructura futura | Sí |
| ORM | Drizzle (ya mencionado en `MIGRATION_NEON_PLAN.md` y `db/schema/`) | Drizzle, por continuidad con la documentación previa | Medio | Sí (confirmar, no se asume) |
| Autenticación | Postergar vs. diseñar ahora una mínima | Postergar — usar `actor` como texto libre en `activity_logs`/`created_by` hasta que se decida si se reutiliza Supabase Auth, se usa otro proveedor, o se posterga indefinidamente | Alto si se decide mal apresuradamente | Sí |
| Archivos/adjuntos | Metadata primero (sin storage real) vs. conectar storage ya | Metadata primero, como está diseñado en §3/§5; conectar storage real (ej. S3-compatible) solo en una fase posterior con aprobación | Bajo en esta fase, alto si se conecta storage sin decidir proveedor | Sí, antes de conectar cualquier storage |
| Numeración de cotizaciones (`quotes.code`) | Secuencial simple / por año (`2026-Q-0001`) / UUID visible | Por año (`AAAA-Q-NNNN`), legible para el negocio y sin colisión con códigos legacy de Supabase | Medio — visible para usuarios finales | Sí |
| Numeración de requerimientos nuevos (`requirements.code`) | Igual que cotizaciones / esquema propio distinto | Mismo patrón que `quotes.code` pero con prefijo distinto (`AAAA-R-NNNN`), para diferenciarlo claramente de los códigos RQ legacy | Medio | Sí, y condicionado a aprobar `requirements` como módulo (§7) |
| Monedas | Una sola moneda fija / multi-moneda desde el inicio | Una sola moneda fija para el MVP (la que use el negocio hoy), con campo `currency` ya presente para no rediseñar después si se necesita multi-moneda | Bajo ahora, medio si se ignora y se necesita después | Sí (confirmar moneda) |
| Unidades de medida (`resources.unit`) | Texto libre / catálogo cerrado de unidades | Texto libre en el MVP, con posibilidad de normalizar a catálogo cerrado en una fase posterior si el negocio lo requiere | Bajo | No bloqueante, pero informar al usuario |
| Estados de workflow (`quotes.status`, `requirements.status`) | Replicar estados actuales de Supabase / definir estados nuevos más simples | Definir con el usuario los estados reales que necesita el negocio hoy, sin asumir que son los mismos que en Supabase (que tampoco están confirmados en schema) | Alto — afecta toda la lógica de negocio futura | Sí |

## 9. Riesgos

| Riesgo | Descripción | Mitigación |
|---|---|---|
| Rediseñar demasiado | Añadir tablas/campos especulativos (ej. `projects`, `resource_prices`) que el negocio no necesita todavía | Marcarlas como "propuesta, prioridad media/baja" (§3) y confirmar con el usuario antes de implementar en REBUILD-1B; recortar si no se necesitan |
| Copiar malas prácticas del legacy | Repetir el antipatrón de `workspace_state` (todo en un JSON) en alguna tabla nueva | Principio de diseño §2.1/§2.2 ya lo prohíbe explícitamente; revisar cada tabla nueva contra ese criterio antes de implementarla |
| Crear tablas innecesarias | Implementar `suppliers`, `projects`, `requirements` sin que el negocio las use en el día 1 | Mantener prioridad "media/baja" visible y no implementarlas en REBUILD-1B hasta confirmación explícita |
| Conectar servicios antes de tiempo | Conectar Neon, un storage de archivos, o un proveedor de auth antes de tener el schema validado | Todas las decisiones de §8 quedan marcadas "Requiere aprobación"; REBUILD-1B no conecta nada real (ver §10) |
| Mezclar histórico con datos nuevos | Asumir que un ID o código nuevo corresponde a un registro legacy sin verificación | No hay FK real entre el modelo nuevo y Supabase (igual que en REBUILD-0); cualquier correspondencia es manual y explícita, nunca automática |
| Usar Neon sin límites de consumo | Repetir el problema de egress que motivó esta migración, si se conecta Neon sin cuotas/alertas configuradas | Si se elige Neon en §8, definir límites/alertas de consumo **antes** de la primera conexión real, no después |

## 10. Recomendación para REBUILD-1B

No iniciar sin aprobación explícita del usuario. Cuando se apruebe,
REBUILD-1B debería limitarse a:

1. Crear el schema en código usando Drizzle, en una carpeta propia
   (ej. `db/rebuild-schema/`, separada de `db/schema/` que sigue
   reservada para el mapeo Supabase→Neon futuro).
2. **Sin conectar Neon, PostgreSQL local, ni ningún motor real todavía**
   — solo generar los archivos TypeScript de definición de tablas.
3. **Sin ejecutar ninguna migración real** (`drizzle-kit generate`/`push`
   contra una base real queda para una fase posterior, una vez resueltas
   las decisiones de §8).
4. Revisar el schema generado con `lint`/`build` del proyecto, para
   confirmar que no rompe nada existente (al vivir en una carpeta nueva,
   no debería tocar código funcional).
5. Excluir explícitamente `requirements`/`requirement_items` del primer
   schema generado si el usuario no ha aprobado aún ese módulo (§7),
   limitando REBUILD-1B a `clients`, `resources`, `resource_prices`,
   `quotes`, `quote_items`, `suppliers` (si se confirma su necesidad),
   `activity_logs`, `attachments` (solo metadata).

Solo después de REBUILD-1B, y con aprobación explícita por separado, se
evaluaría conectar un motor real (Neon u otro) en una fase REBUILD-1C.
