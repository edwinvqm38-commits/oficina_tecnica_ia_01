# REBUILD-0 — Arquitectura de datos nueva (sin dependencia de Supabase)

**Fase actual: REBUILD-0 (diseño documental).**
**No se ha creado código, schema ni migraciones reales para este
documento. No se ha tocado Supabase, ni leído, ni escrito. No se ha
conectado ningún servicio real.**

> Este documento reemplaza, como estrategia activa, el enfoque de
> MIGRATION-1A (descubrimiento de schema vía `pg_dump`/SQL Editor), que
> queda **pausado** por indisponibilidad de Supabase (timeouts en
> conexión directa, reset de contraseña y SQL Editor). El plan
> `MIGRATION_NEON_PLAN.md` y `DATA_MAPPING.md` **no se invalidan**: siguen
> siendo la referencia para una eventual migración futura de datos
> antiguos si Supabase se recupera. Este documento abre una rama de
> trabajo paralela e independiente.

## 1. Diagnóstico

- Supabase (proyecto FREE `sistema-cotizaciones-mvp`) no responde:
  timeout de conexión tanto en `pg_dump`/conexión directa (puerto 5432)
  como en el flujo de **reset de contraseña** desde el Dashboard, y el
  **SQL Editor** tampoco devuelve resultados. Esto es consistente con un
  proyecto FREE **pausado por inactividad** (comportamiento estándar de
  Supabase tras ~1 semana sin actividad), pero no se ha podido confirmar
  ni reactivar dentro de esta sesión.
- Mientras el proyecto esté en ese estado, **MIGRATION-1A no puede
  completarse**: no hay forma de confirmar el schema real (`proveedores`,
  `cotizacion_items`, `notifications`, `audit_logs` siguen sin
  confirmar — ver `DATA_MAPPING.md` §1) ni de exportar `pg_dump
  --schema-only`.
- El código de la aplicación (`lib/sgp/*Repository.ts`) sigue intacto y
  acoplado a Supabase como única fuente de datos para: `recursos`,
  `cotizaciones`, `requerimientos`, `requerimiento_items`,
  `user_profiles`, `workspace_state`, `entity_logos`,
  `admin_module_permissions` (`modulePermissionsRepository.ts`),
  `technical_proposals` (`technicalProposalsRepository.ts`).
- No hay urgencia operativa que obligue a recuperar Supabase de
  inmediato: el problema original (egress 189% en plan FREE) ya tiene
  mitigaciones aplicadas en código (commits `6fb7928`/`459339c`), y no se
  reportan usuarios bloqueados por la pausa actual del proyecto.

## 2. Justificación de empezar de cero

- **Desacoplar el avance del negocio de la disponibilidad de un proyecto
  FREE de terceros.** Si Supabase puede pausarse sin aviso claro y sin
  vía de recuperación inmediata, no es razonable seguir dependiendo de
  él como único punto de entrada de datos *nuevos* mientras se investiga
  o se decide su futuro.
- **No se necesita el schema antiguo para registrar datos nuevos.** El
  rebuild no requiere conocer la estructura exacta de Supabase: se puede
  diseñar un schema nuevo, simple y correcto desde los requisitos de
  negocio actuales (cotizaciones, recursos, requerimientos), y mapear la
  migración histórica **después**, como una fase separada y opcional.
  Esto invierte el orden de `MIGRATION_NEON_PLAN.md` (que exigía
  descubrir el schema antes de modelar) sin contradecirlo: aquí no se
  modela "la copia de Supabase", se modela un sistema nuevo.
- **Reduce el riesgo de bloqueo total.** Mientras se resuelve (o no) el
  acceso a Supabase, el negocio puede seguir operando sobre una base
  propia, sin presión de tiempo sobre la recuperación del proyecto FREE.
- **Compatibilidad conceptual preservada.** Los nombres de entidades, las
  relaciones y los términos de negocio (cotización, recurso,
  requerimiento) se mantienen equivalentes a los de Supabase, de forma
  que una migración histórica futura (si Supabase se recupera) sea un
  mapeo razonable y no una reescritura total.

