-- 026_resource_files_storage_policies.sql
-- DEPRECATED / NO-OP
--
-- Antes este script creaba el bucket privado resource-files en Supabase Storage.
-- Ya no debe usarse para archivos nuevos.
--
-- Regla vigente:
-- - Supabase guarda datos, URLs, IDs y metadata.
-- - Google Drive guarda imagenes, PDFs, fichas tecnicas, sustentos y anexos.
--
-- Se conserva este archivo como no-op para que ejecuciones antiguas no fallen
-- ni vuelvan a activar Storage accidentalmente.

begin;

commit;
