# Fase 7 - Importacion observada controlada

## Objetivo de Fase 7
Preparar el importador controlado de carga historica observada, dejando la ejecucion real bloqueada por defecto y exigiendo validaciones previas estrictas.

## Por que el importador queda bloqueado por defecto
- Para evitar inserciones accidentales.
- Para exigir confirmaciones explicitas antes de una carga real.
- Para separar claramente:
  - validacion tecnica
  - aprobacion funcional
  - ejecucion real

## Como funciona `--dry-run`
- Lee el plan generado en `tmp_imports/dry_run`.
- Verifica batch, readiness, planned files, trazabilidad y columnas minimas.
- Intenta chequeos remotos solo por `SELECT` si existe configuracion segura.
- Genera `tmp_imports/import_execution` con:
  - `import_execution_plan.json`
  - `import_execution_validation.csv`
  - `import_execution_report.md`
- No inserta nada.

## Que validaciones realiza
- `batch-id` consistente
- `readiness_status` permitido
- `total_conflicts = 0`
- planned files presentes
- planned counts consistentes
- campos minimos de trazabilidad
- chequeo remoto opcional:
  - batch no existente
  - codigos de cotizacion no existentes
  - codigos de requerimiento no existentes
  - autenticacion normal de super admin si existe configuracion

## Validacion remota segura con Supabase
### Variables requeridas
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `HISTORICAL_IMPORT_ADMIN_EMAIL`
- `HISTORICAL_IMPORT_ADMIN_PASSWORD`

### Fuente de variables
El script intenta cargar variables desde:
- `process.env`
- `.env.local`
- `.env`

Sin imprimir secretos en consola.

### Regla de seguridad
- no usa `service role key`
- solo usa anon key
- solo ejecuta `SELECT`
- no hace `insert`, `update`, `delete`, `upsert` ni `rpc`