## 3. Principios de diseño

1. **No tocar Supabase.** Cero lecturas, cero escrituras, cero intentos
   de reset/reconexión como parte de este rebuild. Supabase queda
   congelado tal como está hasta que el usuario decida investigarlo de
   nuevo.
2. **No mezclar datos nuevos con datos antiguos sin decisión explícita.**
   La base nueva no asume que los IDs, códigos o relaciones de Supabase
   sean válidos; cualquier vínculo futuro se hace por mapeo explícito,
   no por coincidencia de nombres.
3. **Simplicidad antes que cobertura.** Modelar solo lo mínimo necesario
   para registrar operación nueva (cotizaciones, recursos,
   requerimientos básicos), no la totalidad de las ~15 tablas inventariadas
   en `DATA_MAPPING.md`.
4. **Módulos sensibles fuera de alcance se mantienen fuera de alcance.**
   Requerimientos "legacy" con su lógica RQ, Propuesta Técnica,
   importación histórica, permisos globales y SISTEMA V2/SGP-LITE no se
   tocan, no se rediseñan y no se reimplementan en este rebuild.
5. **Reversible y aislado.** El nuevo modelo de datos vive en su propio
   espacio (carpeta de schema, rama de Git), sin modificar el código de
   producción actual ni los repositorios existentes, hasta que haya
   aprobación explícita para conectar algo real.
6. **Trazabilidad de origen.** Toda fila nueva debe poder distinguirse
   como "nativa del rebuild" vs. "migrada desde histórico" desde el
   primer diseño (campo de procedencia), aunque la migración histórica
   no ocurra todavía.
7. **Nada de backend complejo todavía.** Este documento es solo de datos
   (modelo conceptual + tablas propuestas), no de API, no de
   autenticación nueva, no de infraestructura.

## 4. Módulos mínimos

Para registrar operación nueva desde cero, sin tocar lo sensible:

| Módulo | Función | Estado respecto a Supabase |
|---|---|---|
| **Identidad mínima** | Quién registra cada dato nuevo (puede ser un `created_by` simple, no un sistema de auth nuevo en esta fase) | Nuevo, desacoplado de `auth.users`/`user_profiles` |
| **Recursos** | Catálogo de recursos/insumos usados en cotizaciones | Nuevo, equivalente conceptual a `recursos` |
| **Cotizaciones** | Cotizaciones nuevas generadas desde el rebuild | Nuevo, equivalente conceptual a `cotizaciones` |
| **Ítems de cotización** | Líneas de detalle de cada cotización | Nuevo — en Supabase esto **nunca se confirmó como tabla propia** (`cotizacion_items` quedó como "no confirmada" en `DATA_MAPPING.md`); aquí se modela explícitamente desde el inicio |
| **Procedencia / origen de dato** | Marca cada fila como `native` (creada en el rebuild) o `legacy_pending` (referencia a un origen histórico aún no migrado) | Nuevo, no existe en Supabase |

Explícitamente **fuera de los módulos mínimos** (no se diseñan aquí):
Requerimientos con lógica RQ, Propuesta Técnica, importación histórica,
permisos globales / `admin_module_permissions`, notificaciones,
auditoría (`audit_logs`), `workspace_state` / mesa de trabajo, SISTEMA
V2/SGP-LITE.

## 5. Tablas nuevas propuestas

Modelo conceptual (sin SQL ni Drizzle todavía — solo diseño):

### `rebuild_resources`
Catálogo de recursos nuevos.
- `id` (PK, identificador propio del rebuild — no reutiliza IDs de Supabase)
- `name`
- `unit` (unidad de medida)
- `reference_cost` (costo de referencia, opcional)
- `created_at`, `updated_at`
- `created_by` (identidad mínima, texto libre o email — no FK a auth nuevo todavía)
- `origin` (`native` | `legacy_pending`) — ver §6

