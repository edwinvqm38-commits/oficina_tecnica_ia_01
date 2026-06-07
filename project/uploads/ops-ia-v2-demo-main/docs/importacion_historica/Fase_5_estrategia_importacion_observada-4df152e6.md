# Fase 5 - Estrategia de importacion observada

## Objetivo
Preparar una estrategia tecnica segura para una futura importacion historica observada hacia Supabase, conservando trazabilidad y calidad de datos sin descartar registros incompletos.

## Alcance
- Definir tablas destino probables para cotizaciones, requerimientos e items historicos.
- Determinar donde guardar calidad de dato, trazabilidad de origen y claves historicas.
- Separar claramente estado operativo de estado de calidad de importacion.
- Dejar checklist previo a cualquier carga real.

## Archivos de entrada
- `tmp_imports/enriched_preview_cotizaciones.csv`
- `tmp_imports/enriched_preview_requerimientos.csv`
- `tmp_imports/enriched_preview_detalle_rq.csv`
- `tmp_imports/enriched_import_summary.json`
- `tmp_imports/validation_issues.csv`
- `tmp_imports/catalog_equivalence_candidates.json`

## Estado actual del codigo
### Confirmado en el repo
- `app/api/cotizaciones/route.ts` y `services/quotationService.ts` siguen sirviendo cotizaciones desde `demoData`.
- `app/api/requerimientos/route.ts` y `services/requirementService.ts` siguen sirviendo requerimientos desde `demoData`.
- `lib/recursosRepository.ts` si consume `public.recursos` en Supabase.
- `services/auditService.ts` hoy es un stub local, no una tabla real de trazabilidad.

### Confirmado en tipos de negocio
Desde `lib/demoData.ts` existen los modelos funcionales:
- `Cotizacion`
- `CotizacionEconomicRow`
- `Requerimiento`
- `DetalleRequerimientoItem`
- `Recurso`
- `ResourceFileMeta`
- `ProyectoAdjudicado`

### Limitacion importante
En este repo no estan versionados localmente los SQL de `cotizaciones` y `requerimientos` que se generaron en fases anteriores. Por eso:
- la estructura objetivo de Supabase para cotizaciones y requerimientos se infiere desde tipos TypeScript, previews locales y acuerdos funcionales previos;
- cualquier SQL futuro debe validarse contra el esquema real desplegado antes de ejecutar.

## Tablas destino identificadas
## 1. `public.cotizaciones`
### Rol
Entidad padre de la importacion historica.

### Campos confirmados por tipo funcional
- `id`
- `codigo`
- `oc`
- `cliente`
- `proyecto`
- `unidad_trabajo`
- `moneda_cotizacion`
- `estado`
- `estado_propuesta`
- `solicitante`
- `responsable_tecnico`
- `responsable_economico`
- `fecha_registro`
- `fecha_presentacion`
- `fecha_invitacion`
- `fecha_confirmacion`
- `fecha_visita_tecnica`
- `fecha_consultas`
- `fecha_abs_consultas`
- `fecha_entrega`
- `fecha_entregada`
- `fecha_oc`
- `tipo_servicio`
- `prioridad`
- `avance`
- `observaciones`
- `monto`
- `flat_mensual`
- `fecha_inicio_analisis`
- `fecha_fin_analisis`
- `meses_analisis`

### Datos historicos recomendados en `metadata`
- `import_batch_id`
- `import_source`
- `data_quality_status`
- `data_quality_label`
- `data_quality_color`
- `data_quality_notes`
- `data_quality_issues_count`
- `data_quality_has_critical`
- `data_quality_has_warning`
- `historical_cotizacion_key`
- `source_row_number`
- `historical_import_mode = "observed"`

## 2. `public.requerimientos`
### Rol
Entidad hija de cotizacion y padre de detalle RQ.

### Campos confirmados por tipo funcional
- `id`
- `codigo`
- `cotizacion_id`
- `cotizacion_codigo`
- `codigo_cliente`
- `codigo_unidad`
- `proyecto_servicio`
- `oc`
- `codigo_proyecto_adjudicado`
- `anio`
- `solicitante_rq`
- `tipo_servicio`
- `area`
- `estado`
- `fecha_solicitud`
- `fecha_requerida`
- `responsable`
- `avance`
- `total_rq`
- `observaciones`

