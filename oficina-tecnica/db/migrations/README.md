# db/migrations

Carpeta destino para las migraciones SQL/Drizzle generadas durante la
migración Supabase → Neon (PLAN EGRESO CERO).

**Qué va aquí:** archivos de migración versionados (DDL: `create table`,
`alter table`, índices, constraints). Es código, no datos.

**Qué NO va aquí:** dumps de datos reales, archivos `.csv`/`.xlsx` con
información de clientes, cotizaciones o usuarios reales, ni credenciales.

Vacía intencionalmente en esta fase (MIGRATION-0). Se llenará en
MIGRATION-1 cuando se generen las migraciones reales con Drizzle Kit.
