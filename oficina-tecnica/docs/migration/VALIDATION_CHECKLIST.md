# Checklist de Validación — Migración Supabase → Neon (PLAN EGRESO CERO)

Este checklist se usa en cada fase de la migración. No contiene datos
reales — solo criterios de verificación.

## A. Antes de cualquier fase que toque datos (obligatorio)

- [ ] Existe un backup reciente verificado, guardado **fuera del repo**
      (ver `BACKUP_STRATEGY.md`).
- [ ] El backup fue probado restaurándolo en un entorno de prueba (no
      basta con "se generó el archivo").
- [ ] Se confirmó con el usuario qué tablas exactas se van a tocar en
      esta fase.
- [ ] No hay cambios sin commitear pendientes de revisión en el repo.

## B. Seguridad / Git (obligatorio en cada fase)

- [ ] `git status --short` no muestra archivos bajo `/backups/`,
      `/exports/`, `/data/raw/`, `/data/private/`.
- [ ] `git diff` no contiene ningún `.env`, `anon key`, `service_role
      key`, token de GitHub/Vercel/Neon, ni cadena de conexión con
      contraseña en texto plano.
- [ ] Ningún script en `scripts/migration/` usa `service_role` ni
      credenciales con privilegios elevados.
- [ ] `.gitignore` sigue cubriendo: `/backups/`, `/exports/`,
      `/data/raw/`, `/data/private/`, `*.dump`, `*.backup`, `*.csv`,
      `*.xlsx`, `.env*`.
- [ ] No se imprimieron secretos en ningún log, salida de terminal o
      mensaje de chat durante la fase.

## C. Schema (MIGRATION-1)

- [ ] El schema en `db/schema/` (Drizzle) refleja exactamente las
      columnas y tipos reales de Supabase (verificado contra el Dashboard
      o un `pg_dump --schema-only`, no solo contra el código de la app).
- [ ] Las claves primarias, foráneas y constraints `NOT NULL`/`UNIQUE`
      coinciden con las políticas RLS y la lógica de negocio actual.
- [ ] Se documentó cualquier diferencia intencional respecto al schema
      original (ej. normalización de `workspace_state`).

## D. Migración de datos (MIGRATION-3)

- [ ] Conteo de filas por tabla coincide entre Supabase y Neon (origen
      = destino, o la diferencia está explicada — ej. filas con
      `deleted_at` excluidas a propósito).
- [ ] Integridad referencial verificada: no hay `requerimiento_items`
      huérfanos (sin `requerimiento_id` válido), no hay `requerimientos`
      huérfanos (sin `cotizacion_id`/`cotizacion_codigo` válido), etc.
- [ ] Valores agregados de control coinciden (ej. suma de montos de
      `cotizaciones`, conteo de usuarios por `status`/`role`).
- [ ] Ningún dato fue modificado en Supabase durante el proceso de
      lectura (la migración debe ser de solo lectura sobre el origen).

## E. Funcional (MIGRATION-4)

- [ ] Login funciona contra el entorno de prueba con Neon.
- [ ] Listados principales (cotizaciones, requerimientos, recursos)
      cargan con los mismos datos que en Supabase.
- [ ] Permisos por rol (`admin`, `gerencia`, `responsable`, `consulta`)
      se comportan igual que en Supabase.
- [ ] Mesa de trabajo / chats compartidos (si ya se normalizó
      `workspace_state`) muestran el historial esperado.
- [ ] `npm run build` y `npm run lint` pasan sin errores nuevos.

## F. Antes del corte (MIGRATION-5) — requiere aprobación explícita

- [ ] Backup final de Supabase tomado inmediatamente antes del corte.
- [ ] Ventana de mantenimiento acordada con el usuario.
- [ ] Plan de rollback probado (volver a leer/escribir desde Supabase si
      algo falla en las primeras horas tras el corte).
- [ ] Variables de entorno de producción actualizadas solo por el
      usuario o con su aprobación explícita en el momento del corte (no
      antes).

## G. Después del corte

- [ ] Monitorear errores de la app por al menos 24-48h.
- [ ] Confirmar que el egress/costo en Neon se comporta como se esperaba.
- [ ] Definir con el usuario cuánto tiempo se mantiene Supabase como
      respaldo de solo lectura antes de evaluar (no ejecutar) su retiro.
