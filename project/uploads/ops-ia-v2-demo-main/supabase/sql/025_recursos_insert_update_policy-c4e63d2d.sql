-- 025_recursos_insert_update_policy.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Habilita creacion y edicion controlada de recursos desde /recursos.
--
-- Alcance:
-- - habilita INSERT y UPDATE solo para authenticated
-- - mantiene RLS activo
-- - no habilita DELETE
-- - no toca storage ni archivos
-- - no toca requerimientos, codigos RQ, Propuesta Tecnica ni importacion historica
-- - exige usuario aprobado con permisos del modulo recursos
-- - permite UPDATE con can_edit o can_upload_files porque los documentos viven en metadata
-- - permite super admin / admin / fallback temporal edwin.qm@outlook.com

begin;

alter table public.recursos enable row level security;

-- GRANT minimo base. RLS sigue aplicando la restriccion final.
grant insert on public.recursos to authenticated;
grant update on public.recursos to authenticated;

drop policy if exists "recursos_insert_by_module_permission"
on public.recursos;

create policy "recursos_insert_by_module_permission"
on public.recursos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and lower(amp.module_key) = 'recursos'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_create = true
      )
  )
);

drop policy if exists "recursos_update_by_module_permission"
on public.recursos;

create policy "recursos_update_by_module_permission"
on public.recursos
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and lower(amp.module_key) = 'recursos'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
        or amp.can_upload_files = true
      )
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    left join public.admin_module_permissions amp
      on lower(amp.user_email) = lower(up.email)
      and lower(amp.module_key) = 'recursos'
    where up.id = auth.uid()
      and lower(up.status::text) = 'approved'
      and (
        up.is_super_admin is true
        or up.role::text = 'admin'
        or lower(up.email) = 'edwin.qm@outlook.com'
        or amp.can_edit = true
        or amp.can_upload_files = true
      )
  )
);

comment on policy "recursos_insert_by_module_permission" on public.recursos is
'Permite insertar recursos solo a usuarios autenticados aprobados con can_create en recursos o rol administrativo.';

comment on policy "recursos_update_by_module_permission" on public.recursos is
'Permite actualizar recursos solo a usuarios autenticados aprobados con can_edit/can_upload_files en recursos o rol administrativo.';

-- Validacion manual 1: grants INSERT/UPDATE para authenticated.
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'recursos'
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'UPDATE')
order by privilege_type;

-- Validacion manual 2: politicas INSERT/UPDATE creadas.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'recursos'
  and policyname in (
    'recursos_insert_by_module_permission',
    'recursos_update_by_module_permission'
  )
order by policyname;

-- Validacion manual 3: DELETE no fue otorgado por esta migracion.
select
  count(*) = 0 as authenticated_delete_not_granted
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'recursos'
  and grantee = 'authenticated'
  and privilege_type = 'DELETE';

commit;