### Como interpretar estados remotos
- `missing_supabase_client`
  - no se pudo crear cliente por falta de `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `missing_supabase_credentials`
  - existe configuracion base de Supabase, pero faltan credenciales normales de admin para autenticacion remota
- `remote_validation_status = skipped`
  - el chequeo remoto no se pudo hacer y el script siguio en modo local
- `remote_validation_status = warning`
  - hubo validaciones remotas parciales o consultas no viables, sin insercion
- `remote_validation_status = passed`
  - las validaciones remotas criticas pasaron
- `remote_validation_status = failed`
  - las validaciones remotas criticas fallaron y bloquean una futura ejecucion real

### Como interpretar `can_execute`
- `can_execute = true` no ejecuta nada automaticamente
- solo indica que el lote quedaria habilitado para una futura ejecucion controlada
- aun asi, `--execute` exige confirmaciones explicitas y sigue siendo una accion separada

## Diagnostico de validaciones remotas
### Que valida el script
- disponibilidad de variables base de Supabase
- autenticacion normal por email/password
- session utilizable
- `user.id` y `user.email`
- coincidencia entre `user.email` autenticado y `HISTORICAL_IMPORT_ADMIN_EMAIL`
- confirmacion de super admin via `public.user_profiles`
- existencia previa de:
  - `import_batch_id` en `public.historical_import_batches`
  - codigos de cotizacion en `public.cotizaciones`
  - codigos de requerimiento en `public.requerimientos`
- intento acotado de revision de `metadata.historical_import` si las lecturas base resultan viables

### Errores que bloquean ejecucion
- `auth_failed`
- `supabase_session_missing`
- `supabase_user_missing`
- `supabase_user_email_mismatch`
- `user_profiles_select_failed`
- `super_admin_check_failed`
- `batch_already_exists`
- `remote_batch_check_failed`
- `cotizacion_codigo_conflicts_detected`
- `remote_cotizacion_check_failed`
- `requerimiento_codigo_conflicts_detected`
- `remote_requerimiento_check_failed`

### Warnings que no bloquean por si solos
- `remote_metadata_key_check` no viable
- deteccion parcial o muestreo remoto de metadata
- warnings operativos del dry-run cuando no rompen trazabilidad ni unicidad

### Por que metadata check puede quedar como warning
- la revision de `metadata.historical_import` por cliente anon autenticado puede ser mas delicada por RLS y por consultas JSONB
- si fallan primero los `SELECT` base sobre tablas principales, el script omite el metadata check y lo deja como warning explicito
- esto evita falsos blockers adicionales y deja claro que primero hay que resolver lectura base

### Por que se usa chunking
- para no consultar listas grandes en una sola llamada
- para reducir riesgo de fallos por longitud de filtro o volumen de codigos
- para registrar cuantas claves unicas se revisaron realmente en cada check remoto

### Por que no se usa service role
- porque el objetivo es validar con el mismo modelo de seguridad real del proyecto
- porque usar `service role key` ocultaria problemas de RLS o permisos `SELECT`
- porque la carga observada aprobada debe respetar autenticacion normal y trazabilidad

## Permisos minimos para validacion remota
### Por que aparecia `42501`
El dry-run remoto ya lograba:
- autenticar usuario normal
- abrir session
- detectar `user.id` y `user.email`
- confirmar super admin en `public.user_profiles`

El error `42501 permission denied` seguia apareciendo porque faltaban permisos base de lectura y/o politicas `SELECT` en tablas objetivo:
- `public.historical_import_batches`
- `public.cotizaciones`
- `public.requerimientos`

### Diferencia entre `GRANT` y RLS
- `GRANT` habilita el permiso base sobre la tabla para el rol `authenticated`
- RLS decide que filas puede ver realmente ese usuario
- tener solo RLS sin `GRANT` puede seguir dando `42501`
- tener solo `GRANT` sin politica RLS adecuada no alcanza cuando `rowsecurity` esta activa

### Que agrega la propuesta SQL 014
- `grant usage on schema public to authenticated`
- `grant select` en:
  - `public.cotizaciones`
  - `public.requerimientos`
  - `public.requerimiento_items`
- `grant select, insert, update` en:
  - `public.historical_import_batches`
  - `public.historical_import_issues`
- politicas `SELECT` solo para super admin en:
  - `public.cotizaciones`
  - `public.requerimientos`
  - `public.requerimiento_items`

### Alcance de seguridad
- no se desactiva RLS
- no se crean politicas abiertas para todos
- no se otorgan permisos a `anon`
- no se habilita `DELETE`
- no se ejecuta importacion real

### Efecto esperado
Con esos permisos minimos, el importador controlado deberia poder hacer validaciones remotas por `SELECT` y decidir mejor:
- si el batch ya existe
- si hay codigos de cotizacion duplicados
- si hay codigos de requerimiento duplicados

Eso no cambia por si solo `can_execute`.
`can_execute` seguira dependiendo de:
- dry-run consistente
- `readiness_status` permitido
- `total_conflicts = 0`
- validaciones remotas criticas aprobadas
- confirmaciones explicitas para una futura ejecucion real

## Flags exigidos para `--execute`
Una futura ejecucion real debe exigir:
- `--execute`
- `--confirm-batch "<batch-id>"`
- `--confirm-risk "OBSERVED_IMPORT_APPROVED"`
- `--confirm-no-conflicts`

Si falta cualquiera, el script debe abortar antes de insertar.

## Por que no usar service role key
- Aumenta riesgo innecesario para una carga observada.
- Rompe el patron de control normal del proyecto.
- La estrategia aprobada es usar autenticacion normal y RLS, no privilegios fuera de la aplicacion.

## Que se insertaria en una carga real futura
Orden previsto:
1. `public.historical_import_batches`
2. `public.cotizaciones`
3. `public.requerimientos`
4. `public.requerimiento_items`
5. `public.historical_import_issues`

## Rama de ejecucion real controlada
### Confirmaciones requeridas
La rama `--execute` solo debe avanzar si se pasan todas estas confirmaciones:
- `--execute`
- `--confirm-batch "<batch-id>"`
- `--confirm-risk "OBSERVED_IMPORT_APPROVED"`
- `--confirm-no-conflicts`

Si falta una, el script aborta antes de insertar.

### Preflight remoto repetido
Antes de insertar, la rama real vuelve a ejecutar validaciones remotas por `SELECT`:
- `remote_validation_status = passed`
- `can_execute = true`
- `total_conflicts = 0`
- `readiness_status` permitido
- batch no existente
- codigos de cotizacion no existentes
- codigos de requerimiento no existentes
- super admin confirmado

### Por que se inserta primero el batch
- crea trazabilidad desde el inicio
- permite dejar `status = importing`
- facilita detectar falla parcial y actualizar a `failed_partial`

### Orden de insercion y relaciones
1. insertar `public.historical_import_batches`
2. insertar `public.cotizaciones`
3. construir mapa `historical_cotizacion_key -> cotizacion_id`
4. insertar `public.requerimientos` usando `cotizacion_id` real
5. construir mapa `historical_rq_key -> requerimiento_id`
6. insertar `public.requerimiento_items` usando `requerimiento_id` real
7. insertar `public.historical_import_issues`
8. actualizar batch a `imported` o `imported_with_observations`

### Metadata historica
Cada entidad insertada debe conservar `metadata.historical_import` con:
- `import_batch_id`
- claves historicas
- calidad de datos
- notas
- trazabilidad de fuente

### Que ocurre si hay falla parcial
- no se reintenta automaticamente
- se intenta actualizar el batch a `failed_partial`
- se genera:
  - `import_execution_result.json`
  - `import_execution_result.md`
- el reporte deja:
  - tabla con error
  - mensaje
  - conteos insertados antes de fallar
  - siguiente paso recomendado

### Por que no se reintenta automaticamente
- para evitar duplicados parciales
- para no ocultar problemas de permisos o esquema
- para exigir una revision humana antes de cualquier nuevo intento

### Como validar despues de una ejecucion real
- revisar `historical_import_batches` por `import_batch_id`
- validar conteos insertados
- revisar `historical_import_issues`
- revisar `metadata.historical_import` en cotizaciones, requerimientos e items
- confirmar relaciones reales entre cotizacion, requerimiento e item

## Preflight antes de ejecucion real
### Que valida `--preflight-execute`
El flag `--preflight-execute` ejecuta una revision previa de la rama real sin insertar datos:
- recalcula el plan local
- valida payloads insertables
- valida columnas `NOT NULL` conocidas
- reusa el resultado remoto `SELECT` del importador
- intenta revisar readiness de permisos `INSERT` y politicas RLS si la introspeccion es viable
- genera:
  - `preflight_execute_review.json`
  - `preflight_execute_validation.csv`
  - `preflight_execute_report.md`

### Por que se validan columnas `NOT NULL`
Antes de una carga real, el script debe confirmar que no intenta insertar `null` o vacios inseguros en campos base como:
- `codigo`
- `cotizacion_id`
- `requerimiento_id`
- `cantidad`
- `precio_unitario`
- `subtotal`
- `moneda_codigo`
- `metadata`

Si el historico no trae valor, el payload usa el valor seguro previsto por el plan y mantiene la observacion en `metadata.historical_import`.

### Por que se revisan permisos `INSERT`
El `SELECT` remoto puede pasar y aun asi fallar una ejecucion real si faltan:
- `GRANT INSERT`
- politicas RLS `FOR INSERT`

Por eso el preflight intenta confirmar readiness de permisos. Si la introspeccion no es viable con el cliente normal, deja warning y remite a la propuesta SQL 015.

### Cuando ejecutar SQL 015
Solo si el preflight detecta que faltan permisos o politicas para:
- `public.cotizaciones`
- `public.requerimientos`
- `public.requerimiento_items`

SQL 015 es una propuesta conservadora para `INSERT` controlado de super admin. No debe ejecutarse sin revision previa.

### Por que todavia no ejecutar `--execute`
Aunque `can_execute` o `execute_branch_ready` resulten verdaderos, la ejecucion real sigue requiriendo:
- confirmaciones explicitas
- aprobacion humana
- revision funcional del lote
- validacion final de permisos reales en entorno controlado

### Checklist final antes de carga real
- [ ] `remote_validation_status = passed`
- [ ] `can_execute = true`
- [ ] `execute_branch_ready = true`
- [ ] payloads `NOT NULL` validados
- [ ] readiness de permisos `INSERT` validado o SQL 015 revisado
- [ ] aprobacion humana explicita
- [ ] decision operativa de ventana de carga

## Recuperacion ante lote `failed_partial` sin inserciones principales
- Si un intento real crea el batch pero falla antes de insertar cotizaciones, requerimientos, items o issues, el batch debe conservarse como auditoria.
- No se debe borrar automaticamente el lote fallido.
- Si `inserted_counts` queda en cero para datos principales y el `status` queda en `failed_partial`, no se debe reutilizar el mismo `import_batch_id`.
- En ese escenario, el siguiente intento debe prepararse con un nuevo batch-id.
- Recomendacion practica:
  - conservar `IMPORT-2026-001` como evidencia del intento fallido
  - regenerar o preparar el siguiente ciclo con `IMPORT-2026-002`
- El preflight debe bloquear cualquier `--execute` que intente reutilizar un batch `failed_partial` sin inserciones principales.

## Recuperacion ante lote `failed_partial` con inserciones parciales
- `IMPORT-2026-002` debe conservarse como auditoria del intento parcial.
- No se debe reintentar `--execute` con `IMPORT-2026-002`.
- El error observado fue duplicidad de `requerimientos.codigo`, por lo que la recuperacion debe separar dos pasos:
  - rollback controlado revisado manualmente
  - preparacion de un nuevo lote, por ejemplo `IMPORT-2026-003`
- La propuesta SQL de rollback controlado queda en:
  - `supabase/sql/016_rollback_failed_partial_import_2026_002.sql`
- Esa propuesta:
  - no toca `IMPORT-2026-001`
  - no elimina `public.historical_import_batches`
  - solo apunta a registros cuyo `metadata.historical_import.import_batch_id = 'IMPORT-2026-002'`
- El flujo recomendado es:
  - revisar SQL 016
  - ejecutar rollback manual en entorno controlado si se aprueba
  - regenerar el lote historico con `IMPORT-2026-003`
  - volver a correr dry-run, preflight y validacion remota antes de cualquier nueva carga real

## Regla de unicidad para `requerimientos.codigo` en importacion historica
- La importacion historica debe usar un codigo final unico por requerimiento.
- Regla aplicada:
  - si `codigo_para_importacion_simulado` es unico, ese valor se conserva como `codigo_para_importacion_final`
  - si `codigo_para_importacion_simulado` esta repetido, el script genera `codigo_para_importacion_final` historico diferenciado
  - formato recomendado de resolucion:
    - `RQ-HIST-ROW-0001`
    - `RQ-HIST-ROW-0345`
- Esta resolucion:
  - no reemplaza `codigo_original`
  - no modifica el formato operativo de RQ nuevos
  - se guarda en `metadata.historical_import` con:
    - `codigo_rq_original`
    - `codigo_para_importacion_simulado`
    - `codigo_para_importacion_final`
    - `duplicate_code_resolution`
- El preflight de la rama real debe bloquear si detecta duplicados remanentes en `codigo_para_importacion_final`.

## Checklist antes de `IMPORT-2026-003`
- [ ] Conservar `IMPORT-2026-001` como auditoria fallida sin datos principales.
- [ ] Conservar `IMPORT-2026-002` como auditoria fallida parcial.
- [ ] Revisar manualmente `supabase/sql/016_rollback_failed_partial_import_2026_002.sql`.
- [ ] Ejecutar rollback controlado solo si se aprueba operativamente.
- [ ] Regenerar plan con nuevo `import_batch_id`, por ejemplo `IMPORT-2026-003`.
- [ ] Revisar `duplicate_rq_codes_report.csv` y `duplicate_rq_codes_summary.json`.
- [ ] Confirmar que `codigo_para_importacion_final` ya no tiene duplicados.
- [ ] Repetir `--preflight-execute` antes de pensar en un nuevo `--execute`.

## Riesgos
- Sin transaccion global real, una futura carga por cliente REST puede quedar parcial.
- Los registros `CRITICO_REVISAR` deben seguir marcados y nunca presentarse como dato validado.
- Los codigos historicos sin codigo original deben seguir usando clave tecnica y sugerencia historica, no el formato nuevo operativo.

## Rollback conceptual
- bloquear ejecucion si hay conflictos o blockers
- registrar batch primero
- registrar metadata historica en cada entidad
- si una futura fase no garantiza transaccion real, se debe definir rollback logico por `import_batch_id`

## Checklist antes de autorizar ejecucion real
- [ ] `readiness_status` permitido
- [ ] `total_conflicts = 0`
- [ ] blockers en cero
- [ ] credenciales normales disponibles
- [ ] super admin validado
- [ ] aprobacion funcional de `CRITICO_REVISAR`
- [ ] aprobacion funcional de `COMPLETAR_DATOS`
- [ ] confirmaciones explicitas listas
