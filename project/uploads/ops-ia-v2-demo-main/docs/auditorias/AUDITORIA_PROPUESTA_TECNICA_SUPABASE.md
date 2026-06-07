# Auditoria Propuesta Tecnica / Supabase

Fecha de auditoria: 2026-06-02

## 1. Resumen ejecutivo

El modulo **SGP-LITE Propuesta Tecnica** ya existe funcionalmente en frontend: abre desde cotizaciones como `PT REV00`, administra encabezado, destinatario, referencia, grupos/actividades variables, recursos por actividad, imagenes, condiciones comerciales, logos, vista previa A4 y exportaciones Word/HTML/JSON/PDF.

Sin embargo, el estado estructurado de la Propuesta Tecnica no esta persistido en Supabase. Actualmente se guarda como borrador local en `localStorage` por cotizacion y revision. Los logos de empresa/cliente tambien se guardan en `localStorage`. Supabase hoy cubre principalmente `cotizaciones`, `recursos`, `requerimientos`, `requerimiento_items`, permisos administrativos y trazabilidad de importacion historica, pero no existe un modelo relacional propio para Propuesta Tecnica.

Conclusion: antes de subir el modulo a uso real multiusuario, falta crear persistencia formal para propuesta tecnica, items jerarquicos, recursos usados como snapshot, archivos/exportaciones, logos y eventos de auditoria.

## 2. Estado actual encontrado

### Frontend relacionado

- `components/technical-proposal/TechnicalProposalWorkspace.tsx`: componente principal del workspace PT.
- `components/technical-proposal/TechnicalProposalResourceGrid.tsx`: grilla de recursos por actividad.
- `components/technical-proposal/ResourceAutocompleteInput.tsx`: buscador/autocomplete de recursos maestros.
- `components/technical-proposal/TechnicalProposalResourceInspector.tsx`: detalle del recurso seleccionado.
- `components/technical-proposal/TechnicalProposalUsedResourcesPanel.tsx`: lista compacta de recursos usados.
- `components/technical-proposal/TechnicalProposalTopbar.tsx`: barra superior del workspace PT.
- `components/quotations/TechnicalProposalWorkspaceModal.tsx`: re-export del workspace PT.
- `components/quotations/QuotationWorkspaceModal.tsx`: abre `PT REV00` desde cotizaciones.
- `app/recursos/page.tsx`: incluye gestion local de logos en pestana `Logos`.
- `lib/proposalLogos.ts`: helper local de logos basado en `localStorage`.

### Persistencia actual de Propuesta Tecnica

El borrador PT se guarda en navegador con clave:

```txt
opsia:technical-proposal:draft:{codigoCotizacion}:REV00
```

Los logos se guardan en navegador con clave:

```txt
opsia:proposal-logos:v1
```

Esto implica:

- No hay sincronizacion multiusuario.
- No hay persistencia real si cambia navegador/dispositivo.
- No hay historico de revisiones ni trazabilidad.
- No hay permisos/RLS especificos para Propuesta Tecnica.
- No hay Storage para archivos exportados o imagenes.

## 3. Tablas existentes detectadas

La carpeta `supabase/sql` auditada contiene migraciones 006 a 019. Varias tablas principales ya existen en Supabase aunque no todas se crean en esta carpeta; algunas son asumidas por repositorios o por comentarios de migraciones.