### `rebuild_quotations`
Cotizaciones nuevas.
- `id` (PK)
- `code` (código propio del rebuild, **no reutiliza** la numeración de
  Supabase para evitar colisiones futuras)
- `client_name`
- `status` (estado simple: borrador / enviada / aprobada / rechazada — a
  definir con el usuario, sin asumir los mismos valores que Supabase)
- `total_amount` (calculado o ingresado, a decidir en MIGRATION-1B/REBUILD-1)
- `created_at`, `updated_at`
- `created_by`
- `origin` (`native` | `legacy_pending`)
- `legacy_reference` (campo opcional, texto libre, para anotar manualmente
  "esto continúa la cotización X de Supabase" — sin FK real, solo nota)

### `rebuild_quotation_items`
Ítems/líneas de cada cotización nueva.
- `id` (PK)
- `quotation_id` (FK → `rebuild_quotations.id`)
- `resource_id` (FK → `rebuild_resources.id`, nullable si es un ítem libre)
- `description`
- `quantity`
- `unit_price`
- `subtotal`
- `created_at`

### `rebuild_requirements_basic` (opcional, solo si el negocio lo necesita ya)
Versión **mínima** de requerimiento, sin la lógica RQ ni los flujos de
Propuesta Técnica del sistema legacy.
- `id` (PK)
- `quotation_id` (FK → `rebuild_quotations.id`, nullable)
- `title`
- `status`
- `created_at`, `updated_at`
- `created_by`
- `origin` (`native` | `legacy_pending`)

> Nota: esta tabla se incluye como propuesta porque "requerimientos" es
> mencionado en el alcance original, pero **no implica tocar** la tabla
> `requerimientos` legacy, su numeración RQ, ni
> `createRequerimientoFromCotizacion`/`createRequerimientoWithData`
> (fuera de alcance explícito, ver `DATA_MAPPING.md` §0). Si el usuario
> no necesita requerimientos en el rebuild todavía, esta tabla se
> descarta en REBUILD-1.

## 6. Relación entre tablas nuevas y tablas antiguas

- **No hay relación técnica (FK) entre el schema nuevo y Supabase.** Las
  dos bases son independientes; no hay sincronización automática ni
  vistas cruzadas.
- **Relación conceptual únicamente**, vía dos mecanismos:
  1. Campo `origin` (`native` | `legacy_pending`) en cada tabla nueva,
     para saber si una fila nació en el rebuild o representa un
     placeholder de algo que existía en Supabase y aún no se migró.
  2. Campo `legacy_reference` (texto libre, sin FK) para anotar
     manualmente una correspondencia probable con un registro antiguo,
     útil solo como nota humana hasta que exista una migración real.
- Si en el futuro se recupera Supabase y se decide migrar datos
  históricos (MIGRATION-3 en `MIGRATION_NEON_PLAN.md`), el mapeo se hace
  en una fase separada y explícita: se importan las filas legacy con
  `origin = 'legacy_pending'` y luego se reconcilian manualmente o por
  script, **nunca por coincidencia automática de nombres/códigos**.

## 7. Qué se registra desde cero

- Recursos nuevos (catálogo).
- Cotizaciones nuevas, con su código propio (no reutiliza numeración de
  Supabase).
- Ítems de cotización nuevos (este nivel de detalle **nunca existió
  confirmado** en Supabase, así que aquí no hay "continuidad" que
  romper).
- Opcionalmente, requerimientos básicos nuevos (sin lógica RQ), solo si
  el usuario confirma que los necesita antes de recuperar Supabase.

## 8. Qué queda como histórico pendiente

- Todo lo que hoy vive en Supabase y **no se reescribe ni se reimporta**
  todavía: `user_profiles`, `recursos` antiguos, `cotizaciones` antiguas,
  `requerimientos` antiguos, `requerimiento_items` antiguos,
  `workspace_state` (mesa de trabajo / chats), `notifications` (embebidas
  en `workspace_state`), y las tablas no confirmadas (`proveedores`,
  `cotizacion_items` legacy, `audit_logs`).
