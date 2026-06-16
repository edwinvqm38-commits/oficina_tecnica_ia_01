-- 038_workspace_state_rls_diagnostic_fix_PROPOSED.sql
-- ESTADO: PROPUESTO — NO EJECUTADO EN SUPABASE.
-- Este archivo es solo una propuesta para revisión humana. No fue corrido
-- contra ninguna base de datos real como parte de este diagnóstico.
--
-- Contexto:
-- supabase/schema.sql tiene la tabla workspace_state con RLS habilitado y
-- policies "using/with check (true)" (ver 034_roundtable_shared_chat.sql),
-- pero supabase/schema.sql no tiene NINGÚN "grant" sobre workspace_state.
-- La migración 035_workspace_state_grants.sql ya agrega esos grants, pero
-- no hay forma de confirmar desde el repo si 035 llegó a ejecutarse contra
-- la base real. Sin el GRANT correspondiente, PostgREST devuelve
-- "permission denied for table workspace_state" antes de evaluar RLS —
-- esto es la causa más probable de los 500 en
-- POST/GET .../workspace_state observados en consola.
--
-- Este archivo es 100% idempotente (drop/create policy, grant repetible) y
-- solo reafirma lo que 035 ya debería haber aplicado, para poder ejecutarlo
-- de forma segura una sola vez si hay duda de que 035 corrió.
--
-- Importante:
-- - No borra ni modifica datos existentes.
-- - No cambia RQ, cotizaciones, importación histórica, SISTEMA V2/SGP-LITE.
-- - No se ejecutó como parte de este diagnóstico.

grant usage on schema public to authenticated;
grant select, insert, update on public.workspace_state to authenticated;

drop policy if exists workspace_state_read on public.workspace_state;
create policy workspace_state_read
on public.workspace_state
for select
to authenticated
using (true);

drop policy if exists workspace_state_write on public.workspace_state;
create policy workspace_state_write
on public.workspace_state
for insert
to authenticated
with check (true);

drop policy if exists workspace_state_update on public.workspace_state;
create policy workspace_state_update
on public.workspace_state
for update
to authenticated
using (true)
with check (true);

-- ============================================================
-- Diagnóstico (ejecutar manualmente para confirmar el estado real, no
-- modifica nada): lista los grants actuales sobre workspace_state.
-- ============================================================
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'workspace_state';
