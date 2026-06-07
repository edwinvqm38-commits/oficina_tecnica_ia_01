# Fase 6 - Dry-run de importacion observada

## Objetivo
Simular localmente una carga historica observada sin insertar datos en Supabase, dejando claro:
- que se intentaria cargar
- con que metadata historica
- con que calidad de datos
- con que conflictos o bloqueos

## Entradas
Desde `tmp_imports`:
- `enriched_preview_cotizaciones.csv`
- `enriched_preview_requerimientos.csv`
- `enriched_preview_detalle_rq.csv`
- `enriched_import_summary.json`
- `validation_issues.csv` si existe
- `historical_import_compatibility_report.json` si existe

## Salidas
Dentro de `tmp_imports/dry_run`:
- `historical_import_dry_run_summary.json`
- `planned_cotizaciones.csv`
- `planned_requerimientos.csv`
- `planned_detalle_rq.csv`
- `planned_import_batch.json`
- `planned_import_issues.csv`
- `conflict_report.csv`
- `import_readiness_report.md`

## Reglas del dry-run
- No inserta datos.
- No ejecuta SQL.
- No modifica tablas reales.
- No corrige datos automaticamente.
- No descarta registros observados o criticos.
- Mantiene `CRITICO_REVISAR` en el plan con `action_planned = review_required`.
- Separa calidad de dato del estado operativo.

## Diferencia entre simulacion y carga real
- El dry-run solo arma el plan que se podria usar en una futura carga observada.
- La carga real requerira una fase posterior con estrategia de transaccion, rollback logico, RLS y trazabilidad operativa.
- `codigo_para_importacion_simulado` no reemplaza el codigo original del preview; solo ayuda a visualizar que valor se usaria.

## Manejo por calidad de dato
- `OK`
  - puede quedar como `insert_planned` si no hay conflictos
- `OBSERVADO`
  - sigue en el plan
  - no se descarta
- `COMPLETAR_DATOS`
  - sigue en el plan
  - conserva vacios y metadata para revision posterior
- `CRITICO_REVISAR`
  - sigue en el plan
  - queda como `review_required`

## Deteccion de conflictos
### Conflictos locales
- `cotizacion_codigo_duplicado_en_preview`
- `historical_cotizacion_key_duplicado`
- `historical_rq_key_duplicado`
- `codigo_rq_duplicado_en_misma_cotizacion`
- `detalle_sin_rq_key`
- `detalle_rq_key_sin_requerimiento_preview`
- `cotizacion_key_sin_cotizacion_preview`
- `data_quality_status_invalido`

### Conflictos opcionales con Supabase
Solo si se usa `--check-supabase` y existe configuracion segura:
- `import_batch_id_ya_existe`
- `cotizacion_codigo_ya_existe`
- `requerimiento_codigo_ya_existe`

El chequeo remoto es solo por `SELECT`. Si la configuracion no existe o falla, el dry-run continua en modo local.

## Que revisar antes de una carga real
- `readiness_status`
- `conflict_report.csv`
- `planned_import_issues.csv`
- registros `CRITICO_REVISAR`
- registros `COMPLETAR_DATOS`
- conflictos de codigos ya existentes
- consistencia de `metadata_historical_import_json`

## Checklist antes de Fase 7
- [ ] Confirmar que `historical_import_compatibility_report.json` tenga `totalIssues = 0`
- [ ] Revisar `planned_import_batch.json`
- [ ] Revisar `planned_import_issues.csv`
- [ ] Revisar `conflict_report.csv`
- [ ] Confirmar estrategia de manejo para `CRITICO_REVISAR`
- [ ] Confirmar estrategia de manejo para codigos historicos sin codigo original
- [ ] Confirmar si se hara chequeo remoto con Supabase antes de la primera carga real
- [ ] Confirmar plan de rollback logico antes de insertar cualquier dato
