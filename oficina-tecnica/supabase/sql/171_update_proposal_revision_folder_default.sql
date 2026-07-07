-- 171_update_proposal_revision_folder_default.sql
-- Alinea propuestas tecnicas existentes con la estructura Drive v2.

begin;

alter table if exists public.technical_proposals
  alter column revision_folder set default '02_PROPUESTA';

update public.technical_proposals
set
  revision_folder = '02_PROPUESTA',
  metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object('estructura_documental_version', 'cotizacion_drive_v2')
where revision_folder = '01_REV00';

commit;
