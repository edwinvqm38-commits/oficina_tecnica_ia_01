# Fase 6.2 - Revision funcional del dry-run

## Objetivo
Generar una lectura funcional y resumida del dry-run de importacion historica observada para decidir si el lote puede avanzar a una futura Fase 7 o si debe detenerse para revision adicional.

## Archivos de entrada
Desde `tmp_imports/dry_run`:
- `historical_import_dry_run_summary.json`
- `planned_cotizaciones.csv`
- `planned_requerimientos.csv`
- `planned_detalle_rq.csv`
- `planned_import_issues.csv`
- `conflict_report.csv`
- `import_readiness_report.md` si existe

## Archivos de salida
Dentro de `tmp_imports/dry_run`:
- `review_report.md`
- `review_summary.json`
- `review_critical_samples.csv`
- `review_completar_datos_samples.csv`
- `review_observado_samples.csv`

## Como interpretar los estados de calidad
- `OK`
  - registro funcionalmente util para una carga observada sin alerta relevante
- `OBSERVADO`
  - registro util, pero con observaciones de consistencia o contexto
- `COMPLETAR_DATOS`
  - registro incompleto que debe mantenerse con trazabilidad para completado posterior
- `CRITICO_REVISAR`
  - registro que requiere revision humana antes de cualquier autorizacion de carga

## Como revisar muestras criticas
- abrir `review_critical_samples.csv`
- priorizar requerimientos y detalle RQ
- revisar:
  - `data_quality_notes`
  - `action_planned`
  - `source_row_number`
  - `historical_rq_key`
  - `conflict_notes`

## Criterios para autorizar Fase 7
- `readiness_status` no bloqueado
- conflictos en cero o plenamente entendidos
- criterios funcionales definidos para `CRITICO_REVISAR`
- criterios funcionales definidos para `COMPLETAR_DATOS`
- muestras revisadas por negocio o responsable funcional

## Criterios para detener Fase 7
- conflictos estructurales
- issues criticos sin criterio funcional acordado
- planned import issues no priorizados
- ausencia de decision sobre como manejar registros historicos incompletos

## Recomendacion operativa
La revision funcional no reemplaza el dry-run tecnico. Sirve para traducir el plan a una decision de negocio antes de cualquier carga observada real.
