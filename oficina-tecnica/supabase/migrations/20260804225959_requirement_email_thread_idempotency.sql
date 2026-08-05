-- Fase 2: idempotencia e hilos Gmail por requerimiento/cotización.
--
-- Objetos gestionados por esta migración:
-- - public.email_threads.references_header
-- - constraints canónicos sobre public.email_threads
-- - public.email_send_attempts y sus constraints, FK, trigger, grants y RLS
-- - índices de consulta por entidad para hilos e intentos
--
-- Esta migración no elimina, fusiona ni sobrescribe hilos históricos duplicados.
-- Si detecta duplicados incompatibles con la nueva clave activa, se detiene.
--
-- Reversión manual orientativa:
-- - Respaldar public.email_threads y public.email_send_attempts antes de revertir.
-- - Se pueden eliminar policies, trigger, índices y constraints creados aquí con DROP ... IF EXISTS.
-- - Se puede eliminar public.email_send_attempts si no se necesita auditoría/idempotencia histórica.
-- - Revertir lower(user_email) requiere respaldo previo, porque la canonicalización de datos es irreversible sin copia.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception using
      message = 'No existe public.set_updated_at(); aplica primero la migración base de updated_at.';
  end if;
end $$;

alter table public.email_threads
  add column if not exists references_header text;

do $$
declare
  duplicate_count integer;
