-- 170_proposal_document_audit.sql
-- Auditoria documental por cotizacion/propuesta.
--
-- Objetivo:
-- - Registrar observaciones, aprobaciones, rechazos y cambios de gerencia.
-- - Registrar archivo/restauracion de documentos Drive.
-- - Mantener la fuente principal de verdad en Supabase; Drive guarda evidencias/exportaciones.

begin;

create table if not exists public.proposal_observation_history (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references public.cotizaciones(id) on delete set null,
  quotation_code text not null,
  related_entity_type text not null check (
    related_entity_type in (
      'QUOTATION',
      'REQUIREMENT',
      'REQUIREMENT_DETAIL',
      'SUPPLIER_QUOTE',
      'COST_ANALYSIS',
      'GENERATED_DOCUMENT',
      'PROPOSAL_VERSION'
    )
  ),
  related_entity_id text,
  observation_type text not null default 'OBSERVATION',
  observation_text text not null,
  status text not null default 'Abierta',
  previous_status text,
  new_status text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_by text,
  resolved_at timestamptz,
  approval_status text,
  drive_file_id text,
  drive_file_url text,
  comments text,
  metadata jsonb not null default '{}'::jsonb,
  constraint proposal_observation_history_quotation_code_not_blank check (length(trim(quotation_code)) > 0),
  constraint proposal_observation_history_text_not_blank check (length(trim(observation_text)) > 0),
  constraint proposal_observation_history_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists proposal_observation_history_quotation_idx
  on public.proposal_observation_history(quotation_code, created_at desc);

create index if not exists proposal_observation_history_related_idx
  on public.proposal_observation_history(related_entity_type, related_entity_id);

drop trigger if exists set_proposal_observation_history_updated_at on public.proposal_observation_history;
create trigger set_proposal_observation_history_updated_at
before update on public.proposal_observation_history
for each row execute function public.set_updated_at();

create table if not exists public.proposal_document_archive_history (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references public.cotizaciones(id) on delete set null,
  quotation_code text not null,
  document_id text,
  document_name text not null,
  document_type text,
  drive_file_id text not null,
  previous_drive_folder_id text,
  previous_drive_folder_name text,
  archive_drive_folder_id text,
  archive_reason text not null,
  archived_by text,
  archived_at timestamptz not null default now(),
  restore_status text not null default 'Archivado',
  restored_by text,
  restored_at timestamptz,
  restore_reason text,
  metadata jsonb not null default '{}'::jsonb,
  constraint proposal_document_archive_history_quotation_code_not_blank check (length(trim(quotation_code)) > 0),
  constraint proposal_document_archive_history_document_name_not_blank check (length(trim(document_name)) > 0),
  constraint proposal_document_archive_history_drive_file_not_blank check (length(trim(drive_file_id)) > 0),
  constraint proposal_document_archive_history_archive_reason_not_blank check (length(trim(archive_reason)) > 0),
  constraint proposal_document_archive_history_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists proposal_document_archive_history_quotation_idx
  on public.proposal_document_archive_history(quotation_code, archived_at desc);

create index if not exists proposal_document_archive_history_drive_file_idx
  on public.proposal_document_archive_history(drive_file_id);

alter table public.proposal_observation_history enable row level security;
alter table public.proposal_document_archive_history enable row level security;

grant select, insert, update on public.proposal_observation_history to authenticated;
grant select, insert, update on public.proposal_document_archive_history to authenticated;

drop policy if exists proposal_observation_history_select on public.proposal_observation_history;
create policy proposal_observation_history_select on public.proposal_observation_history
for select to authenticated
using (
  public.can_use_module('cotizaciones', 'view')
  or public.can_use_module('technical_proposals', 'view')
);

drop policy if exists proposal_observation_history_write on public.proposal_observation_history;
create policy proposal_observation_history_write on public.proposal_observation_history
for all to authenticated
using (
  public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('technical_proposals', 'edit')
)
with check (
  public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('technical_proposals', 'edit')
);

drop policy if exists proposal_document_archive_history_select on public.proposal_document_archive_history;
create policy proposal_document_archive_history_select on public.proposal_document_archive_history
for select to authenticated
using (
  public.can_use_module('cotizaciones', 'view')
  or public.can_use_module('technical_proposals', 'view')
);

drop policy if exists proposal_document_archive_history_write on public.proposal_document_archive_history;
create policy proposal_document_archive_history_write on public.proposal_document_archive_history
for all to authenticated
using (
  public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('technical_proposals', 'edit')
)
with check (
  public.can_use_module('cotizaciones', 'edit')
  or public.can_use_module('technical_proposals', 'edit')
);

commit;