- Estos datos **no se pierden ni se tocan**: simplemente quedan "en
  pausa" en Supabase hasta que el usuario decida investigar su
  recuperación o autorice una migración real siguiendo
  `MIGRATION_NEON_PLAN.md`.
- El campo `origin = 'legacy_pending'` en el schema nuevo es el único
  lugar donde se *anticipa* (sin ejecutar) que algún día estos datos
  podrían incorporarse.

## 9. Qué NO se migra (en esta fase ni implícitamente)

- **Ningún dato real de Supabase.** Cero `SELECT`, cero `COPY`, cero
  `pg_dump` contra Supabase como parte de este rebuild.
- **Requerimientos legacy**, códigos RQ y su lógica de numeración.
- **Propuesta Técnica** (`technical_proposals` y tablas relacionadas).
- **Importación histórica** (`historical_import_batches`,
  `historical_import_issues`).
- **Permisos globales** (`admin_module_permissions`).
- **SISTEMA V2 / SGP-LITE**, en su totalidad.
- **Auth**: no se diseña un sistema de autenticación nuevo en esta fase;
  "identidad mínima" (§4) es deliberadamente trivial (no reemplaza login,
  roles ni sesiones reales).

## 10. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Datos nuevos y antiguos quedan en silos separados por un período indefinido | Confusión operativa si alguien busca una cotización antigua en el sistema nuevo | Comunicar claramente al equipo qué sistema usar para qué, mientras Supabase esté pausado |
| Si Supabase se recupera más adelante, la reconciliación manual (`legacy_reference` como texto libre) puede ser laboriosa | Medio — más trabajo en una fase futura de migración | Aceptado deliberadamente: se prioriza desbloquear el registro de datos nuevos ahora sobre una reconciliación automática prematura |
| Tentación de ampliar el "módulo mínimo" hacia funcionalidades sensibles (requerimientos con RQ, Propuesta Técnica) por presión operativa | Alto si ocurre sin aprobación — rompería el alcance acordado | Mantener la lista de exclusiones (§9) visible en cada fase siguiente; cualquier ampliación requiere aprobación explícita y nueva fase nombrada |
| Elegir el motor/hosting de la base nueva sin evaluar alternativas | Bajo-medio — podría repetir el problema de egress de Supabase si se elige mal | REBUILD-1 debe incluir explícitamente la elección de motor/hosting como decisión propia, no asumir Neon ni Supabase por defecto |
| Diseñar el schema sin validarlo con el usuario antes de implementarlo | Medio — retrabajo si los campos/estados no calzan con el negocio real | REBUILD-0 es solo propuesta; REBUILD-1 no implementa hasta validar este documento con el usuario |

## 11. Siguiente fase recomendada — REBUILD-1

No iniciar todavía sin aprobación explícita. Cuando el usuario apruebe,
REBUILD-1 debería:

1. Validar/ajustar con el usuario las tablas propuestas en §5 (nombres,
   campos, si `rebuild_requirements_basic` se incluye o no).
2. Decidir el motor y hosting de la base nueva (Postgres local, Neon,
   Supabase nuevo proyecto, u otro) — decisión explícita, no heredada de
   `MIGRATION_NEON_PLAN.md`.
3. Modelar el schema elegido en código (Drizzle u otro ORM/migrador),
   en una carpeta propia separada de `db/schema/` (que sigue reservada
   para el mapeo Supabase→Neon futuro) — por ejemplo `db/rebuild-schema/`.
4. Generar la primera migración real (sin aplicarla a ningún servicio
   real sin aprobación adicional).
5. Definir cómo se conecta esta base nueva a la app (¿nuevo módulo de
   código, feature flag, ruta separada?) sin tocar los repositorios
   `lib/sgp/*Repository.ts` existentes ni el flujo de login actual.

Hasta que el usuario apruebe REBUILD-1 explícitamente: no se escribe
código, no se generan migraciones, no se crean proyectos de base de
datos nuevos.
