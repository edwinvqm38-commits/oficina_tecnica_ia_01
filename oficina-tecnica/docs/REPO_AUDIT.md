# REPO_AUDIT

## Resumen

Auditoria inicial de Fase 0 para proteger el repositorio y documentar su estructura sin tocar logica funcional.

Se confirma que `oficina-tecnica/` es la aplicacion principal real en Next.js. Las carpetas `project/`, `chats/` y `project/uploads/ops-ia-v2-demo-main/` se mantienen como prototipo, historial o versiones antiguas de referencia.

## Carpetas revisadas

- Raiz del repositorio `oficina_tecnica_ia_01/`
- `oficina-tecnica/`
- `oficina-tecnica/docs/`
- `oficina-tecnica/supabase/sql/`
- `project/`
- `chats/`
- `project/uploads/ops-ia-v2-demo-main/`

## Cambios de proteccion aplicados

- Se agrego `.gitignore` raiz.
- Se reforzo `oficina-tecnica/.gitignore`.
- Se agrego `oficina-tecnica/.env.example` sin valores reales.
- Se actualizo el README raiz para senalar la aplicacion principal y advertir sobre archivos no versionables.
- Se creo `PROJECT_CONTEXT.md` con contexto operativo para humanos e IA.

## Candidatos a limpieza futura

No se elimino nada en esta fase. Candidatos para revisar despues:

- `project/`
- `chats/`
- `project/uploads/ops-ia-v2-demo-main/`
- archivos ZIP o bundles historicos si existieran
- logs locales o artefactos generados que ya estuvieran trackeados

## Riesgos identificados

- Confusion entre la app principal y prototipos antiguos.
- Despliegues desde una rama o carpeta incorrecta en Vercel.
- Secretos en `.env.local` si fueran agregados accidentalmente al control de versiones.
- Artefactos pesados como `.next/`, `node_modules/`, `.vercel/`, logs o ZIPs aumentando el repositorio.
- Scripts SQL manuales que requieren orden de ejecucion y trazabilidad.

## Proximos pasos recomendados

1. Ejecutar una revision de archivos trackeados para confirmar que no existan secretos o artefactos ya versionados.
2. Validar build desde `oficina-tecnica/` con `npm run build`.
3. Revisar configuracion de Vercel para confirmar que el root directory sea `oficina-tecnica`.
4. Documentar el orden vigente de scripts SQL de Supabase.
5. En una fase posterior, decidir si las carpetas historicas se archivan, se renombran o se mantienen.