| Tabla | Evidencia | Funcion actual | Relacion con PT | Reutilizable |
|---|---|---|---|---|
| `public.cotizaciones` | `lib/quotationsRepository.ts`, SQL 014/015/018/019 | Cabecera comercial de cotizaciones | PT debe vincularse a una cotizacion | Si, como tabla madre |
| `public.recursos` | `lib/recursosRepository.ts`, SQL 006/007/008/009 | Maestro de recursos | PT toma snapshots editables desde recursos | Si, como catalogo maestro |
| `public.requerimientos` | `lib/requirementsRepository.ts`, SQL 014/015/018 | Requerimientos/RQ | No debe mezclarse con PT | No para PT, solo referencia futura |
| `public.requerimiento_items` | `lib/requirementItemsRepository.ts`, SQL 014/015/017/018 | Detalle operativo/economico de RQ | No debe recibir recursos PT directamente | No para PT |
| `public.admin_module_permissions` | SQL 010/011, `lib/modulePermissionsRepository.ts` | Permisos por modulo/usuario | Puede extenderse para modulo `technical_proposals` | Si |
| `public.user_profiles` | referenciada en RLS SQL 010/011/013/014/015/017/018/019 | Perfiles y super admin | Base para RLS futura | Si |
| `public.historical_import_batches` | SQL 012/013/014/015/016 | Lotes de importacion historica | No corresponde a PT operativa | No |
| `public.historical_import_issues` | SQL 012/013/014/016 | Issues de importacion historica | No corresponde a PT operativa | No |
| Catalogos de recursos (`catalog_tipos_recurso`, `catalog_unidades_medida`, `proveedores`, `marcas`) | SQL 006, repositorio recursos | Normalizacion/catalogos de recursos | Apoyo para maestro, no para snapshot PT | Parcial |

## 4. Repositorios Supabase existentes

| Archivo | Tabla(s) | Operaciones | Observacion |
|---|---|---|---|
| `lib/quotationsRepository.ts` | `cotizaciones` | listar/crear cotizaciones | Guarda metadata inicial documental para codigos `COT-EKA-YYYY-NNN`, pero no PT estructurada |
| `lib/recursosRepository.ts` | `recursos` | listar recursos y filtros | Recursos se usan como maestro; PT copia snapshot editable |
| `lib/requirementsRepository.ts` | `requerimientos` | listar RQ | No debe tocarse para PT |
| `lib/requirementItemsRepository.ts` | `requerimiento_items` + relaciones | listar detalle RQ | No debe usarse para persistir PT |
| `lib/modulePermissionsRepository.ts` | `admin_module_permissions` | leer/upsert permisos | Reutilizable para permisos de futuro modulo PT |
| `lib/proposalLogos.ts` | ninguna | localStorage | Debe migrarse a tabla `entity_logos` + Storage |

## 5. Datos de Propuesta Tecnica detectados en frontend

El tipo `TechnicalProposalDraft` concentra el estado actual:

| Dato usado en app | Fuente actual | Tabla Supabase existente | Falta tabla/campo | Recomendacion |
|---|---|---|---|---|
| Codigo de propuesta/documento | `metadata.documento_codigo` derivado de cotizacion | `cotizaciones.metadata` solo guarda estructura madre inicial | Falta `technical_proposals.code` | Crear `technical_proposals` |
| Cotizacion vinculada | `cotizacion.codigo` / props del modal | `cotizaciones` | Falta FK formal desde PT | `technical_proposals.cotizacion_id` |
| Cliente | `draft.recipient.cliente` desde cotizacion | `cotizaciones.cliente_nombre` | Campo editable PT no persistido | Guardar snapshot en `technical_proposals.recipient` jsonb o columnas |
| Unidad de trabajo | `draft.recipient.unidad_trabajo` | `cotizaciones.unidad_trabajo_nombre` | Snapshot editable PT no persistido | Guardar en `technical_proposals.recipient` |
| Proyecto | `cotizacion.proyecto` | `cotizaciones.proyecto` | PT no tiene snapshot formal | Referenciar cotizacion y snapshot en metadata |
| Fecha | `draft.header.fecha` | `cotizaciones.fecha_presentacion` no equivale necesariamente | Falta fecha propia PT | `technical_proposals.document_date` |
| Revision | `metadata.revision = REV00` | `cotizaciones.metadata.revision_actual` inicial | Falta revision por documento | `technical_proposals.revision` |
| Estado PT | `work_status` local | no existe | Falta estado PT | `technical_proposals.status` |
| Logo EKA | `localStorage opsia:proposal-logos:v1` | no existe | Falta tabla/storage | `entity_logos` |
| Logo cliente | `localStorage opsia:proposal-logos:v1` | no existe | Falta tabla/storage | `entity_logos` por cliente |
| Titulo/subtitulo | `draft.header` | no existe | Falta persistencia | `technical_proposals.header` jsonb |
| Destinatario | `draft.recipient` | cotizacion parcial | Falta snapshot editable | `technical_proposals.recipient` jsonb |
| Referencia | `draft.presentation.referencia` | no existe | Falta persistencia | `technical_proposals.presentation` jsonb |
| Texto de presentacion | `draft.presentation.texto` | no existe | Falta persistencia | `technical_proposals.presentation` jsonb |
| Grupos/subgrupos/actividades | `draft.scope_items` | no existe | Falta tabla vertical jerarquica | `technical_proposal_items` |
| Descripcion tecnica | `ScopeItem.description` | no existe | Falta campo por item | `technical_proposal_items.technical_description` |
| Tiempo estimado | `ScopeItem.time_value/time_unit` | no existe | Falta campos por item | `technical_proposal_items.estimated_time_value/unit` |
| Recursos por actividad | `draft.resources` | `recursos` solo maestro | Falta snapshot PT | `technical_proposal_resources` |
| Imagenes | `general_images`, `activity_images` como data URL local | no existe | Falta tabla/Storage | `technical_proposal_files` |
| Condiciones comerciales | `draft.conditions` | no existe | Falta persistencia | MVP: `technical_proposals.commercial_terms jsonb` |
| Exportaciones | Word/HTML/JSON/PDF generadas en cliente | no existe | Falta registro/archivo | `technical_proposal_files` |
| Eventos | no existe | `historical_import_*` no aplica | Falta trazabilidad operativa | `technical_proposal_events` |

## 6. Brechas detectadas

1. No existe tabla `technical_proposals`.
2. No existe tabla jerarquica para grupos/actividades variables.
3. No existe tabla de recursos usados en PT como snapshot editable.
4. No existe tabla de logos de entidades.
5. No existe persistencia de condiciones comerciales.
6. No existe almacenamiento formal de imagenes/referencias del documento.
7. No existe registro de exportaciones Word/HTML/PDF/JSON.
8. No existe trazabilidad de cambios o eventos del documento PT.
9. No existe repositorio Supabase para Propuesta Tecnica.
10. No existen politicas RLS especificas para PT.
11. La informacion local puede perderse al limpiar navegador, cambiar dispositivo o trabajar con varios usuarios.

## 7. Modelo de datos propuesto

### 7.1 `entity_logos`

Objetivo: administrar logos reutilizables para empresa y clientes.

Campos sugeridos:

- `id uuid primary key`
- `entity_type text not null` (`company`, `client`)
- `entity_key text not null`
- `display_name text not null`
- `logo_url text`
- `storage_path text`
- `is_default boolean default false`
- `is_active boolean default true`
- `metadata jsonb default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`
- `created_by uuid`
- `updated_by uuid`

Reglas:

- `company` + `EKA MINING SAC` puede ser default.
- `client` se resuelve por `entity_key` normalizado del cliente.
- Si se implementa Storage, `storage_path` debe ser preferido sobre URL libre.

### 7.2 `technical_proposals`

Objetivo: cabecera documental de cada propuesta tecnica por cotizacion/revision.

Campos sugeridos:

