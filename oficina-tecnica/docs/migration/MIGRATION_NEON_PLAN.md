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

## 3. Rama y tag propuestos (pendientes de creación — requieren aprobación)

- Rama de trabajo propuesta: **`migration/neon-plan`** (se crearía desde
  `fix/hard-anti-hallucination` o desde `main`, a definir contigo).
- Tag de respaldo propuesto antes de tocar cualquier cosa relacionada a
  datos: **`backup/pre-neon-migration-2026-06-22`**.

Ninguno de los dos ha sido creado todavía — quedan como propuesta a
ejecutar tras tu aprobación (un `git branch`/`git tag` no destructivo,
pero se ejecuta solo con luz verde explícita).

## 4. Fases de la migración (visión general)

| Fase | Nombre | Contenido | Estado |
|---|---|---|---|
| MIGRATION-0 | Preparación | Backup, documentación, estructura de carpetas, `.gitignore`, inventario de tablas | **Esta fase — en curso** |
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

Una vez aprobada esta documentación y la estructura de carpetas:
1. Crear rama `migration/neon-plan` (con tu autorización).
2. Crear tag `backup/pre-neon-migration-<fecha>` sobre el commit actual de
   `fix/hard-anti-hallucination` o `main` (a confirmar) — es metadata de
   Git, no un backup de datos; el backup de datos real se hace por fuera
   (ver `BACKUP_STRATEGY.md`).
3. Iniciar MIGRATION-1: modelar el schema actual en `db/schema/` usando
   Drizzle, basado en `supabase/schema.sql` y `supabase/sql/*.sql`.
