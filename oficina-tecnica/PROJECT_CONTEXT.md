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

## 2026-07-09 | Módulo Recursos | Corrección de carga de imágenes en galería

### Proyecto
TRABAJO-MODELO02 | Oficina Técnica IA

### Módulo
Recursos

### Problema detectado
En la Galería de recursos, las tarjetas mostraban "Sin acceso" aunque los recursos contaban con metadata de imagen asociada a Google Drive.

### Causa identificada
La galería intentaba mostrar primero la imagen mediante el proxy autenticado /api/drive/file/{id}. Si esa lectura fallaba, no intentaba fuentes alternativas como driveWebContentLink, URL directa de Drive o URL directa de imagen.

### Corrección implementada
- Se actualizó ResourceGallery.tsx para construir una lista de fuentes posibles de imagen.
- El orden de intento queda:
  1. Proxy autenticado /api/drive/file/{id}
  2. driveWebContentLink, si existe.
  3. URL directa de Google Drive tipo https://drive.google.com/uc?export=view&id=...
  4. URL directa si ya corresponde a una imagen.
- Si una fuente falla, la galería intenta la siguiente antes de mostrar "Sin acceso".
- Si realmente no hay imagen o no hay acceso real al archivo, se mantiene el placeholder correspondiente.

### Archivo modificado
- components/sgp/resources/ResourceGallery.tsx

### Restricciones respetadas
- No se modificó Supabase SQL.
- No se modificó schema.
- No se modificó .env.local.
- No se modificó configuración de Google Drive.
- No se modificaron APIs.
- No se cambió lógica de activo/inactivo.
- No se cambió el toggle "Mostrar inactivos".
- No se cambió desactivación ni reactivación de recursos.

### Validación reportada
- npm run lint: pasa sin errores bloqueantes, con 87 warnings conocidos.
- npm run build: pasa correctamente después de limpiar .next.

## 2026-07-09 | Módulo Recursos | Normalización explícita de estado

### Proyecto
TRABAJO-MODELO02 | Oficina Técnica IA

### Módulo
Recursos

### Decisión funcional
Solo se considera recurso inactivo cuando estado === "Inactivo". Los recursos con estado null, undefined, vacío u otro valor deben tratarse como no inactivos para evitar que se oculten por error.

### Lógica implementada
- normalizeResourceStatus ahora acepta string, null o undefined.
- Se normaliza el estado recibido desde Supabase antes de mapearlo al modelo Recurso.
- Los valores "Inactivo" y "Por revisar" se conservan.
- Los valores null, undefined, vacío, "Activo" u otros valores se tratan como "Activo".
- Cuando el toggle "Mostrar inactivos" está apagado, el repository excluye estado = "Inactivo", pero conserva recursos con estado null.

### Archivo modificado
- lib/sgp/recursosRepository.ts

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

### Validación reportada
- npm run lint: pasa sin errores, con 87 warnings conocidos.
- npm run build: pasa correctamente con Next.js 16.2.7.

## 2026-07-10 | Cotizaciones/Requerimientos | Autocomplete de recursos reales activos

### Proyecto
TRABAJO-MODELO02 | Oficina Técnica IA

### Módulos
- Cotizaciones
- Requerimientos
- Recursos

### Problema detectado
En /cotizaciones, dentro del modal de datos de cotización y detalle de requerimiento, al escribir en la columna Descripción no aparecían los recursos reales registrados en el módulo Recursos. La grilla usaba una lista demo o incompleta.

### Causa identificada
CotizacionesContent mantenía el estado de recursos inicializado con demoData.listRecursos() y no lo reemplazaba con recursos reales al cargar datos desde Supabase. La grilla de detalle de requerimiento usaba esa prop recursos para sugerencias.

### Corrección implementada
- CotizacionesContent carga recursos reales mediante listAllRecursos() en paralelo con loadCoreAppData().
- El modal principal conserva la lista completa para cálculos e históricos.
- El modal de edición de RQ recibe selectableRecursos para nuevas selecciones.
- Se excluyen únicamente recursos con estado === "Inactivo".
- Se agregó guard para impedir seleccionar recursos inactivos por rutas alternativas.
- Recursos con estado null, undefined, vacío, "Activo", "Por revisar" u otro valor no se ocultan por error.

### Archivos modificados
- components/sgp/pages/CotizacionesContent.tsx
- components/sgp/pages/RequerimientosContent.tsx
- components/sgp/technical-proposal/ResourceAutocompleteInput.tsx

### Restricciones respetadas
- No se modificó Supabase SQL.
- No se modificó schema.
- No se modificó .env.local.
- No se modificó Google Drive.
- No se modificaron APIs.
- No se alteraron IDs históricos.
- No se alteró lógica de precios históricos.

### Validación
- npm run lint: pasa sin errores bloqueantes, con 87 warnings conocidos.
- npm run build: pasa correctamente.
- Validación manual: en /cotizaciones ya aparecen recursos reales activos en el detalle de requerimiento.

## 2026-07-10 | Cotizaciones/Requerimientos | Recursos reales, lookup liviano y autocomplete fluido

### Proyecto
TRABAJO-MODELO02 | Oficina Técnica IA

### Módulos
- Cotizaciones
- Requerimientos
- Recursos

### Problemas resueltos
1. En /cotizaciones, el detalle de requerimiento usaba recursos demo o lista incompleta en lugar de recursos reales de Supabase.
2. El autocomplete cargaba recursos completos para búsqueda, generando riesgo de lentitud y mayor transferencia de datos.
3. La escritura en la columna Descripción tenía lag porque cada letra actualizaba estado padre de la grilla.
4. Era posible eliminar un ítem/recurso aunque la tabla no estuviera en modo Editar tabla.

### Correcciones implementadas
- CotizacionesContent ahora usa recursos reales activos para selección de RQ.
- RequerimientosContent usa opciones seleccionables coherentes con Recursos.
- Se creó listRecursosLookupOptions() con consulta liviana para autocompletes.
- Se agregó cache temporal en memoria de 5 minutos para evitar recargas repetidas.
- La cache se invalida cuando se crea, edita, desactiva o reactiva un recurso.
- Se mantiene la regla funcional: solo estado === "Inactivo" queda excluido de nuevas selecciones.
- Los recursos con estado null, undefined, vacío, "Activo", "Por revisar" u otro valor no se ocultan por error.
- Se creó ResourceAutocompleteCell con estado local para que la escritura sea fluida.
- Descripción, Código fabricante y Recurso a suministrar ya no actualizan activeAuto global por cada letra.
- onPatchRow solo se ejecuta al confirmar: blur, Enter o selección de sugerencia.
- Las sugerencias se calculan dentro de la celda, con mínimo 2 caracteres y máximo 20 resultados.
- No hay llamadas a Supabase por cada tecla.
- La eliminación de ítems queda bloqueada fuera del modo Editar tabla.

### Archivos modificados
- components/sgp/RequirementItemsGrid.tsx
- components/sgp/pages/CotizacionesContent.tsx
- components/sgp/pages/RequerimientosContent.tsx
- lib/sgp/recursosRepository.ts

### Restricciones respetadas
- No se modificó Supabase SQL.
- No se modificó schema.
- No se modificó .env.local.
- No se modificó Google Drive.
- No se modificaron APIs.
- No se alteraron históricos, IDs ni precios.
- No se instalaron paquetes.

### Validación
- npx eslint focalizado: pasa con 0 errores y warnings de deuda técnica temporal.
- npm run build: pasa correctamente.
- Validación manual: escritura fluida en Descripción y eliminación bloqueada fuera de modo edición.
