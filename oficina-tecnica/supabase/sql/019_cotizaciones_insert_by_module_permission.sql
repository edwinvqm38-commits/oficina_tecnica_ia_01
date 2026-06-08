-- 019_cotizaciones_insert_by_module_permission.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Habilita solo la creacion controlada de cotizaciones reales desde Supabase.
--
-- Alcance:
-- - no habilita UPDATE
-- - no habilita DELETE
-- - no abre acceso a anon
-- - no toca requerimientos ni formato RQ
-- - no toca importacion historica
-- - mantiene RLS activo
-- - exige usuario aprobado con can_create = true para el modulo cotizaciones

begin;

alter table public.cotizaciones enable row level security;

-- GRANT minimo base. RLS sigue aplicando la restriccion final.
grant insert on public.cotizaciones to authenticated;

drop policy if exists "cotizaciones_insert_by_module_permission"
on public.cotizaciones;

create policy "cotizaciones_insert_by_module_permission"
on public.cotizaciones
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and amp.module_key = 'cotizaciones'
      and amp.can_create = true
  )
);

-- Validacion manual 1: grant INSERT para authenticated.
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'cotizaciones'
  and grantee = 'authenticated'
order by privilege_type;

-- Validacion manual 2: politica INSERT creada.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'cotizaciones'
  and policyname = 'cotizaciones_insert_by_module_permission';

commit;