### Datos historicos recomendados en `metadata`
- `import_batch_id`
- `import_source`
- `data_quality_status`
- `data_quality_label`
- `data_quality_color`
- `data_quality_notes`
- `data_quality_issues_count`
- `data_quality_has_critical`
- `data_quality_has_warning`
- `historical_cotizacion_key`
- `historical_rq_key`
- `historical_rq_code_original`
- `historical_rq_code_suggested`
- `source_row_number`

## 3. `public.requerimiento_items`
### Rol
Detalle historico de cada requerimiento.

### Campos confirmados por tipo funcional
- `id`
- `requerimiento_id`
- `recurso_id`
- `cantidad`
- `precio_unitario`
- `subtotal`
- `ajuste`
- `atencion_real`
- `cant_stock`
- `compra`
- `costo_unitario`
- `moneda`
- `tc`
- `factor_eq_herr`
- `costo_total_presupuestado`
- `fecha_coti`
- `estado`
- `informacion_adicional`
- `observaciones_item`
- `recurso_a_suministrar`
- `ficha_tecnica_a_suministrar`
- `proveedor`
- `condicion_pago`
- `tiempo_entrega`
- `eq`
- `eq_fecha_aprob`
- `ll`
- `ll_fecha_aprob`
- `hb`
- `hb_fecha_aprob`
- `logistica_compra`
- `fecha_compra`
- `oc_os_recurso`
- `fecha_entrega`
- `guia_remision`
- `archivo_guia`

### Datos historicos recomendados en `metadata`
- `import_batch_id`
- `import_source`
- `data_quality_status`
- `data_quality_label`
- `data_quality_color`
- `data_quality_notes`
- `data_quality_issues_count`
- `data_quality_has_critical`
- `data_quality_has_warning`
- `historical_cotizacion_key`
- `historical_rq_key`
- `source_row_number`
- `item_excel`
- `raw_currency_original`
- `costo_total_origen = "calculado_por_app"`

## 4. Trazabilidad / auditoria
### Estado actual
- `services/auditService.ts` hoy no persiste en base.

### Recomendacion
- No depender de `auditService` actual para la primera carga historica.
- Si luego se habilita carga real, conviene registrar eventos de lote por tabla aparte, por ejemplo:
  - `import_batches`
  - `import_issues`

## 5. Evidencias / documentos
### Estado actual
- En los modelos funcionales hay archivos referenciales:
  - `ficha`
  - `imagen`
  - `archivo_guia`
  - `resourceFiles`

### Recomendacion
- No bloquear la importacion observada por documentos faltantes.
- Importar primero referencias textuales o metadata en `metadata`.
- Dejar migracion documental real para una fase posterior.

## Mapeo preliminar por entidad
## Cotizacion historica
### Fuente
`enriched_preview_cotizaciones.csv`

### Claves
- `historical_cotizacion_key`
- `codigo`

### Mapeo base
- `codigo` -> `cotizaciones.codigo`
- `cliente` -> `cotizaciones.cliente`
- `unidad_trabajo` -> `cotizaciones.unidad_trabajo`
- `solicitante` -> `cotizaciones.solicitante`
- `tipo_servicio` -> `cotizaciones.tipo_servicio`
- `oc` -> `cotizaciones.oc`
- `fecha_registro` -> `cotizaciones.fecha_registro`
- `avance` -> `cotizaciones.avance`
- `estado` -> `cotizaciones.estado = "Histórico"`
- `estado_propuesta` -> `cotizaciones.estado_propuesta = "Histórico"`
- `monto` -> no cargar por ahora
- `moneda_cotizacion` -> opcional solo si es consistente

## Requerimiento historico
### Fuente
`enriched_preview_requerimientos.csv`

### Claves
- `historical_rq_key`
- `historical_cotizacion_key`
- `codigo`

### Mapeo base
- `codigo` -> `requerimientos.codigo`
- `cotizacion_codigo` -> snapshot funcional
- `oc` -> `requerimientos.oc`
- `cliente` -> snapshot funcional o metadata
- `unidad_trabajo` -> snapshot funcional o metadata
- `solicitante_rq` -> `requerimientos.solicitante_rq`
- `fecha_solicitud` -> `requerimientos.fecha_solicitud`
- `tipo_servicio` -> `requerimientos.tipo_servicio`
- `area` -> `requerimientos.area`
- `items_totales` -> derivado o metadata
- `avance` -> `requerimientos.avance`