begin
  if exists (
    select 1
    from public.email_send_attempts
    where user_email is null
      or length(trim(user_email)) = 0
      or entity_type is null
      or entity_type not in ('quotation', 'requirement')
      or entity_code is null
      or length(trim(entity_code)) = 0
      or subject is null
      or length(trim(subject)) = 0
      or idempotency_key is null
      or length(trim(idempotency_key)) = 0
      or status is null
      or status not in ('pending', 'sent', 'failed', 'partial')
      or recipients is null
      or jsonb_typeof(recipients) <> 'array'
      or created_at is null
      or updated_at is null
  ) then
    raise exception using
      message = 'Existen intentos de envío con columnas obligatorias nulas o inválidas. Corrige esos registros antes de aplicar esta migración.';
  end if;

  select count(*)
    into duplicate_count
  from (
    select lower(user_email), gmail_account_id, entity_type, entity_code
    from public.email_threads
    where gmail_account_id is not null
    group by lower(user_email), gmail_account_id, entity_type, entity_code
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception using
      message = 'Existen hilos Gmail duplicados para la nueva clave activa (lower(user_email), gmail_account_id, entity_type, entity_code). Ejecuta el preflight y resuelve los duplicados manualmente antes de aplicar esta migración.';
  end if;
end $$;

-- gmail_account_id permanece nullable porque la tabla base usa ON DELETE SET NULL.
-- Los registros NULL representan hilos históricos o cuentas eliminadas y no participan
-- en el upsert activo. El backend de Fase 1 siempre envía una cuenta Gmail válida,
-- por lo que la clave única normal por columnas protege los hilos activos.
alter table public.email_threads
  drop constraint if exists email_threads_unique;

alter table public.email_threads
  drop constraint if exists email_threads_user_account_entity_unique;

update public.email_threads
set user_email = lower(user_email)
where user_email <> lower(user_email);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_threads_user_email_lowercase'
      and conrelid = 'public.email_threads'::regclass
  ) then
    alter table public.email_threads
      add constraint email_threads_user_email_lowercase
      check (user_email = lower(user_email));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_threads_user_email_not_blank'
      and conrelid = 'public.email_threads'::regclass
  ) then
    alter table public.email_threads
      add constraint email_threads_user_email_not_blank
      check (length(trim(user_email)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_threads_user_account_entity_unique'
      and conrelid = 'public.email_threads'::regclass
  ) then
    alter table public.email_threads
      add constraint email_threads_user_account_entity_unique
      unique (user_email, gmail_account_id, entity_type, entity_code);
  end if;
end $$;

create table if not exists public.email_send_attempts (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  gmail_account_id uuid not null,
  entity_type text not null,
  entity_code text not null,
  subject text not null,
  idempotency_key text not null,
  status text not null default 'pending',
  from_email text,
  gmail_thread_id text,
  gmail_message_id text,
  rfc_message_id text,
  last_error text,
  recipients jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_send_attempts
  add column if not exists gmail_account_id uuid,
  add column if not exists entity_type text,
  add column if not exists entity_code text,
  add column if not exists subject text,
  add column if not exists idempotency_key text,
  add column if not exists status text not null default 'pending',
  add column if not exists from_email text,
  add column if not exists gmail_thread_id text,
  add column if not exists gmail_message_id text,
  add column if not exists rfc_message_id text,
  add column if not exists last_error text,
  add column if not exists recipients jsonb not null default '[]'::jsonb,
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_send_attempts'
      and column_name = 'error_message'
  ) then
    execute 'update public.email_send_attempts set last_error = coalesce(last_error, error_message) where last_error is null and error_message is not null';
  end if;
end $$;

do $$
declare
  duplicate_count integer;
begin
  select count(*)
    into duplicate_count
  from (
    select lower(user_email), idempotency_key
    from public.email_send_attempts
    group by lower(user_email), idempotency_key
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception using
      message = 'Existen intentos de envío que colisionan al normalizar user_email. Ejecuta el preflight y resuelve los conflictos manualmente antes de aplicar esta migración.';
  end if;

  if exists (
    select 1
    from public.email_send_attempts
    where gmail_account_id is null
  ) then
    raise exception using
      message = 'Existen intentos de envío sin gmail_account_id. Corrige esos registros antes de aplicar esta migración.';
  end if;
end $$;

alter table public.email_send_attempts
  drop constraint if exists email_send_attempts_user_key_unique;

update public.email_send_attempts
set user_email = lower(user_email)
where user_email <> lower(user_email);

alter table public.email_send_attempts
  alter column user_email set not null,
  alter column gmail_account_id set not null,
  alter column entity_type set not null,
  alter column entity_code set not null,
  alter column subject set not null,
  alter column idempotency_key set not null,
  alter column status set not null,
  alter column status set default 'pending',
  alter column recipients set not null,
  alter column recipients set default '[]'::jsonb,
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_gmail_account_id_fkey'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_gmail_account_id_fkey
      foreign key (gmail_account_id)
      references public.gmail_accounts(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_entity_type_check'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_entity_type_check
      check (entity_type in ('quotation', 'requirement'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_status_check'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_status_check
      check (status in ('pending', 'sent', 'failed', 'partial'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_user_email_lowercase'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_user_email_lowercase
      check (user_email = lower(user_email));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_user_email_not_blank'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_user_email_not_blank
      check (length(trim(user_email)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_entity_code_not_blank'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_entity_code_not_blank
      check (length(trim(entity_code)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_subject_not_blank'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_subject_not_blank
      check (length(trim(subject)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_key_not_blank'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_key_not_blank
      check (length(trim(idempotency_key)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_recipients_array'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_recipients_array
      check (jsonb_typeof(recipients) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_send_attempts_user_key_unique'
      and conrelid = 'public.email_send_attempts'::regclass
  ) then
    alter table public.email_send_attempts
      add constraint email_send_attempts_user_key_unique
      unique (user_email, idempotency_key);
  end if;
end $$;

drop index if exists public.email_threads_user_account_entity_idx;
drop index if exists public.email_threads_entity_idx;
create index if not exists email_threads_entity_idx
  on public.email_threads(user_email, entity_type, entity_code, updated_at desc);

drop index if exists public.email_send_attempts_entity_idx;
create index if not exists email_send_attempts_entity_idx
  on public.email_send_attempts(user_email, gmail_account_id, entity_type, entity_code, created_at desc);

drop trigger if exists set_email_send_attempts_updated_at on public.email_send_attempts;
create trigger set_email_send_attempts_updated_at
before update on public.email_send_attempts
for each row execute function public.set_updated_at();

alter table public.email_threads enable row level security;
alter table public.email_send_attempts enable row level security;

revoke delete on public.email_threads from authenticated;
grant select, insert, update on public.email_threads to authenticated;

revoke delete on public.email_send_attempts from authenticated;
grant select, insert, update on public.email_send_attempts to authenticated;

drop policy if exists email_threads_own on public.email_threads;
create policy email_threads_own on public.email_threads
for all to authenticated
using (user_email = lower(coalesce((select auth.jwt()) ->> 'email', '')))
with check (user_email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

drop policy if exists email_send_attempts_own on public.email_send_attempts;
create policy email_send_attempts_own on public.email_send_attempts
for all to authenticated
using (user_email = lower(coalesce((select auth.jwt()) ->> 'email', '')))
with check (user_email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

commit;
