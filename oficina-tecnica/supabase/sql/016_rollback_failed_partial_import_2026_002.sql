-- 016_rollback_failed_partial_import_2026_002.sql
-- PROPUESTA NO DESTRUCTIVA HASTA SU REVISION.
-- Este archivo esta preparado especificamente para el lote historico IMPORT-2026-002.
-- No debe ejecutarse sin revision humana previa.
-- Su objetivo es revertir un failed_partial donde:
-- - public.cotizaciones tiene registros del batch
-- - public.requerimientos tiene registros parciales del batch
-- - public.requerimiento_items no llego a insertarse
-- - public.historical_import_issues no llego a insertarse
-- IMPORTANTE:
-- - no toca IMPORT-2026-001
-- - no borra public.historical_import_batches
-- - actualiza el batch IMPORT-2026-002 a rolled_back_failed_partial

begin;

-- 1. Conteos previos del batch objetivo.
select
  'pre_count_requerimiento_items' as check_name,
  count(*) as total_rows
from public.requerimiento_items
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

select
  'pre_count_requerimientos' as check_name,
  count(*) as total_rows
from public.requerimientos
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

select
  'pre_count_cotizaciones' as check_name,
  count(*) as total_rows
from public.cotizaciones
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

select
  'pre_count_historical_import_issues' as check_name,
  count(*) as total_rows
from public.historical_import_issues
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

select
  'pre_batch_status' as check_name,
  import_batch_id,
  status,
  metadata
from public.historical_import_batches
where import_batch_id = 'IMPORT-2026-002';

-- 2. Rollback controlado por import_batch_id en metadata historica.
-- Orden seguro:
--   1) items
--   2) requerimientos
--   3) cotizaciones
--   4) issues

delete from public.requerimiento_items
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

delete from public.requerimientos
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

delete from public.cotizaciones
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

delete from public.historical_import_issues
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

-- 3. Conservar auditoria del batch y marcar rollback explicito.
update public.historical_import_batches
set
  status = 'rolled_back_failed_partial',
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{historical_import}',
    coalesce(metadata -> 'historical_import', '{}'::jsonb) || jsonb_build_object(
      'rollback_batch_id', 'IMPORT-2026-002',
      'rollback_reason', 'failed_partial_duplicate_requerimientos_codigo',
      'rollback_recommended_next_batch_id', 'IMPORT-2026-003',
      'rollback_previously_reported_error', coalesce(
        metadata -> 'historical_import' -> 'execution_error',
        jsonb_build_object('message', 'duplicate key value violates unique constraint "requerimientos_codigo_key"')
      ),
      'rollback_marked_at', now()
    )
  ),
  updated_at = now()
where import_batch_id = 'IMPORT-2026-002';

-- 4. Conteos posteriores del batch objetivo.
select
  'post_count_requerimiento_items' as check_name,
  count(*) as total_rows
from public.requerimiento_items
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

select
  'post_count_requerimientos' as check_name,
  count(*) as total_rows
from public.requerimientos
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

select
  'post_count_cotizaciones' as check_name,
  count(*) as total_rows
from public.cotizaciones
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

select
  'post_count_historical_import_issues' as check_name,
  count(*) as total_rows
from public.historical_import_issues
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-002';

select
  'post_batch_status' as check_name,
  import_batch_id,
  status,
  metadata
from public.historical_import_batches
where import_batch_id = 'IMPORT-2026-002';

commit;
