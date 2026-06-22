# PLAN EGRESO CERO — Migración Supabase → Neon Postgres

**Fase actual: MIGRATION-0 (preparación, backup y documentación).**
**Ningún dato real ha sido movido, copiado, exportado ni borrado para este
documento. Ninguna migración real ha comenzado.**

## 1. Por qué migrar

Supabase Free está restringido por exceso de egress (9.451 GB / 5 GB,
189%) mientras el tamaño real de la base es mínimo (0.034 GB / 0.5 GB,
7%) y el uso es de pocos usuarios (3 MAU). La Fase 0/1A del PLAN EGRESO
CERO ya redujo el consumo de egress en el código actual (ver
`supabase-egress-best-practices.md` y los commits `6fb7928`/`459339c`),
pero la cuota gratuita de Supabase sigue siendo un techo estructural. Neon
Postgres (con su modelo de cómputo serverless/escalable a cero y cuota de
transferencia más generosa en su free tier) es una alternativa de bajo
costo mientras la app no genera ingresos.

## 2. Principios de esta migración

1. **Nunca se borra Supabase.** Supabase sigue siendo la fuente de verdad
   hasta que Neon esté validado en paralelo y se decida explícitamente el
   corte.
2. **Nunca se mueven datos reales sin backup verificado primero.**
3. **GitHub solo contiene código, schema y documentación** — nunca datos
   reales, dumps, ni secretos (ver `BACKUP_STRATEGY.md`).
4. **Cada fase es reversible.** Si algo falla, se puede volver a Supabase
   sin pérdida de datos.
5. **SISTEMA V2 / SGP-LITE no se toca** en ninguna fase de esta migración.
6. **Ningún script destructivo se ejecuta sin aprobación explícita**, y
   nunca usando `service_role` desde código versionado.

## 3. Rama y tag (creados — estado real)

Estado real tras la aprobación del usuario (ya no son propuestas):

- **Rama de trabajo creada:** `migration/neon-plan` (creada desde
  `fix/hard-anti-hallucination`, commit base `459339c`).
- **Commit de MIGRATION-0 creado:** `6a1797c docs: prepare safe Neon
  migration plan` (solo documentación y estructura de carpetas, sin
  migración real).
- **Tag de respaldo creado:** `backup/pre-neon-migration-2026-06-22`,
  apuntando al commit protegido `459339c`.
- **Estado remoto:** la rama `migration/neon-plan` y el tag
  `backup/pre-neon-migration-2026-06-22` ya fueron empujados a `origin`.

Tanto la rama como el tag son metadata de Git (operaciones no
destructivas); el respaldo de **datos reales** se gestiona por fuera del
repo (ver `BACKUP_STRATEGY.md`). El alcance de lo creado es
**documentación solamente** — ninguna migración real ha comenzado.

## 4. Fases de la migración (visión general)

| Fase | Nombre | Contenido | Estado |
|---|---|---|---|
| MIGRATION-0 | Preparación | Backup, documentación, estructura de carpetas, `.gitignore`, inventario de tablas | **Completada** (commit `6a1797c`, rama y tag en `origin`) |
| MIGRATION-0.1 | Correcciones documentales | Ajustes menores tras auditoría (estado real de rama/tag, control de alcance, nota de `pg_dump`) | **Completada** (solo documentación) |
| MIGRATION-1 | Schema en código | Modelar tablas actuales de Supabase en Drizzle ORM (`db/schema/`), generar primera migración | Pendiente |
| MIGRATION-2 | Neon de prueba | Crear proyecto Neon, aplicar schema, validar conexión desde un entorno de prueba (no producción) | Pendiente |
| MIGRATION-3 | Migración de datos (no destructiva) | Copiar datos de Supabase → Neon en paralelo, Supabase sigue siendo fuente de verdad | Pendiente |
| MIGRATION-4 | Validación cruzada | Comparar conteos, integridad referencial, smoke tests funcionales en Neon | Pendiente |
| MIGRATION-5 | Corte (cutover) | Cambiar la app para leer/escribir desde Neon; Supabase queda como respaldo de solo lectura por un periodo | Pendiente, requiere aprobación explícita y ventana acordada |
| MIGRATION-6 | Retiro de Supabase (opcional) | Solo tras validar Neon en producción por un periodo razonable | Pendiente, no antes de tener un backup completo fuera del repo |

## 5. Qué NO se hace en MIGRATION-0

- No se conecta a Neon todavía (no hay credenciales de Neon en este
  entorno ni se piden en esta fase).
- No se ejecuta ningún `SELECT`, `COPY`, `pg_dump` ni exportación real
  contra Supabase.
- No se modifica ninguna variable de entorno de producción.
- No se toca el login, el cliente de Supabase, ni SISTEMA V2/SGP-LITE.

## 6. Siguiente paso después de esta fase

Ya completado en MIGRATION-0 / MIGRATION-0.1:
1. ✅ Rama `migration/neon-plan` creada y empujada a `origin`.
2. ✅ Tag `backup/pre-neon-migration-2026-06-22` creado sobre `459339c` y
   empujado a `origin` — es metadata de Git, no un backup de datos; el
   backup de datos real se hace por fuera (ver `BACKUP_STRATEGY.md`).
3. ✅ Documentación auditada (`APTO CON OBSERVACIONES`) y observaciones
   menores corregidas.

Pendiente antes de iniciar MIGRATION-1 (no ejecutado todavía):
- Confirmar el inventario real de tablas desde el Dashboard de Supabase.
- Exportar el schema con `pg_dump --schema-only` **fuera del repo** y
  revisarlo manualmente (ver nota de seguridad en `DATA_MAPPING.md` y
  `VALIDATION_CHECKLIST.md`).
- Recién entonces modelar el schema en `db/schema/` usando Drizzle,
  basado en `supabase/schema.sql` y `supabase/sql/*.sql`, sin tocar
  producción.
