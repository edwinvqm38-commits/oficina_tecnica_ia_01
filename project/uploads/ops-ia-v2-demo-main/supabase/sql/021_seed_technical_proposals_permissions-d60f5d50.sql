-- 021_seed_technical_proposals_permissions.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Seed idempotente de permisos iniciales para el modulo Propuesta Tecnica.
--
-- Alcance:
-- - no crea tablas nuevas
-- - no ejecuta Supabase Storage
-- - no toca frontend
-- - no toca Requerimientos ni formato RQ
-- - no toca importacion historica
-- - usa la estructura real de public.admin_module_permissions creada en SQL 010

begin;

insert into public.admin_module_permissions (
  user_email,
  module_key,
  can_view,
  can_create,
  can_edit,
  can_change_status,
  can_upload_files,
  can_view_prices,
  can_view_supplier,
  visible_columns,
  editable_fields,
  required_fields,
  enabled_buttons,
  metadata
) values (
  'edwin.qm@outlook.com',
  'technical_proposals',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  '[
    "code",
    "cotizacion_codigo",
    "revision",
    "status",
    "work_status",
    "document_date",
    "recipient",
    "presentation",
    "commercial_terms"
  ]'::jsonb,
  '[
    "header",
    "recipient",
    "presentation",
    "commercial_terms",
    "metadata",
    "status",
    "work_status"
  ]'::jsonb,
  '[
    "cotizacion_codigo",
    "code",
    "revision",
    "status"
  ]'::jsonb,
  '[
    "open_pt_workspace",
    "save_pt_draft",
    "change_pt_status",
    "upload_pt_files",
    "export_pt_word",
    "print_pt_pdf"
  ]'::jsonb,
  '{
    "seed": "021_seed_technical_proposals_permissions",
    "scope": "technical_proposals",
    "temporary_email_fallback": "edwin.qm@outlook.com",
    "note": "Fallback temporal alineado al patron actual de RLS; migrar luego a permisos administrativos sin correo hardcodeado."
  }'::jsonb
)
on conflict (user_email, module_key) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_change_status = excluded.can_change_status,
  can_upload_files = excluded.can_upload_files,
  can_view_prices = excluded.can_view_prices,
  can_view_supplier = excluded.can_view_supplier,
  visible_columns = excluded.visible_columns,
  editable_fields = excluded.editable_fields,
  required_fields = excluded.required_fields,
  enabled_buttons = excluded.enabled_buttons,
  metadata = public.admin_module_permissions.metadata || excluded.metadata,
  updated_at = now();

-- Validacion manual: permiso inicial del modulo Propuesta Tecnica.
select
  user_email,
  module_key,
  can_view,
  can_create,
  can_edit,
  can_change_status,
  can_upload_files,
  can_view_prices,
  can_view_supplier
from public.admin_module_permissions
where lower(user_email) = 'edwin.qm@outlook.com'
  and module_key = 'technical_proposals';

commit;
