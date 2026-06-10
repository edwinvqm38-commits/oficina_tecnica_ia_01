-- 032_user_profiles_signup_trigger.sql
-- Soporta el registro con Gmail (Google OAuth): crea automáticamente un
-- perfil "pending" en user_profiles para cada usuario nuevo de auth.users
-- (Google OAuth no pasa por el formulario de registro manual), habilita
-- RLS para que cada usuario vea/edite solo su propio perfil y los admins
-- vean/gestionen todos, y publica la tabla para Realtime (notificación
-- en la app al administrador cuando hay un registro pendiente).

begin;

create extension if not exists pgcrypto;

-- Tabla base (no-op si ya existe; se creó manualmente en un ambiente previo).
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'consulta',
  status text not null default 'pending',
  is_super_admin boolean not null default false,
  approved_by text,
  approved_at timestamptz,
  rejected_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_status_idx on public.user_profiles (status);

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

-- Crea automáticamente el perfil (status='pending') al registrarse,
-- sea por email/contraseña o por Google OAuth ("Continuar con Google").
-- El correo del administrador se aprueba automáticamente como admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name, avatar_url, role, status, is_super_admin, approved_by, approved_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case when lower(new.email) = 'edwin.qm@outlook.com' then 'admin' else 'consulta' end,
    case when lower(new.email) = 'edwin.qm@outlook.com' then 'approved' else 'pending' end,
    lower(new.email) = 'edwin.qm@outlook.com',
    case when lower(new.email) = 'edwin.qm@outlook.com' then 'sistema' else null end,
    case when lower(new.email) = 'edwin.qm@outlook.com' then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- RLS ------------------------------------------------------------------
alter table public.user_profiles enable row level security;
grant select, update on public.user_profiles to authenticated;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "user_profiles_select_admin" on public.user_profiles;
create policy "user_profiles_select_admin"
on public.user_profiles
for select
to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.status = 'approved'
      and (up.is_super_admin is true or up.role = 'admin' or lower(up.email) = 'edwin.qm@outlook.com')
  )
);

drop policy if exists "user_profiles_update_admin" on public.user_profiles;
create policy "user_profiles_update_admin"
on public.user_profiles
for update
to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.status = 'approved'
      and (up.is_super_admin is true or up.role = 'admin' or lower(up.email) = 'edwin.qm@outlook.com')
  )
)
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.status = 'approved'
      and (up.is_super_admin is true or up.role = 'admin' or lower(up.email) = 'edwin.qm@outlook.com')
  )
);

-- Backfill: crea el perfil para usuarios que ya existían en auth.users
-- antes de este trigger (p. ej. tu cuenta de administrador).
insert into public.user_profiles (id, email, full_name, avatar_url, role, status, is_super_admin, approved_by, approved_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url',
  case when lower(u.email) = 'edwin.qm@outlook.com' then 'admin' else 'consulta' end,
  case when lower(u.email) = 'edwin.qm@outlook.com' then 'approved' else 'pending' end,
  lower(u.email) = 'edwin.qm@outlook.com',
  case when lower(u.email) = 'edwin.qm@outlook.com' then 'sistema' else null end,
  case when lower(u.email) = 'edwin.qm@outlook.com' then now() else null end
from auth.users u
where not exists (select 1 from public.user_profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Asegura que tu cuenta quede como admin aprobado aunque ya existiera
-- el perfil con otro estado/rol.
update public.user_profiles
set role = 'admin', status = 'approved', is_super_admin = true,
    approved_by = coalesce(approved_by, 'sistema'), approved_at = coalesce(approved_at, now())
where lower(email) = 'edwin.qm@outlook.com';

-- Realtime: permite al admin recibir notificaciones en vivo de nuevos
-- registros pendientes (suscripción a INSERT/UPDATE en user_profiles).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_profiles'
  ) then
    alter publication supabase_realtime add table public.user_profiles;
  end if;
end $$;

-- Validación: perfiles existentes y su estado.
select id, email, role, status, is_super_admin, created_at
from public.user_profiles
order by created_at desc
limit 20;

commit;
