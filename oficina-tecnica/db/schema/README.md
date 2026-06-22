# db/schema

Carpeta destino para la definición de schema en código (Drizzle ORM) que
reflejará las tablas actuales de Supabase como paso previo a migrar a Neon.

**Qué va aquí:** definiciones de tablas en TypeScript (`*.ts` con
`pgTable(...)`), tipos derivados, relaciones. Es código, no datos.

**Qué NO va aquí:** datos reales, dumps, ni nada que identifique
clientes/usuarios reales.

Vacía intencionalmente en esta fase (MIGRATION-0). Ver
`docs/migration/DATA_MAPPING.md` para el inventario de tablas que deberán
modelarse aquí.
