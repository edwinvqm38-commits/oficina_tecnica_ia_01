-- 240_quotation_documents.sql
-- Auditoria ligera de documentos de cotizaciones/requerimientos en Google Drive.
--
-- Drive guarda los archivos fisicos. Supabase guarda solo metadata, IDs y links
-- para trazabilidad, busqueda desde la app y contexto IA.

begin;

create table if not exists public.quotation_documents (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references public.cotizaciones(id) on delete set null,
  quotation_code text not null,
  requirement_id uuid references public.requerimientos(id) on delete set null,
  requirement_code text,
  folder_key text not null,
  folder_name text not null,
  drive_folder_id text not null,
  drive_file_id text not null,
  drive_file_url text not null,
  original_name text not null,
  drive_name text not nu@
  mime_type text,
  file_size bigint not null default 0 check (file_size >= 0),
  document_type text not null default 'attachment',
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_by_email text,
  uploaded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint quotation_documents_quotation_code_not_blank check (length(trim(quotation_code)) > 0),
  constraint quotation_documents_folder_key_not_blank check (length(trim(folder_key)) > 0),
  constraint quotation_documents_folder_name_not_blank check (length(trim(folder_name)) > 0),
  constraint quotation_documents_drive_folder_id_not_blank check (length(trim(drive_folder_id)) > 0),
  constraint quotation_documents_drive_file_id_not_blank check (length(trim(drive_file_id)) > 0),
  constraint quotation_documents_original_name_not_blank check (length(trim(original_name)) > 0),
  constraint quotation_documents_drive_name_not_blank check (length(trim(drive_name)) > 0),
  constraint quotation_documents_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists quotation_documents_drive_file_unique_idx
  on public.quotation_documents(drive_file_id);

create index if not exists quotation_documents_quotation_idx
  on public.quotation_documents(quotation_code, uploaded_at desc);

create index if not exists quotation_documents_requirement_idx
  on public.quotation_documents(requirement_code, uploaded_at desc)
  where requirement_code is not null;

create index if not exists quotation_documents_folder_idx
  on public.quotation_documents(quotation_code, folder_key, uploaded_at desc);

alter table public.quotation_documents enable row level security;

grant select, insert, update on public.quotation_documents to authenticated;

drop policy if exists quotation_documents_select on public.quotation_documents;
create policy quotation_documents_select on public.quotation_documents
for select to authenticated
using (
  public.can_use_module('cotizaciones', 'view')
  or public.can_use_module('requerimientos', 'view')
);

drop policy if exists quotation_documents_insert on public.quotation_documents;
create policy quotation_documents_insert on public.quotation_documents
for insert to authenticated
with check (
  public.can_use_module('cotizaciones', 'upload')
  or public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('cotizaciones', 'create')
  or public.can_use_module('requerimientos', 'upload')
  or public.can_use_module('requerimientos', 'edit')
);

drop policy if exists quotation_documents_update on public.quotation_documents;
create policy quotation_documents_update on public.quotation_documents
for update to authenticated
using (
  public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('requerimientos', 'edit')
)
with check (
  public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('requerimientos', 'edit')
);

commit;
