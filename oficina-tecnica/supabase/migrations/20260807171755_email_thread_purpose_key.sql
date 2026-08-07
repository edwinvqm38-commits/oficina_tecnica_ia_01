-- Fase 2B: separa hilos Gmail por propósito de correo.
--
-- Compatibilidad:
-- - Los hilos e intentos existentes se marcan como operational_request.
-- - El backend normaliza el valor legacy management_status a management_report.
-- - La nueva clave activa es:
--   user_email + gmail_account_id + entity_type + entity_code + email_purpose.

begin;

alter table public.email_threads
  add column if not exists email_purpose text;

alter table public.email_send_attempts
  add column if not exists email_purpose text;

update public.email_threads
set email_purpose = case
  when email_purpose = 'management_status' then 'management_report'
  when email_purpose in ('management_report', 'observation_trace') then email_purpose
  else 'operational_request'
end
where email_purpose is null
   or email_purpose = ''
   or email_purpose = 'management_status';

update public.email_send_attempts
set email_purpose = case
  when email_purpose = 'management_status' then 'management_report'
  when email_purpose in ('management_report', 'observation_trace') then email_purpose
  else 'operational_request'
end
where email_purpose is null
   or email_purpose = ''
   or email_purpose = 'management_status';

alter table public.email_threads
  alter column email_purpose set default 'operational_request',
  alter column email_purpose set not null;

alter table public.email_send_attempts
  alter column email_purpose set default 'operational_request',
  alter column email_purpose set not null;

alter table public.email_threads
  drop constraint if exists email_threads_email_purpose_check;

alter table public.email_threads
  add constraint email_threads_email_purpose_check
  check (email_purpose in ('operational_request', 'management_report', 'observation_trace'));

alter table public.email_send_attempts
  drop constraint if exists email_send_attempts_email_purpose_check;

alter table public.email_send_attempts
  add constraint email_send_attempts_email_purpose_check
  check (email_purpose in ('operational_request', 'management_report', 'observation_trace'));

do $$
declare
  duplicate_count integer;
begin
  select count(*)
    into duplicate_count
  from (
    select lower(user_email), gmail_account_id, entity_type, entity_code, email_purpose
    from public.email_threads
    where gmail_account_id is not null
    group by lower(user_email), gmail_account_id, entity_type, entity_code, email_purpose
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception using
      message = 'Existen hilos Gmail duplicados para la nueva clave con email_purpose. Resuelve esos registros antes de aplicar esta migración.';
  end if;
end $$;

alter table public.email_threads
  drop constraint if exists email_threads_user_account_entity_unique;

alter table public.email_threads
  drop constraint if exists email_threads_user_account_entity_purpose_unique;

alter table public.email_threads
  add constraint email_threads_user_account_entity_purpose_unique
  unique (user_email, gmail_account_id, entity_type, entity_code, email_purpose);

drop index if exists public.email_threads_entity_idx;
create index if not exists email_threads_entity_idx
  on public.email_threads(user_email, gmail_account_id, entity_type, entity_code, email_purpose, updated_at desc);

drop index if exists public.email_send_attempts_entity_idx;
create index if not exists email_send_attempts_entity_idx
  on public.email_send_attempts(user_email, gmail_account_id, entity_type, entity_code, email_purpose, created_at desc);

commit;