## Detalle historico RQ
### Fuente
`enriched_preview_detalle_rq.csv`

### Claves
- `historical_rq_key`
- `source_row_number`

### Mapeo base
- `tipo_recurso` -> `requerimiento_items` o tabla recurso si se homologa luego
- `codigo_fabricante`
- `descripcion`
- `unidad`
- `cantidad`
- `precio_unitario`
- `moneda`
- `tc`
- `estado`
- `proveedor`
- `eq`, `ll`, `hb`
- `eq_fecha_aprob`, `ll_fecha_aprob`, `hb_fecha_aprob`
- `oc_os_recurso`
- `guia_remision`
- `archivo_guia`

## Estrategia por calidad de dato
## Registros `OK`
- Pueden entrar a una futura carga observada sin bloqueo.
- Igual deben registrar `metadata.import_batch_id` y `metadata.data_quality_status = "OK"`.

## Registros `OBSERVADO`
- Deben importarse conservando datos historicos.
- No deben bloquearse por mezcla de monedas, multiples OC o multiples tipos de servicio.
- Deben mostrarse en app con badge visual independiente del estado operativo.

## Registros `COMPLETAR_DATOS`
- Deben importarse conservando el dato historico incompleto.
- Campos faltantes deben quedar vacios o `null`.
- La UI futura debe permitir revisarlos o completarlos sin perder trazabilidad.

## Registros `CRITICO_REVISAR`
- No deben descartarse, pero no conviene importarlos en una primera carga masiva sin estrategia de revision.
- Recomendacion: cargarlos solo si existe:
  - lote marcado como observado
  - cola de revision humana posterior
  - lista de issues por entidad

## Estrategias puntuales
## RQ historicos sin codigo
- No reemplazar el codigo original si viene vacio.
- Guardar sugerencia en `metadata.historical_rq_code_suggested`.
- No mezclarlo con el formato operativo actual `RQ-2026-NEXA-PCON-P001-0001`.

## Regla de trazabilidad para RQ historicos sin codigo original
- Si existe codigo RQ original:
  - `historical_rq_key = historical_cotizacion_key + "||" + codigo_rq_normalizado`
- Si no existe codigo RQ original:
  - `historical_rq_key = historical_cotizacion_key + "||SIN_RQ||ROW_" + source_row_number`
- Si tampoco existe `historical_cotizacion_key`:
  - `historical_rq_key = "SIN_COTIZACION||SIN_RQ||ROW_" + source_row_number`
- El codigo RQ original no se reemplaza.
- Si el Excel vino sin codigo RQ, el campo `codigo_rq` debe permanecer vacio.
- `historical_rq_code_suggested` se usa solo como sugerencia historica.
- No usar el formato nuevo `RQ-2026-NEXA-PCON-P001-0001` para historicos sin codigo.
- Esta clave tecnica sirve para trazabilidad, revision posterior e importacion observada.

## Fechas faltantes o invalidas
- Guardar `null` en fecha estructurada.
- Mantener observacion en `metadata.data_quality_notes`.
- Opcionalmente guardar el valor crudo original en `metadata.raw_dates`.

## OC faltante
- No bloquear.
- Guardar `null` y marcar `COMPLETAR_DATOS`.

## Monedas multiples por cotizacion
- No colapsar una sola moneda de cabecera a la fuerza.
- Mantener moneda por item.
- En cotizacion, registrar observacion en metadata.

## Cantidades invalidas
- Mantener el registro solo en una futura carga observada especial.
- Marcar `CRITICO_REVISAR`.
- No usarlo para calculos consolidados hasta revision.

## Precio unitario vacio
- Mantener item con `precio_unitario = null`.
- Marcar `COMPLETAR_DATOS`.

## Estrategia de trazabilidad
- Toda entidad importada debe conservar:
  - `import_batch_id`
  - `import_source`
  - `historical_cotizacion_key`
  - `historical_rq_key`
  - `source_row_number`
  - `data_quality_status`
  - `data_quality_notes`

