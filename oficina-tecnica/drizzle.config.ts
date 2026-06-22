/**
 * REBUILD-1C-A — Configuración de Drizzle Kit (BORRADOR LOCAL, SEGURO)
 *
 * Esta configuración NO se conecta a ninguna base de datos. Solo apunta
 * al schema en código para que `drizzle-kit generate` (cuando se apruebe
 * explícitamente en una fase posterior) pueda producir migraciones SQL
 * de forma offline, sin credenciales ni `DATABASE_URL`.
 *
 * Deliberadamente esta config:
 * - No define `dbCredentials`.
 * - No lee `process.env.DATABASE_URL` ni ninguna variable de entorno.
 * - No importa `dotenv`.
 * - No se usa para `drizzle-kit migrate`, `push`, `pull` ni `studio`
 *   (esos comandos sí requieren conexión real y NO están autorizados
 *   en esta fase).
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/rebuild-schema/core.ts",
  out: "./db/rebuild-migrations",
});