- `id uuid primary key`
- `cotizacion_id uuid references public.cotizaciones(id)`
- `cotizacion_codigo text not null`
- `code text not null unique`
- `document_type text not null default 'PT'`
- `revision text not null default 'REV00'`
- `revision_folder text not null default '01_REV00'`
- `status text not null default 'Borrador'`
- `mode text not null default 'cliente'`
- `work_status text not null default 'Borrador'`
- `document_date date`
- `header jsonb not null default '{}'`
- `recipient jsonb not null default '{}'`
- `presentation jsonb not null default '{}'`
- `commercial_terms jsonb not null default '{}'`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`
- `created_by uuid`
- `updated_by uuid`

Recomendacion: para MVP, usar `commercial_terms jsonb`. Si luego se requiere analitica por condicion, migrar a `technical_proposal_terms`.

### 7.3 `technical_proposal_items`

Objetivo: guardar estructura variable sin columnas infinitas.

Campos sugeridos:

- `id uuid primary key`
- `technical_proposal_id uuid references technical_proposals(id) on delete cascade`
- `parent_id uuid references technical_proposal_items(id)`
- `item_type text not null` (`group`, `subgroup`, `activity`)
- `item_number text not null`
- `level integer not null`
- `sort_order integer not null`
- `title text not null`
- `technical_description text`
- `estimated_time_value numeric`
- `estimated_time_unit text`
- `is_complete boolean default false`
- `internal_comments text`
- `metadata jsonb default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`

### 7.4 `technical_proposal_resources`

Objetivo: snapshot editable de recursos usados en una actividad.

Campos sugeridos:

- `id uuid primary key`
- `technical_proposal_id uuid references technical_proposals(id) on delete cascade`
- `technical_proposal_item_id uuid references technical_proposal_items(id) on delete cascade`
- `resource_id uuid references recursos(id)` nullable
- `resource_category text not null`
- `codigo_recurso text`
- `codigo_fabricante text`
- `tipo_recurso text`
- `descripcion text not null`
- `unidad text`
- `cantidad numeric not null default 1`
- `tiempo numeric`
- `precio_unitario_ref numeric`
- `moneda_codigo text`
- `proveedor text`
- `marca text`
- `comentario text`
- `detalle_adicional text`
- `origin_status text not null` (`catalogo_copiado`, `nuevo_por_formalizar`)
- `metadata jsonb default '{}'`
- `sort_order integer`
- `created_at timestamptz`
- `updated_at timestamptz`

Regla clave: editar una fila PT no debe modificar `public.recursos`.

### 7.5 `technical_proposal_files`

Objetivo: registrar imagenes, documentos exportados y referencias.

Campos sugeridos:

- `id uuid primary key`
- `technical_proposal_id uuid references technical_proposals(id) on delete cascade`
- `technical_proposal_item_id uuid references technical_proposal_items(id)` nullable
- `resource_snapshot_id uuid references technical_proposal_resources(id)` nullable
- `file_type text not null` (`general_image`, `activity_image`, `export_doc`, `export_pdf`, `export_html`, `export_json`)
- `title text`
- `relation_label text`
- `storage_path text`
- `public_url text`
- `mime_type text`
- `file_size bigint`
- `metadata jsonb default '{}'`
- `created_at timestamptz`
- `created_by uuid`

### 7.6 `technical_proposal_events`

Objetivo: trazabilidad operativa.

Campos sugeridos:

- `id uuid primary key`
- `technical_proposal_id uuid references technical_proposals(id) on delete cascade`
- `event_type text not null`
- `event_message text`
- `actor_id uuid`
- `actor_email text`
- `metadata jsonb default '{}'`
- `created_at timestamptz`

Eventos recomendados:

- `created`
- `updated`
- `status_changed`
- `resource_assigned`
- `resource_reused`
- `logo_resolved`
- `exported_word`
- `exported_html`
- `exported_json`
- `printed_pdf`

## 8. Estrategia de implementacion recomendada

### Fase 1: Auditoria y reporte

Estado: este documento.

### Fase 2: SQL de tablas faltantes

Crear siguiente migracion propuesta:

```txt
supabase/sql/020_technical_proposals_schema.sql
```

Contenido esperado:

- `entity_logos`
- `technical_proposals`
- `technical_proposal_items`
- `technical_proposal_resources`
- `technical_proposal_files`
- `technical_proposal_events`
- indices basicos
- triggers `updated_at`
- RLS inicial alineada a `admin_module_permissions`

No ejecutar automaticamente sin revision/aprobacion.

### Fase 3: Repositorios Supabase

Crear:

- `lib/technicalProposalsRepository.ts`
- `lib/entityLogosRepository.ts`

Operaciones minimas:

- `getTechnicalProposalByCotizacionRevision(cotizacionId, revision)`
- `createTechnicalProposalFromDraft(draft)`
- `saveTechnicalProposalDraft(draft)`
- `listEntityLogos()`
- `upsertEntityLogo()`

### Fase 4: Guardar/cargar Propuesta Tecnica

Migrar gradualmente:

1. Cargar desde Supabase si existe.
2. Si no existe, crear draft desde cotizacion.
3. Mantener `localStorage` solo como autosave/fallback temporal.
4. Boton Guardar debe persistir en Supabase.

### Fase 5: Gestion de logos desde Recursos

Reemplazar `localStorage` por `entity_logos`.

Pendiente: decidir si se suben archivos a Supabase Storage o si inicialmente se permite `logo_url` externa.

### Fase 6: Vincular PT con cotizacion

Agregar metadata/campo de estado documental en `cotizaciones.metadata`, por ejemplo:

```json
{
  "technical_proposal": {
    "id": "...",
    "code": "COT-EKA-2026-001-PT-REV00",
    "revision": "REV00",
    "status": "Borrador"
  }
}
```

No duplicar todo el documento dentro de `cotizaciones.metadata`.

### Fase 7: Trazabilidad

Registrar eventos clave en `technical_proposal_events`.

### Fase 8: Exportaciones persistidas en Storage

Guardar exportaciones Word/PDF/HTML/JSON en Storage y registrar metadata en `technical_proposal_files`.

## 9. Riesgos

- **Perdida de informacion local**: hoy el draft PT depende de navegador.
- **Inconsistencia multiusuario**: dos usuarios pueden editar propuestas distintas sin sincronizacion.
- **Recursos maestros vs snapshot**: si se persiste mal, se podria modificar `recursos` al editar PT; debe evitarse.
- **Imagenes base64**: no escalan bien; deben ir a Storage.
- **Logos por URL externa**: pueden romperse por permisos, CORS o expiracion.
- **Exportaciones no auditadas**: actualmente no queda evidencia de Word/PDF/HTML generado.
- **RLS pendiente**: nuevas tablas deben respetar permisos por modulo y rol.
- **Condiciones comerciales jsonb**: rapido para MVP, menos consultable si luego se requiere reporting.

## 10. Que NO se toco

- No se modifico SQL.
- No se ejecuto Supabase.
- No se cambio logica de Requerimientos.
- No se cambio formato ni generacion de codigos RQ.
- No se tocaron `createRequerimientoFromCotizacion` ni `createRequerimientoWithData`.
- No se modifico importacion historica.
- No se cambio codigo funcional del workspace PT en esta auditoria.

## 11. Recomendacion del siguiente SQL

Crear, revisar y aprobar una migracion nueva:

```txt
020_technical_proposals_schema.sql
```

Prioridad de tablas en esa migracion:

1. `entity_logos`
2. `technical_proposals`
3. `technical_proposal_items`
4. `technical_proposal_resources`
5. `technical_proposal_files`
6. `technical_proposal_events`

Recomendacion de MVP:

- Persistir cabecera y condiciones en `technical_proposals`.
- Persistir estructura variable en `technical_proposal_items`.
- Persistir recursos como snapshots en `technical_proposal_resources`.
- Dejar archivos/exportaciones en `technical_proposal_files`, aunque Storage se implemente en una fase posterior.
- Mantener RQ completamente aislado.
