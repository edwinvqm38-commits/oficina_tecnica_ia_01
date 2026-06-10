-- 033_fix_user_profiles_rls_recursion.sql
-- Las políticas "user_profiles_select_admin" / "user_profiles_update_admin"
-- creadas en 032 consultaban public.user_profiles dentro de una política
-- sobre la misma tabla, causando "infinite recursion detected in policy
-- for relation user_profiles". Se reemplazan por una verificación directa
-- del correo del administrador vía auth.jwt(), sin sub-consulta a la tabla.

begin;

drop policy if exists "user_profiles_select_admin" on public.user_profiles;
create policy "user_profiles_select_admin"
on public.user_profiles
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'edwin.qm@outlook.com'
);

drop policy if exists "user_profiles_update_admin" on public.user_profiles;
create policy "user_profiles_update_admin"
on public.user_profiles
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'edwin.qm@outlook.com'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'edwin.qm@outlook.com'
);

-- Validación: como admin, deberías ver todas las filas.
select id, email, role, status, is_super_admin, created_at
from public.user_profiles
order by created_at desc
limit 20;

commit;
