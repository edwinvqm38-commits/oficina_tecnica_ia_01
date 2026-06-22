# Estrategia de Backup — PLAN EGRESO CERO / Migración a Neon

**Este documento no contiene datos reales, dumps, ni secretos. Es solo la
estrategia.**

## 1. Qué se guarda en GitHub

- Código de la aplicación (`app/`, `components/`, `lib/`, etc.).
- Schema SQL versionado (`supabase/schema.sql`, `supabase/sql/*.sql`).
- Definiciones de schema en código (`db/schema/`, futuro Drizzle).
- Migraciones versionadas (`db/migrations/`).
- Scripts de migración (`scripts/migration/`) — sin credenciales
  embebidas, sin `service_role`, sin datos reales escritos a disco dentro
  del repo.
- Documentación (`docs/migration/*.md`), incluido este archivo.

## 2. Qué NUNCA se guarda en GitHub

- Dumps de base de datos (`*.dump`, `*.backup`).
- Exportaciones de datos reales (`*.csv`, `*.xlsx`).
- Carpetas `/backups/`, `/exports/`, `/data/raw/`, `/data/private/`.
- Archivos `.env`, `.env.*`, o cualquier archivo con credenciales,
  `anon key`, `service_role key`, tokens de GitHub/Vercel/Neon.
- Capturas de pantalla o logs que contengan datos personales de clientes,
  cotizaciones reales, o nombres/correos de usuarios reales.

Todo lo anterior ya está cubierto en `.gitignore` (ver sección 4).

## 3. Dónde deben guardarse los backups reales

Los backups reales (dumps de Supabase, exports de tablas, etc.) **no
viven en el repo**. Deben guardarse en uno de estos destinos, fuera de
Git:

- Carpeta local `/backups/` (ya en `.gitignore`, pero igual debe estar
  fuera del árbol de trabajo si es posible, o nunca añadirse con
  `git add -f`).
- Google Drive o OneDrive privado del equipo, en una carpeta no
  compartida públicamente, idealmente con el archivo comprimido y
  cifrado (ej. `7z` con contraseña, o cifrado de disco del proveedor).
- Si se requiere mayor seguridad: cifrar con `age` o `gpg` antes de subir
  a cualquier nube, y guardar la contraseña/clave en un gestor de
  secretos (no en el repo, no en chat, no en texto plano en ningún
  archivo versionado).

## 4. `.gitignore` — verificación

Patrones ya presentes tras la actualización de esta fase
(`oficina-tecnica/.gitignore`):

```
/backups/
/exports/
/data/raw/
/data/private/
*.dump
*.backup
*.csv
*.xlsx
.env*           # ya existía antes de esta fase, cubre .env y .env.*
```

## 5. Cómo validar que no se subieron secretos o datos reales

Antes de cualquier commit que toque carpetas de backup/datos:

```bash
git status --short                 # nada bajo /backups,/exports,/data debería aparecer
git diff --stat                     # revisar que no aparezcan .csv/.xlsx/.dump/.backup
git log --all --diff-filter=A --name-only | grep -E '\.(csv|xlsx|dump|backup)$'  # historial
```

Si algo sensible llegó a aparecer en un commit ya hecho (no solo en el
working tree), **no basta con borrarlo en un commit nuevo** — hay que
tratarlo como incidente de seguridad (rotar credenciales si eran
secretos, y evaluar limpieza de historia con el equipo, fuera del flujo
normal de esta tarea).

## 6. Cómo restaurar desde un backup

Procedimiento general (a ejecutar manualmente, nunca de forma
automática/destructiva):

1. Verificar la integridad del archivo de backup (checksum si se generó
   uno al crear el backup).
2. Restaurar en un entorno de prueba primero (nunca directo a
   producción).
3. Validar conteos de filas por tabla contra lo esperado (ver
   `VALIDATION_CHECKLIST.md`).
4. Solo después de validar, considerar restaurar en el entorno real, y
   siempre con un backup adicional del estado actual antes de sobrescribir
   nada.

## 7. Periodicidad sugerida (a decidir contigo)

- Backup manual antes de cada fase de migración (mínimo).
- Backup automático periódico (ej. semanal) una vez que el volumen de
  datos reales lo justifique — fuera de alcance de MIGRATION-0.
