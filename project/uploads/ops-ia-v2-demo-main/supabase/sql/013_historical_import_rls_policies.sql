-- 013_historical_import_rls_policies.sql
-- Politicas RLS para tablas auxiliares de importacion historica.
-- Estas tablas no almacenan la importacion final de cotizaciones,
-- requerimientos ni requerimiento_items.
-- Su uso es auxiliar para lotes e issues de importacion observada.
-- Acceso restringido solo a super admin.
-- Delete queda bloqueado por decision conservadora.

begin;

alter table public.historical_import_batches enable row level security;
alter table public.historical_import_issues enable row level security;

-- Patron reutilizado del proyecto:
-- public.user_profiles + auth.uid() + status = approved + is_super_admin
-- con fallback explicito para edwin.qm@outlook.com.

-- =========================
-- historical_import_batches
-- =========================

drop policy if exists "historical_import_batches_select_super_admin" on public.historical_import_batches;
create policy "historical_import_batches_select_super_admin"
on public.historical_import_batches
for select
to authenticated
using (
  exists (
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

drop policy if exists "historical_import_batches_insert_super_admin" on public.historical_import_batches;
create policy "historical_import_batches_insert_super_admin"
on public.historical_import_batches
for insert
to authenticated
with check (
  exists (
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

drop policy if exists "historical_import_batches_update_super_admin" on public.historical_import_batches;
create policy "historical_import_batches_update_super_admin"
on public.historical_import_batches
for update
to authenticated
using (
  exists (
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
  exists (
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

-- ========================
-- historical_import_issues
-- ========================

drop policy if exists "historical_import_issues_select_super_admin" on public.historical_import_issues;
create policy "historical_import_issues_select_super_admin"
on public.historical_import_issues
for select
to authenticated
using (
  exists (
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

drop policy if exists "historical_import_issues_insert_super_admin" on public.historical_import_issues;
create policy "historical_import_issues_insert_super_admin"
on public.historical_import_issues
for insert
to authenticated
with check (
  exists (
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

drop policy if exists "historical_import_issues_update_super_admin" on public.historical_import_issues;
create policy "historical_import_issues_update_super_admin"
on public.historical_import_issues
for update
to authenticated
using (
  exists (
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
  exists (
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

-- Validacion 1: confirmar politicas creadas en tablas auxiliares.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('historical_import_batches', 'historical_import_issues')
order by tablename, policyname;

commit;
