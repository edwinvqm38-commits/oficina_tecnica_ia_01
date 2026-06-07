-- 017_requerimiento_items_historical_repair_update_policy.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Este archivo no reimporta datos, no borra registros y no modifica estructura.
-- Su objetivo es habilitar una reparacion historica puntual y auditable sobre
-- public.requerimiento_items para IMPORT-2026-003 / RQ-CJM075-001_2025.
--
-- Alcance:
-- - mantiene RLS activo
-- - no habilita DELETE
-- - no otorga permisos a anon
-- - no abre UPDATE general de requerimiento_items
-- - limita UPDATE a super admin aprobado o fallback autorizado
-- - limita UPDATE a registros historicos del lote y RQ especificados
-- - limita GRANT UPDATE a columnas usadas por el script de reparacion

begin;

alter table public.requerimiento_items enable row level security;

-- GRANT minimo por columnas. GRANT no reemplaza RLS; solo habilita el permiso base.
grant update (
  compra,
  ajuste,
  atencion_real,
  cant_stock,
  informacion_adicional,
  observaciones_item,
  recurso_a_suministrar,
  metadata
) on public.requerimiento_items to authenticated;

-- Patron reutilizado del proyecto:
-- public.user_profiles + auth.uid() + status = approved + is_super_admin
-- con fallback explicito para edwin.qm@outlook.com.

drop policy if exists "requerimiento_items_update_super_admin_historical_repair_2026_003_rq_cjm075_001_2025"
on public.requerimiento_items;

create policy "requerimiento_items_update_super_admin_historical_repair_2026_003_rq_cjm075_001_2025"
on public.requerimiento_items
for update
to authenticated
using (
  metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-003'
  and metadata -> 'historical_import' ->> 'source_row_number' is not null
  and metadata -> 'historical_import' ->> 'historical_rq_key' like '%||RQ-CJM075-001_2025'
  and exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.status::text = 'approved'
      and (
        up.is_super_admin is true
        or lower(up.email) = 'edwin.qm@outlook.com'
      )
  )
)
with check (
  metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-003'
  and metadata -> 'historical_import' ->> 'source_row_number' is not null
  and metadata -> 'historical_import' ->> 'historical_rq_key' like '%||RQ-CJM075-001_2025'
  and exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.status::text = 'approved'
      and (
        up.is_super_admin is true
        or lower(up.email) = 'edwin.qm@outlook.com'
      )
  )
);

-- Validacion manual 1: RLS activo.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'requerimiento_items';

-- Validacion manual 2: grants relevantes sobre requerimiento_items.
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'requerimiento_items'
order by grantee, privilege_type;

-- Validacion manual 3: politica UPDATE puntual.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'requerimiento_items'
order by policyname;

-- Validacion manual 4: alcance esperado de filas reparables.
select
  count(*) as repair_scope_rows
from public.requerimiento_items
where metadata -> 'historical_import' ->> 'import_batch_id' = 'IMPORT-2026-003'
  and metadata -> 'historical_import' ->> 'source_row_number' is not null
  and metadata -> 'historical_import' ->> 'historical_rq_key' like '%||RQ-CJM075-001_2025';

commit;
