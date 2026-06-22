# db/rebuild-schema — Schema Drizzle NUEVO (borrador local)

Schema en código del **modelo de datos nuevo** (REBUILD), independiente
de Supabase. Implementa el diseño validado en
`docs/rebuild/REBUILD_1A_MODELO_DATOS.md`.

## Qué es esto

- Definiciones de tablas Drizzle (PostgreSQL) en TypeScript.
- Un borrador **preliminar y aislado**, para revisión.

## Qué NO es / qué NO hace

- **No se conecta a ninguna base de datos** (ni Supabase, ni Neon, ni
  PostgreSQL local). No hay `DATABASE_URL`, cliente de DB ni
  `drizzle.config.ts`.
- **No ejecuta migraciones** (`drizzle-kit generate/push/migrate` no se
  han corrido).
- **No representa el schema legacy de Supabase**, que queda congelado
  como histórico. Esta es una base nueva, con numeración y códigos
  propios (ver REBUILD-1A §8).
- **No incluye** `requirements` / `requirement_items` — quedan fuera de
  alcance hasta aprobación explícita del usuario (REBUILD-1A §7) — ni
  ninguna tabla legacy sensible (Requerimientos/RQ, Propuesta Técnica,
  importación histórica, permisos globales, SISTEMA V2/SGP-LITE, auth).
- **No toca código funcional de la app**: vive en su propia carpeta,
  separada de `db/schema/` (que sigue reservada para el eventual mapeo
  Supabase→Neon de `MIGRATION_NEON_PLAN.md`).

## Tablas incluidas (9)

`clients`, `projects`, `suppliers`, `resources`, `resource_prices`,
`quotes`, `quote_items`, `activity_logs`, `attachments`.

## Estado de la dependencia

> ⚠️ `drizzle-orm` **aún no está instalado** en el proyecto (no figura en
> `package.json`). Por eso este schema **todavía no puede typecheckearse
> ni validarse** contra el ORM real. Los imports de `drizzle-orm/pg-core`
> no resolverán hasta que se apruebe e instale la dependencia. Se entrega
> como propuesta de código para revisión humana previa.

## Próximo paso (no ejecutado todavía)

1. Auditar/validar este borrador con el usuario (nombres, tipos,
   `status`, índices, precisión de `numeric`).
2. Solo si se aprueba: añadir `drizzle-orm` (+ `drizzle-kit` como
   devDependency) con justificación, y configurar `drizzle.config.ts`.
3. Recién entonces decidir el motor real (PostgreSQL local primero, ver
   REBUILD-1A §8) y, en una fase posterior con aprobación separada,
   generar las migraciones.

Hasta ese punto: sin instalar dependencias, sin conectar bases, sin
migraciones, sin tocar producción.
