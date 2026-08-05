-- Preflight de solo lectura para la migracion de hilos Gmail/idempotencia.
-- Ejecutar en un entorno de prueba antes de aplicar la migracion.

select
  '01_duplicate_future_active_key_count' as check_name,
  count(*) as duplicate_group_count,
  coalesce(sum(row_count), 0)::bigint as affected_rows
from (
  select
    lower(user_email) as canonical_user_email,
    gmail_account_id,
    entity_type,
    entity_code,
    count(*) as row_count
  from public.email_threads
  where gmail_account_id is not null
  group by lower(user_email), gmail_account_id, entity_type, entity_code
  having count(*) > 1
) duplicates;

select
  '02_duplicate_future_active_key_detail' as check_name,
  lower(user_email) as canonical_user_email,
  gmail_account_id,
  entity_type,
  entity_code,
  count(*) as row_count,
  string_agg(id::text, ', ' order by updated_at desc, id::text) as thread_ids,
  string_agg(subject, ' || ' order by updated_at desc, id::text) as subjects,
  min(created_at) as first_created_at,
  max(updated_at) as last_updated_at
from public.email_threads
where gmail_account_id is not null
group by lower(user_email), gmail_account_id, entity_type, entity_code
having count(*) > 1
order by last_updated_at desc;

select
  '03_uppercase_user_email_email_threads' as check_name,
  count(*) as affected_rows
from public.email_threads
where user_email <> lower(user_email);

select
  '03_uppercase_user_email_email_send_attempts_if_table_exists' as check_name,
  case
    when to_regclass('public.email_send_attempts') is null then null
    else (
      xpath(
        '/row/count/text()',
        query_to_xml(
          'select count(*) from public.email_send_attempts where user_email <> lower(user_email)',
          false,
          true,
          ''
        )
      )
    )[1]::text::bigint
  end as affected_rows;

select
  '04_lower_user_email_conflicts_email_threads' as check_name,
  lower(user_email) as canonical_user_email,
  gmail_account_id,
  entity_type,
  entity_code,
  count(*) as row_count,
  string_agg(id::text, ', ' order by updated_at desc, id::text) as thread_ids
from public.email_threads
where gmail_account_id is not null
group by lower(user_email), gmail_account_id, entity_type, entity_code
having count(*) > 1
order by row_count desc, canonical_user_email;

select
  '04_lower_user_email_conflicts_email_send_attempts_if_table_exists' as check_name,
  case
    when to_regclass('public.email_send_attempts') is null then null
    else query_to_xml(
      'select lower(user_email) as canonical_user_email, idempotency_key, count(*) as row_count, string_agg(id::text, '', '' order by created_at desc, id::text) as attempt_ids from public.email_send_attempts group by lower(user_email), idempotency_key having count(*) > 1 order by row_count desc, canonical_user_email',
      false,
      true,
      ''
    )::text
  end as conflict_rows_xml;

select
  '05_email_threads_null_gmail_account_id_count' as check_name,
  count(*) as affected_rows
from public.email_threads
where gmail_account_id is null;

select
  '05_email_threads_null_gmail_account_id_detail' as check_name,
  id,
  user_email,
  entity_type,
  entity_code,
  subject,
  gmail_thread_id,
  last_gmail_message_id,
  created_at,
  updated_at
from public.email_threads
where gmail_account_id is null
order by updated_at desc, id;

select
  '06_public_set_updated_at_exists' as check_name,
  to_regprocedure('public.set_updated_at()') is not null as exists;

select
  '07_email_threads_columns' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'email_threads'
order by ordinal_position;

select
  '08_email_threads_constraints' as check_name,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.email_threads'::regclass
order by con.conname;

select
  '08_email_threads_indexes' as check_name,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'email_threads'
order by indexname;

select
  '08_email_send_attempts_constraints_if_table_exists' as check_name,
  case
    when to_regclass('public.email_send_attempts') is null then null
    else query_to_xml(
      'select con.conname, con.contype, pg_get_constraintdef(con.oid) as definition from pg_constraint con where con.conrelid = ''public.email_send_attempts''::regclass order by con.conname',
      false,
      true,
      ''
    )::text
  end as constraints_xml;

select
  '08_email_send_attempts_indexes_if_table_exists' as check_name,
  case
    when to_regclass('public.email_send_attempts') is null then null
    else query_to_xml(
      'select indexname, indexdef from pg_indexes where schemaname = ''public'' and tablename = ''email_send_attempts'' order by indexname',
      false,
      true,
      ''
    )::text
  end as indexes_xml;

select
  '09_email_rls_policies' as check_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('email_threads', 'email_send_attempts')
order by tablename, policyname;

select
  '10_email_send_attempts_exists' as check_name,
  to_regclass('public.email_send_attempts') is not null as exists;