## Propuesta de `import_batch_id`
- Formato sugerido:
  - `IMPORT-HIST-YYYY-NNN`
- Ejemplo:
  - `IMPORT-HIST-2026-001`

## Donde guardar la calidad de dato
### Preferencia aprobada
Guardar todo dentro de `metadata jsonb` cuando la tabla ya tenga `metadata`.

### Evaluacion actual
- `public.cotizaciones` ya tiene `metadata jsonb` segun el esquema real observado.
- `public.requerimientos` ya tiene `metadata jsonb` segun el esquema real observado.
- `public.requerimiento_items` ya tiene `metadata jsonb` segun el esquema real observado.

### Decision para esta fase
- Para `cotizaciones`, usar `metadata` como contenedor principal de trazabilidad y calidad.
- Para `requerimientos`, usar `metadata` como contenedor principal de trazabilidad y calidad.
- Para `requerimiento_items`, usar `metadata` como contenedor principal de trazabilidad y calidad.
- No crear columnas sueltas para `data_quality_status` por ahora.
- Priorizar `metadata` para evitar cambios grandes y mantener la importacion historica desacoplada del estado operativo.

## Estrategia de almacenamiento de calidad de datos
### Estructura recomendada dentro de `metadata`
```json
{
  "historical_import": {
    "import_batch_id": "IMPORT-2026-001",
    "import_source": "historical_excel",
    "source_row_number": 123,
    "historical_cotizacion_key": "FOR-EKA-PRO-3_2025-143",
    "historical_rq_key": "FOR-EKA-PRO-3_2025-143||SIN_RQ||ROW_245",
    "historical_rq_code_suggested": "RQ-HIST-SIN-CODIGO-0001",
    "data_quality_status": "COMPLETAR_DATOS",
    "data_quality_label": "Completar datos",
    "data_quality_color": "orange",
    "data_quality_notes": "rq_sin_codigo; item_sin_precio_unitario",
    "data_quality_issues_count": 2,
    "data_quality_has_critical": false,
    "data_quality_has_warning": true
  }
}
```

### Aplicacion por entidad
- `cotizaciones`
  - guardar `historical_import` dentro de `metadata`
  - usar `historical_cotizacion_key` como referencia principal de origen
- `requerimientos`
  - guardar `historical_import` dentro de `metadata`
  - usar `historical_rq_key` como referencia principal de trazabilidad historica
- `requerimiento_items`
  - guardar `historical_import` dentro de `metadata`
  - usar `historical_rq_key` y `source_row_number` para trazabilidad fila a fila

## Resultado de compatibilidad posterior a Fase 5.1
- `cotizaciones`: `116`
- `requerimientos`: `750`
- `detalle_rq`: `12256`
- `missing_historical_rq_key`: `0`
- `totalIssues compatibilidad`: `0`
- Recomendacion:
  - `Los archivos enriquecidos cumplen las condiciones minimas para preparar carga observada.`

## Riesgos antes de importar
- DDL de `cotizaciones` y `requerimientos` no versionado localmente en este repo.
- Posibles diferencias entre schema real de Supabase y schema asumido por previews.
- Codigos RQ historicos vacios o duplicados dentro de cotizacion.
- Fechas invalidas no parseables.
- Cantidades cero o negativas que afectarían calculos.
- Mezcla de monedas por cotizacion.
- Campos documentales solo referenciales, no migrados a storage.

## Checklist antes de permitir carga real
- [ ] Verificar schema real de `cotizaciones`, `requerimientos` y `requerimiento_items` en Supabase.
- [x] Confirmar que existe `metadata jsonb` en `cotizaciones`, `requerimientos` y `requerimiento_items`.
- [ ] Confirmar estrategia para `CRITICO_REVISAR`.
- [ ] Confirmar si se importaran todos los historicos o por lotes.
- [ ] Confirmar si se creara `import_batches` y/o `import_issues`.
- [ ] Confirmar estrategia para documentos historicos.
- [ ] Cerrar homologacion de catalogos:
  - clientes
  - unidades
  - tipos de servicio
  - unidades de medida
  - tipos de recurso
  - proveedores
- [ ] Ejecutar `preview`, `validate`, `enrich` y `check compatibility` sobre el lote final.
- [ ] Acordar plan de rollback logico antes de la primera carga real.
