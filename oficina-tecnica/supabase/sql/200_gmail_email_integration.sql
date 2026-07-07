-- 200_gmail_email_integration.sql
-- Cuentas Gmail conectadas, contactos frecuentes e hilos de correo por registro.

begin;

create extension if not exists pgcrypto;

create table if not exists public.gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  google_email text not null,
  display_name text,
  refresh_token text not null,
  access_token text,
  token_expires_at timestamptz,
  scope text,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gmail_accounts_user_google_unique unique (user_email, google_email),
  constraint gmail_accounts_user_email_not_blank check (length(trim(user_email)) > 0),
  constraint gmail_accounts_google_email_not_blank check (length(trim(google_email)) > 0)
);

create table if not exists public.email_contacts (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  email text not null,
  name text,
  last_used_at timestamptz not null default now(),
  use_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_contacts_user_email_unique unique (user_email, email),
  constraint email_contacts_email_not_blank check (length(trim(email)) > 0)
);

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  gmail_account_id uuid references public.gmail_accounts(id) on delete set null,
  entity_type text not null check (entity_type in ('quotation', 'requirement')),
  entity_code text not null,
  subject text not null,
  gmail_thread_id text,
  last_message_id text,
  last_gmail_message_id text,
  last_sent_at timestamptz,
  recipients jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_threads_unique unique (user_email, entity_type, entity_code, subject),
  constraint email_threads_recipients_array check (jsonb_typeof(recipients) = 'array')
);

create index if not exists gmail_accounts_user_email_idx on public.gmail_accounts(lower(user_email));
create index if not exists email_contacts_user_email_idx on public.email_contacts(lower(user_email), last_used_at desc);
create index if not exists email_threads_entity_idx on public.email_threads(lower(user_email), entity_type, entity_code);

drop trigger if exists set_gmail_accounts_updated_at on public.gmail_accounts;
create trigger set_gmail_accounts_updated_at
before update on public.gmail_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_email_contacts_updated_at on public.email_contacts;
create trigger set_email_contacts_updated_at
before update on public.email_contacts
for each row execute function public.set_updated_at();

drop trigger if exists set_email_threads_updated_at on public.email_threads;
create trigger set_email_threads_updated_at
before update on public.email_threads
for each row execute function public.set_updated_at();

alter table public.gmail_accounts enable row level security;
alter table public.email_contacts enable row level security;
alter table public.email_threads enable row level security;

grant select, insert, update, delete on public.gmail_accounts to authenticated;
grant select, insert, update, delete on public.email_contacts to authenticated;
grant select, insert, update, delete on public.email_threads to authenticated;

drop policy if exists gmail_accounts_own on public.gmail_accounts;
create policy gmail_accounts_own on public.gmail_accounts
for all to authenticated
using (lower(user_email) = lower(coalesce((select auth.jwt()) ->> 'email', '')))
with check (lower(user_email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

drop policy if exists email_contacts_own on public.email_contacts;
create policy email_contacts_own on public.email_contacts
for all to authenticated
using (lower(user_email) = lower(coalesce((select auth.jwt()) ->> 'email', '')))
with check (lower(user_email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

drop policy if exists email_threads_own on public.email_threads;
create policy email_threads_own on public.email_threads
for all to authenticated
using (lower(user_email) = lower(coalesce((select auth.jwt()) ->> 'email', '')))
with check (lower(user_email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

commit;
