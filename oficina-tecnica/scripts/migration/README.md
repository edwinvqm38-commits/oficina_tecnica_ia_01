# scripts/migration

Carpeta destino para scripts de migración (lectura/escritura controlada,
exportación a formato neutro, verificación de conteos) entre Supabase y
Neon.

**Reglas para cualquier script que se agregue aquí (MIGRATION-1 en
adelante):**
- Nunca usar `service_role` ni claves con privilegios elevados desde un
  script versionado en el repo.
- Nunca escribir datos reales a un archivo dentro del repo (usar
  `/backups/` o `/exports/`, ambas en `.gitignore`).
- Todo script destructivo (`DELETE`, `DROP`, `TRUNCATE`) requiere
  confirmación explícita y backup verificado antes de ejecutarse — no se
  automatiza sin aprobación humana.
- Los scripts deben ser idempotentes y re-ejecutables sin duplicar datos.

Vacía intencionalmente en esta fase (MIGRATION-0). No se ha ejecutado ni
se ejecutará ningún script contra datos reales en esta fase.
