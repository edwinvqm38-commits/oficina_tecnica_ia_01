# Fase 5.2 - Propuesta de metadata y lotes

## Objetivo
Dejar preparada una propuesta tecnica no destructiva para soportar importacion historica observada, trazabilidad por lote y seguimiento de issues sin mezclar estos datos con el estado operativo normal.

## Por que usar metadata para calidad de datos
- Evita agregar muchas columnas nuevas en tablas operativas.
- Mantiene juntas la trazabilidad de origen y la calidad del dato historico.
- Permite evolucionar la estructura de importacion sin romper la logica funcional actual.
- Separa claramente:
  - estado operativo del negocio
  - estado de calidad del dato historico

## Estructura recomendada
Guardar dentro de `metadata.historical_import`:
- `import_batch_id`
- `import_source`
- `source_row_number`
- `historical_cotizacion_key`
- `historical_rq_key`
- `historical_rq_code_suggested`
- `data_quality_status`
- `data_quality_label`
- `data_quality_color`
- `data_quality_notes`
- `data_quality_issues_count`
- `data_quality_has_critical`
- `data_quality_has_warning`

## Tablas que ya tienen metadata
Segun el esquema real observado:
- `public.cotizaciones`
- `public.requerimientos`
- `public.requerimiento_items`

## Decision confirmada para tablas principales
- `public.cotizaciones` ya tiene `metadata jsonb`.
- `public.requerimientos` ya tiene `metadata jsonb`.
- `public.requerimiento_items` ya tiene `metadata jsonb`.
- No se requiere agregar columna `metadata` en las tablas principales.
- La estrategia principal es usar `metadata.historical_import` en las tres entidades.

## Por que crear import_batches
- Permite registrar cada lote historico como una unidad trazable.
- Facilita resumir volumen, calidad y estado de preparacion.
- Hace posible repetir pruebas sin perder referencia del origen.
- Permite luego conectar UI administrativa o reportes sin tocar los registros importados uno por uno.

## Por que crear import_issues
- Permite persistir issues detectados por entidad y lote.
- Facilita revision humana posterior.
- Permite marcar issues como resueltos sin borrar trazabilidad.
- Evita depender solo de archivos CSV locales cuando ya exista una carga observada.

## Seguridad RLS de tablas auxiliares
- RLS esta activo en:
  - `public.historical_import_batches`
  - `public.historical_import_issues`
- Las politicas propuestas en `supabase/sql/013_historical_import_rls_policies.sql` limitan `select`, `insert` y `update` solo a super admin.
- `delete` no se habilita inicialmente por decision conservadora.
- Estas tablas son auxiliares y no representan la carga final de cotizaciones, requerimientos ni items.
- La carga real historica se preparara recien en una fase posterior.

## Que queda pendiente antes de ejecutar SQL
- Confirmar schema real de:
  - `public.cotizaciones`
  - `public.requerimientos`
  - `public.requerimiento_items`
- Definir RLS para las tablas nuevas propuestas.
- Definir si los issues se cargaran completos o resumidos por entidad.
- Definir estrategia de rollback logico para una futura carga observada.

## Checklist antes de Fase 6
- [ ] Confirmar esquema real desplegado en Supabase.
- [ ] Confirmar uso de `metadata.historical_import` en las tres entidades principales.
- [ ] Confirmar estructura final de `historical_import_batches`.
- [ ] Confirmar estructura final de `historical_import_issues`.
- [ ] Confirmar estrategia para registros `CRITICO_REVISAR`.
- [ ] Confirmar si la primera carga sera total o por lotes parciales.
- [ ] Confirmar reglas de visualizacion futura en la app para `OK`, `OBSERVADO`, `COMPLETAR_DATOS` y `CRITICO_REVISAR`.
- [ ] Revisar el archivo `supabase/sql/012_historical_import_metadata_proposal.sql` antes de cualquier ejecucion manual.
