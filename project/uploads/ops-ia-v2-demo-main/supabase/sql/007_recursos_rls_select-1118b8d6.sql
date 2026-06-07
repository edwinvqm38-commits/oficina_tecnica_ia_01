begin;

-- Permitir uso del schema public
grant usage on schema public to authenticated;

-- Permitir lectura de recursos a usuarios autenticados
grant select on public.recursos to authenticated;

-- Activar RLS (Row Level Security / seguridad por filas)
alter table public.recursos enable row level security;

-- Evitar duplicar política si se reejecuta
drop policy if exists recursos_select_authenticated on public.recursos;

-- Lectura segura solo de recursos no eliminados
create policy recursos_select_authenticated
on public.recursos
for select
to authenticated
using (
  deleted_at is null
);

commit;
