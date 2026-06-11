-- 036_user_profiles_directory_select.sql
-- Mesa de trabajo needs a lightweight "directory" of approved users to:
--   - show the "Usuarios en la mesa" sidebar (online/away/offline status)
--   - autocomplete @mentions of teammates (e.g. "@LuisLimaylla")
--
-- Until now, "user_profiles_select_own" only let a user see their own row,
-- and "user_profiles_select_admin" only the hardcoded admin email — so a
-- regular approved user querying user_profiles got an empty result set.
--
-- This adds a SELECT policy letting any authenticated user see the
-- (non-sensitive) profile columns of OTHER approved users: id, email,
-- full_name, role, status. Pending/rejected profiles remain visible only
-- to their owner and the admin.

begin;

create policy "user_profiles_select_approved_directory"
on public.user_profiles
for select
to authenticated
using (status = 'approved');

commit;
