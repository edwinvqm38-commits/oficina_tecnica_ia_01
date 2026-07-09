# PROJECT CONTEXT


## 2026-07-09 | Módulo Recursos | Visualización de recursos inactivos

### Proyecto
TRABAJO-MODELO02 | Oficina Técnica IA

### Módulo
Recursos

### Decisión funcional
La tabla de Recursos muestra por defecto solo recursos activos o no inactivos. Se agregó un checkbox/toggle "Mostrar inactivos" para incluir recursos con estado = "Inactivo" cuando el usuario lo active.

### Lógica implementada
- Se agregó estado local showInactive, por defecto false.
- Si showInactive está desactivado, se excluyen recursos con estado === "Inactivo".
- Si showInactive está activado, se muestran activos e inactivos.
- Estados vacíos, null, undefined u otros valores no se consideran inactivos.

### Archivos modificados
- components/sgp/pages/RecursosContent.tsx
- lib/sgp/recursosRepository.ts

### Restricciones respetadas
- No se modificó Supabase SQL.
- No se usó deleted_at.
- No se borraron recursos físicamente.
- No se modificaron APIs.
- No se tocó Google Drive.
- No se tocó .env.local.
- No se instalaron paquetes.
- No se tocaron Requerimientos ni Cotizaciones.

### Validación reportada
- npm run lint: pasa sin errores bloqueantes, con warnings conocidos.
- npm run build: pasa correctamente después de limpiar .next.
- Commit aplicado: f4b235b - Mejora: controlar visualización de recursos inactivos.

## 2026-07-09 | Módulo Recursos | Identificación visual de recursos inactivos

### Proyecto
TRABAJO-MODELO02 | Oficina Técnica IA

### Módulo
Recursos

### Decisión funcional
Cuando el usuario active el toggle "Mostrar inactivos", los recursos con estado = "Inactivo" deben distinguirse visualmente en la tabla para evitar confusión operativa.

### Lógica implementada
- Se agregó detección estricta con row.estado === "Inactivo".
- En la columna Estado, los recursos inactivos muestran un badge gris explícito "Inactivo".
- Las filas inactivas se muestran con apariencia ligeramente tenue y fondo suave.
- No se modifica el filtro "Mostrar inactivos".
- No se ocultan botones existentes.
- Solo se considera inactivo el estado exacto "Inactivo".

### Archivo modificado
- components/sgp/resources/ResourcesTable.tsx

### Restricciones respetadas
- No se modificó Supabase SQL.
- No se modificaron APIs.
- No se modificó repository.
- No se usó deleted_at.
- No se borraron recursos físicamente.
- No se tocó Google Drive.
- No se tocó .env.local.
- No se instalaron paquetes.
- No se tocaron Requerimientos ni Cotizaciones.

### Validación reportada
- npm run lint: pasa sin errores bloqueantes, con 87 warnings conocidos por deuda técnica temporal.
- npm run build: pasa correctamente con Next.js 16.2.7.

## 2026-07-09 | Módulo Recursos | Confirmación antes de desactivar recurso

### Proyecto
TRABAJO-MODELO02 | Oficina Técnica IA

### Módulo
Recursos

### Decisión funcional
Antes de desactivar un recurso, el sistema debe solicitar confirmación al usuario para evitar desactivaciones accidentales. La confirmación debe aclarar que el recurso no será eliminado físicamente, sino marcado como Inactivo.

### Lógica implementada
- Se ajustó el mensaje de confirmación previo a la desactivación.
- Si el usuario cancela, no se ejecuta deactivateRecurso.
- Si el usuario confirma, continúa la lógica existente de desactivación.
- La desactivación lógica sigue usando estado = "Inactivo".
- No se modifica el filtro "Mostrar inactivos".
- No se modifica la identificación visual de recursos inactivos.

### Archivo modificado
- components/sgp/pages/RecursosContent.tsx

### Restricciones respetadas
- No se modificó Supabase SQL.
- No se modificó schema.
- No se modificaron APIs.
- No se modificó repository.
- No se usó deleted_at.
- No se borraron recursos físicamente.
- No se tocó Google Drive.
- No se tocó .env.local.
- No se instalaron paquetes.
- No se tocaron Requerimientos ni Cotizaciones.

### Validación reportada
- npm run lint: pasa sin errores bloqueantes, con 87 warnings conocidos por deuda técnica temporal.
- npm run build: pasa correctamente.

## 2026-07-09 | Módulo Recursos | Reactivación de recursos inactivos

### Proyecto
TRABAJO-MODELO02 | Oficina Técnica IA

### Módulo
Recursos

### Decisión funcional
Los recursos desactivados lógicamente con estado = "Inactivo" deben poder reactivarse desde la interfaz cuando el usuario active el toggle "Mostrar inactivos".

### Lógica implementada
- Se agregó la operación reactivateRecurso(id) como inversa mínima de deactivateRecurso.
- La reactivación actualiza solo:
  - estado = "Activo"
  - updated_at = now
- En la tabla de Recursos, si un recurso tiene estado === "Inactivo", aparece una acción/botón "Reactivar".
- Antes de reactivar, se muestra confirmación al usuario.
- Si el usuario cancela, no se ejecuta ningún cambio.
- Si el usuario confirma, el recurso vuelve a estado = "Activo".
- Luego de reactivarse, el recurso vuelve a estar disponible en la lista principal.
- Se mantiene el filtro "Mostrar inactivos".
- Se mantiene el badge visual "Inactivo".

### Archivos modificados
- lib/sgp/recursosRepository.ts
- components/sgp/pages/RecursosContent.tsx
- components/sgp/resources/ResourcesTable.tsx

### Restricciones respetadas
- No se modificó Supabase SQL.
- No se modificó schema.
- No se usó deleted_at.
- No se borraron recursos físicamente.
- No se modificaron APIs.
- No se tocó Google Drive.
- No se tocó .env.local.
- No se instalaron paquetes.
- No se tocaron Requerimientos ni Cotizaciones.
- No se creó commit desde Codex.

### Validación reportada
- npm run lint: pasa sin errores bloqueantes, con 87 warnings conocidos por deuda técnica temporal.
- npm run build: pasa correctamente.
- Prueba manual: reactivación validada correctamente en /recursos.
