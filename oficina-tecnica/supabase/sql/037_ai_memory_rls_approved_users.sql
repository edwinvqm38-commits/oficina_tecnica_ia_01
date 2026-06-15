-- 037_ai_memory_rls_approved_users.sql
-- Proposed hardening for AI memory/workspace RLS.
--
-- IMPORTANT:
-- - Local proposal only. Do not run against Supabase without separate approval.
-- - Keeps user_profiles own-profile access unchanged so login/approval gates work.
-- - Uses SECURITY DEFINER helpers to avoid recursive RLS checks on user_profiles.
-- - Keeps table-level GRANTs as the base permission layer; RLS is the hard gate.

begin;

-- Helpers -------------------------------------------------------------------
-- SECURITY DEFINER is intentional: policies on other tables need to check
-- user_profiles.status without being blocked by user_profiles RLS or causing
-- recursion. The function returns false when auth.uid() is null.
create or replace function public.is_approved_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = check_user_id
      and up.status::text = 'approved'
  );
$$;

create or replace function public.has_approved_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.status::text = 'approved'
      and (
        up.role::text = any(allowed_roles)
        or up.is_super_admin is true
        or lower(coalesce(up.email, '')) = 'edwin.qm@outlook.com'
      )
  );
$$;

revoke all on function public.is_approved_user(uuid) from public;
revoke all on function public.has_approved_role(text[]) from public;
grant execute on function public.is_approved_user(uuid) to authenticated;
grant execute on function public.has_approved_role(text[]) to authenticated;

-- workspace_state ------------------------------------------------------------
alter table public.workspace_state enable row level security;

drop policy if exists "workspace_state_read" on public.workspace_state;
drop policy if exists "workspace_state_write" on public.workspace_state;
drop policy if exists "workspace_state_update" on public.workspace_state;
drop policy if exists "workspace_state_select_approved" on public.workspace_state;
drop policy if exists "workspace_state_insert_approved" on public.workspace_state;
drop policy if exists "workspace_state_update_approved" on public.workspace_state;

create policy "workspace_state_select_approved"
on public.workspace_state
for select
to authenticated
using (public.is_approved_user());

create policy "workspace_state_insert_approved"
on public.workspace_state
for insert
to authenticated
with check (public.is_approved_user());

create policy "workspace_state_update_approved"
on public.workspace_state
for update
to authenticated
using (public.is_approved_user())
with check (public.is_approved_user());

-- agent_conversations --------------------------------------------------------
alter table public.agent_conversations enable row level security;

drop policy if exists "users_own_conversations" on public.agent_conversations;
drop policy if exists "admin_read_conversations" on public.agent_conversations;
drop policy if exists "roundtable_shared_memory" on public.agent_conversations;
drop policy if exists "agent_conversations_own_approved" on public.agent_conversations;
drop policy if exists "agent_conversations_admin_read_approved" on public.agent_conversations;
drop policy if exists "agent_conversations_roundtable_approved" on public.agent_conversations;

create policy "agent_conversations_own_approved"
on public.agent_conversations
for all
to authenticated
using (
  public.is_approved_user()
  and auth.email() = user_id
)
with check (
  public.is_approved_user()
  and auth.email() = user_id
);

create policy "agent_conversations_admin_read_approved"
on public.agent_conversations
for select
to authenticated
using (public.has_approved_role(array['admin', 'gerencia']));

create policy "agent_conversations_roundtable_approved"
on public.agent_conversations
for all
to authenticated
using (
  public.is_approved_user()
  and user_id = 'roundtable-shared'
)
with check (
  public.is_approved_user()
  and user_id = 'roundtable-shared'
);

-- agent_memories -------------------------------------------------------------
alter table public.agent_memories enable row level security;

drop policy if exists "authenticated_read_memories" on public.agent_memories;
drop policy if exists "admin_write_memories" on public.agent_memories;
drop policy if exists "agent_memories_select_approved" on public.agent_memories;
drop policy if exists "agent_memories_insert_approved_role" on public.agent_memories;

create policy "agent_memories_select_approved"
on public.agent_memories
for select
to authenticated
using (public.is_approved_user());

create policy "agent_memories_insert_approved_role"
on public.agent_memories
for insert
to authenticated
with check (public.has_approved_role(array['admin', 'gerencia', 'responsable']));

-- Base grants ----------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update on public.workspace_state to authenticated;
grant select, insert, update, delete on public.agent_conversations to authenticated;
grant select, insert on public.agent_memories to authenticated;

commit;

-- Manual test matrix expected before applying remotely:
-- anon:
--   workspace_state select/insert/update: denied
--   agent_conversations select/insert/update/delete: denied
--   agent_memories select/insert: denied
--   user_profiles own profile select: denied
-- authenticated pending:
--   workspace_state select/insert/update: denied
--   agent_conversations select/insert/update/delete: denied
--   agent_memories select/insert: denied
--   user_profiles own profile select: allowed
-- authenticated disabled/rejected:
--   workspace_state select/insert/update: denied
--   agent_conversations select/insert/update/delete: denied
--   agent_memories select/insert: denied
--   user_profiles own profile select: allowed
-- authenticated approved:
--   workspace_state select/insert/update: allowed
--   agent_conversations own and roundtable select/insert/update/delete: allowed
--   agent_memories select: allowed
--   agent_memories insert: denied unless role is admin/gerencia/responsable
--   user_profiles own profile select: allowed
-- admin approved:
--   workspace_state select/insert/update: allowed
--   agent_conversations select/insert/update/delete: allowed by own/roundtable; broad select allowed
--   agent_memories select/insert: allowed
--   user_profiles own profile select: allowed
